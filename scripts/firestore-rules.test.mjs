import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const projectId = 'demo-my-mba-room';
const timestamp = '2026-10-28T12:00:00.000Z';
const month = '2026-10-01';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
    }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedFixtures();
});

async function seedFixtures() {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms', 'room1'), {
      name: 'Room 101',
      join_code: 'JOIN1234',
      admin_user_id: 'admin',
      currency_code: 'PKR',
      track_reimbursements: true,
      default_split_method: 'equal',
      created_at: timestamp
    });
    await setDoc(doc(db, 'rooms', 'room1', 'members', 'admin'), {
      user_id: 'admin', display_name: 'Admin', email: 'admin@example.com',
      role: 'admin', is_active: true, joined_at: timestamp
    });
    await setDoc(doc(db, 'rooms', 'room1', 'members', 'member'), {
      user_id: 'member', display_name: 'Member', email: 'member@example.com',
      role: 'member', is_active: true, joined_at: timestamp, join_code: 'JOIN1234'
    });
    await setDoc(doc(db, 'rooms', 'room1', 'members', 'inactive'), {
      user_id: 'inactive', display_name: 'Inactive', email: 'inactive@example.com',
      role: 'member', is_active: false, joined_at: timestamp, left_at: timestamp
    });
    await setDoc(doc(db, 'inviteCodes', 'JOIN1234'), {
      room_id: 'room1', active: true, created_by: 'admin', created_at: timestamp
    });
    await setDoc(doc(db, 'rooms', 'room1', 'expenses', 'existing-expense'), sampleExpense({
      id: 'existing-expense', created_by: 'admin',
      shares: [{ user_id: 'admin', amount: 5 }, { user_id: 'member', amount: 5 }]
    }));
    await setDoc(doc(db, 'rooms', 'room1', 'payments', 'existing-payment'), samplePayment({
      id: 'existing-payment', amount: 10, paid_by: 'admin', recorded_by: 'admin'
    }));
    await setDoc(doc(db, 'rooms', 'room1', 'closings', '2026-09-01'), {
      id: '2026-09-01', room_id: 'room1', month_start: '2026-09-01',
      closed_by: 'admin', closed_at: timestamp, reopened_at: null,
      snapshot: { expense_total: 100, payment_total: 0, monthly_net: 100, remaining: 100 }
    });
  });
}

function sampleExpense(overrides = {}) {
  return {
    id: 'expense-new', room_id: 'room1', created_by: 'member', description: 'Lunch',
    total_amount: 10, meal_date: '2026-10-28', month_key: month,
    entry_mode: 'shared', is_deleted: false, created_at: timestamp,
    updated_at: timestamp, shares: [{ user_id: 'member', amount: 10 }],
    ...overrides
  };
}

function samplePayment(overrides = {}) {
  return {
    id: 'payment-new', room_id: 'room1', amount: 10, paid_by: 'member',
    recorded_by: 'member', payment_date: '2026-10-28', month_key: month,
    note: 'Canteen payment', is_deleted: false, created_at: timestamp,
    updated_at: timestamp, ...overrides
  };
}

function sampleLog({ action, entityType, entityId, actorId = 'member', beforeData = null, afterData, detail = 'Test audit' }) {
  return {
    room_id: 'room1', actor_id: actorId, action, entity_type: entityType,
    entity_id: entityId, before_data: beforeData, after_data: afterData,
    detail, created_at: timestamp
  };
}

async function setExpenseAndLog(expense, actorId = 'member', action = 'expense.created') {
  const db = env.authenticatedContext(actorId).firestore();
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id), expense);
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    actorId, action, entityType: 'expense', entityId: expense.id, afterData: expense
  }));
  return batch.commit();
}

test('non-members cannot read room documents or expense records', async () => {
  const db = env.authenticatedContext('stranger').firestore();
  await assertFails(getDoc(doc(db, 'rooms', 'room1')));
  await assertFails(getDoc(doc(db, 'rooms', 'room1', 'expenses', 'existing-expense')));
});

test('a valid meal and its matching activity record can be saved atomically', async () => {
  const expense = sampleExpense();
  await assertSucceeds(setExpenseAndLog(expense));
  const db = env.authenticatedContext('member').firestore();
  const saved = await assertSucceeds(getDoc(doc(db, 'rooms', 'room1', 'expenses', expense.id)));
  assert.equal(saved.data().total_amount, 10);
});

test('expense shares must add up exactly and belong to active members', async () => {
  const wrongTotal = sampleExpense({
    id: 'bad-share-total',
    total_amount: 10,
    shares: [{ user_id: 'member', amount: 9.99 }]
  });
  await assertFails(setExpenseAndLog(wrongTotal));

  const inactiveParticipant = sampleExpense({
    id: 'inactive-participant',
    shares: [{ user_id: 'inactive', amount: 10 }]
  });
  await assertFails(setExpenseAndLog(inactiveParticipant));
});

test('a member cannot edit another member\'s expense', async () => {
  const db = env.authenticatedContext('member').firestore();
  await assertFails(updateDoc(doc(db, 'rooms', 'room1', 'expenses', 'existing-expense'), {
    description: 'Tampered entry', updated_at: '2026-10-28T12:30:00.000Z'
  }));
});

test('a payment and matching audit record save together; inactive payers are rejected', async () => {
  const db = env.authenticatedContext('member').firestore();
  const payment = samplePayment();
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', 'room1', 'payments', payment.id), payment);
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    action: 'payment.recorded', entityType: 'canteen_payment',
    entityId: payment.id, afterData: payment
  }));
  await assertSucceeds(batch.commit());

  const bad = samplePayment({ id: 'bad-payer', paid_by: 'inactive' });
  const badBatch = writeBatch(db);
  badBatch.set(doc(db, 'rooms', 'room1', 'payments', bad.id), bad);
  badBatch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    action: 'payment.recorded', entityType: 'canteen_payment',
    entityId: bad.id, afterData: bad
  }));
  await assertFails(badBatch.commit());
});

test('activity logs cannot be fabricated without the matching financial change', async () => {
  const db = env.authenticatedContext('member').firestore();
  const existing = (await getDoc(doc(db, 'rooms', 'room1', 'expenses', 'existing-expense'))).data();
  await assertFails(setDoc(doc(db, 'rooms', 'room1', 'activity', 'fake-log'), sampleLog({
    action: 'expense.updated', entityType: 'expense',
    entityId: 'existing-expense', beforeData: existing, afterData: existing
  })));
});

test('closed-month expenses cannot be created even if an entry is submitted by a member', async () => {
  const expense = sampleExpense({
    id: 'closed-month-meal', meal_date: '2026-09-15', month_key: '2026-09-01'
  });
  await assertFails(setExpenseAndLog(expense));
});

test('members cannot self-promote to room admin', async () => {
  const db = env.authenticatedContext('member').firestore();
  await assertFails(updateDoc(doc(db, 'rooms', 'room1', 'members', 'member'), { role: 'admin' }));
});

test('a member can join using a valid invite when member, index, and audit are atomic', async () => {
  const db = env.authenticatedContext('newcomer').firestore();
  const newMember = {
    user_id: 'newcomer', display_name: 'Newcomer', email: 'new@example.com',
    role: 'member', is_active: true, joined_at: timestamp, join_code: 'JOIN1234'
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', 'room1', 'members', 'newcomer'), newMember);
  batch.set(doc(db, 'users', 'newcomer', 'rooms', 'room1'), {
    room_id: 'room1', room_name: 'Hostel room', role: 'member',
    is_active: true, joined_at: timestamp, join_code: 'JOIN1234'
  });
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), {
    room_id: 'room1', actor_id: 'newcomer', action: 'room.member_joined',
    entity_type: 'room_member', entity_id: 'newcomer', before_data: null,
    after_data: { display_name: 'Newcomer' }, detail: 'Joined room', created_at: timestamp
  });
  await assertSucceeds(batch.commit());
});

test('room creation is one authorized batch including its creation audit record', async () => {
  const db = env.authenticatedContext('creator').firestore();
  const roomId = 'new-room';
  const newRoom = {
    name: 'Study Room', join_code: 'NEWCODE1', admin_user_id: 'creator',
    currency_code: 'PKR', track_reimbursements: false,
    default_split_method: 'equal', created_at: timestamp
  };
  const adminMember = {
    user_id: 'creator', display_name: 'Creator', email: 'creator@example.com',
    role: 'admin', is_active: true, joined_at: timestamp
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', roomId), newRoom);
  batch.set(doc(db, 'rooms', roomId, 'members', 'creator'), adminMember);
  batch.set(doc(db, 'users', 'creator'), {
    display_name: 'Creator', email: 'creator@example.com',
    reminder_enabled: false, reminder_time: '20:30', created_at: timestamp
  });
  batch.set(doc(db, 'users', 'creator', 'rooms', roomId), {
    room_id: roomId, room_name: 'Study Room', role: 'admin',
    is_active: true, joined_at: timestamp
  });
  batch.set(doc(db, 'inviteCodes', 'NEWCODE1'), {
    room_id: roomId, active: true, created_by: 'creator', created_at: timestamp
  });
  batch.set(doc(collection(db, 'rooms', roomId, 'activity')), {
    room_id: roomId, actor_id: 'creator', action: 'room.created',
    entity_type: 'room', entity_id: roomId, before_data: null,
    after_data: { name: 'Study Room' }, detail: 'Created room Study Room', created_at: timestamp
  });
  await assertSucceeds(batch.commit());
});

test('only admins can close a month', async () => {
  const snapshot = { expense_total: 100, payment_total: 30, monthly_net: 70, remaining: 170 };
  const memberDb = env.authenticatedContext('member').firestore();
  const closing = {
    id: month, room_id: 'room1', month_start: month, closed_by: 'member',
    closed_at: timestamp, reopened_at: null, snapshot
  };
  const memberBatch = writeBatch(memberDb);
  memberBatch.set(doc(memberDb, 'rooms', 'room1', 'closings', month), closing);
  memberBatch.set(doc(collection(memberDb, 'rooms', 'room1', 'activity')), sampleLog({
    action: 'month.closed', entityType: 'monthly_closing', entityId: month, afterData: snapshot
  }));
  await assertFails(memberBatch.commit());

  const adminDb = env.authenticatedContext('admin').firestore();
  const adminClosing = { ...closing, closed_by: 'admin' };
  const adminBatch = writeBatch(adminDb);
  adminBatch.set(doc(adminDb, 'rooms', 'room1', 'closings', month), adminClosing);
  adminBatch.set(doc(collection(adminDb, 'rooms', 'room1', 'activity')), sampleLog({
    actorId: 'admin', action: 'month.closed', entityType: 'monthly_closing',
    entityId: month, afterData: snapshot, detail: 'Closed October'
  }));
  await assertSucceeds(adminBatch.commit());
});
