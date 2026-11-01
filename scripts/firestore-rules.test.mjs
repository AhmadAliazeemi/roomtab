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
    await setDoc(doc(db, 'rooms', 'room1', 'members', 'other'), {
      user_id: 'other', display_name: 'Other', email: 'other@example.com',
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

async function enableMealConfirmation() {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'rooms', 'room1'), { require_meal_confirmation: true });
  });
}

function sampleConfirmationExpense(overrides = {}) {
  return sampleExpense({
    id: 'confirmation-meal',
    shares: [{ user_id: 'member', amount: 5 }, { user_id: 'other', amount: 5 }],
    confirmation_required: true,
    confirmation_version: 1,
    confirmation_round_id: 'round-v1',
    ...overrides
  });
}

function sampleConfirmationRound(expense, overrides = {}) {
  return {
    id: expense.confirmation_round_id,
    room_id: 'room1',
    expense_id: expense.id,
    version: expense.confirmation_version,
    created_by: expense.created_by,
    created_at: timestamp,
    total_amount: expense.total_amount,
    meal_date: expense.meal_date,
    shares: expense.shares,
    ...overrides
  };
}

async function writeConfirmationMeal(expense, responseOverrides = {}) {
  const db = env.authenticatedContext(expense.created_by).firestore();
  const round = sampleConfirmationRound(expense);
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id), expense);
  batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', round.id), round);
  for (const share of expense.shares) {
    const isCreator = share.user_id === expense.created_by;
    const response = {
      room_id: 'room1',
      expense_id: expense.id,
      round_id: round.id,
      version: round.version,
      user_id: share.user_id,
      requested_by: expense.created_by,
      status: isCreator ? 'approved' : 'pending',
      dispute_reason: '',
      created_at: timestamp,
      responded_at: isCreator ? timestamp : null,
      responded_by: isCreator ? expense.created_by : null,
      ...(responseOverrides[share.user_id] || {})
    };
    batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', round.id, 'responses', share.user_id), response);
    if (isCreator) {
      const activityId = `meal-confirmation-${round.id}-${share.user_id}`;
      batch.set(doc(db, 'rooms', 'room1', 'activity', activityId), sampleLog({
        actorId: expense.created_by,
        action: 'meal.confirmation_approved',
        entityType: 'meal_confirmation',
        entityId: activityId,
        beforeData: null,
        afterData: response,
        detail: 'Confirmed own participation in meal'
      }));
    }
  }
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    actorId: expense.created_by,
    action: 'expense.created',
    entityType: 'expense',
    entityId: expense.id,
    afterData: expense
  }));
  return batch.commit();
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

test('expense shares must reconcile to the exact cent and use active unique members', async () => {
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

  const activeCentExactSplit = sampleExpense({
    id: 'active-cent-exact-split',
    total_amount: 10,
    shares: [
      { user_id: 'admin', amount: 3.34 },
      { user_id: 'member', amount: 3.33 },
      { user_id: 'other', amount: 3.33 }
    ]
  });
  await assertSucceeds(setExpenseAndLog(activeCentExactSplit));

  const duplicateParticipant = sampleExpense({
    id: 'duplicate-participant',
    total_amount: 10,
    shares: [
      { user_id: 'member', amount: 5 },
      { user_id: 'member', amount: 5 }
    ]
  });
  await assertFails(setExpenseAndLog(duplicateParticipant));
});

test('meal and payment month keys must match their dates', async () => {
  const mismatchedExpense = sampleExpense({
    id: 'mismatched-expense-month',
    meal_date: '2026-09-15',
    month_key: '2026-10-01'
  });
  await assertFails(setExpenseAndLog(mismatchedExpense));

  const db = env.authenticatedContext('member').firestore();
  const mismatchedPayment = samplePayment({
    id: 'mismatched-payment-month',
    payment_date: '2026-09-15',
    month_key: '2026-10-01'
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', 'room1', 'payments', mismatchedPayment.id), mismatchedPayment);
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    action: 'payment.recorded',
    entityType: 'canteen_payment',
    entityId: mismatchedPayment.id,
    afterData: mismatchedPayment
  }));
  await assertFails(batch.commit());
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


test('meal confirmation must be enabled by the room and is only an admin setting', async () => {
  const memberDb = env.authenticatedContext('member').firestore();
  const memberBatch = writeBatch(memberDb);
  memberBatch.update(doc(memberDb, 'rooms', 'room1'), { require_meal_confirmation: true });
  memberBatch.set(doc(memberDb, 'rooms', 'room1', 'activity', 'member-enabled-confirmation'), sampleLog({
    actorId: 'member',
    action: 'room.meal_confirmation_setting_changed',
    entityType: 'room',
    entityId: 'room1',
    beforeData: false,
    afterData: true
  }));
  await assertFails(memberBatch.commit());

  const adminDb = env.authenticatedContext('admin').firestore();
  const adminBatch = writeBatch(adminDb);
  adminBatch.update(doc(adminDb, 'rooms', 'room1'), { require_meal_confirmation: true });
  adminBatch.set(doc(adminDb, 'rooms', 'room1', 'activity', 'admin-enabled-confirmation'), sampleLog({
    actorId: 'admin',
    action: 'room.meal_confirmation_setting_changed',
    entityType: 'room',
    entityId: 'room1',
    beforeData: false,
    afterData: true
  }));
  await assertSucceeds(adminBatch.commit());
});

test('a room requiring meal confirmation rejects an expense without a matching immutable round', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense({ id: 'missing-confirmation-round' });
  await assertFails(setExpenseAndLog(expense));
});

test('a meal and its confirmation round are created atomically with creator approval and other participants pending', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('other').firestore();
  const creatorResponse = await assertSucceeds(getDoc(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'member')));
  const otherResponse = await assertSucceeds(getDoc(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'other')));
  assert.equal(creatorResponse.data().status, 'approved');
  assert.equal(otherResponse.data().status, 'pending');
});

test('a meal creator cannot create an approval on behalf of another selected roommate', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertFails(writeConfirmationMeal(expense, {
    other: {
      status: 'approved',
      responded_at: timestamp,
      responded_by: 'member',
      dispute_reason: ''
    }
  }));
});

test('only the selected participant can approve their own pending response with an audit event', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('other').firestore();
  const responseRef = doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'other');
  const before = (await getDoc(responseRef)).data();
  const after = {
    ...before,
    status: 'approved',
    responded_at: '2026-10-28T12:30:00.000Z',
    responded_by: 'other',
    dispute_reason: ''
  };
  const activityId = 'meal-confirmation-round-v1-other';
  const batch = writeBatch(db);
  batch.update(responseRef, {
    status: 'approved',
    responded_at: after.responded_at,
    responded_by: 'other',
    dispute_reason: ''
  });
  batch.set(doc(db, 'rooms', 'room1', 'activity', activityId), sampleLog({
    actorId: 'other',
    action: 'meal.confirmation_approved',
    entityType: 'meal_confirmation',
    entityId: activityId,
    beforeData: before,
    afterData: after,
    detail: 'Confirmed participation in meal'
  }));
  await assertSucceeds(batch.commit());
});


test('a selected participant can dispute their own share and the reason is audited', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('other').firestore();
  const responseRef = doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'other');
  const before = (await getDoc(responseRef)).data();
  const after = {
    ...before,
    status: 'disputed',
    dispute_reason: 'I was not present for this meal.',
    responded_at: '2026-10-28T12:30:00.000Z',
    responded_by: 'other'
  };
  const activityId = 'meal-confirmation-round-v1-other';
  const batch = writeBatch(db);
  batch.update(responseRef, {
    status: 'disputed',
    dispute_reason: after.dispute_reason,
    responded_at: after.responded_at,
    responded_by: 'other'
  });
  batch.set(doc(db, 'rooms', 'room1', 'activity', activityId), sampleLog({
    actorId: 'other',
    action: 'meal.confirmation_disputed',
    entityType: 'meal_confirmation',
    entityId: activityId,
    beforeData: before,
    afterData: after,
    detail: 'Disputed participation in meal'
  }));
  await assertSucceeds(batch.commit());
  const saved = await getDoc(responseRef);
  assert.equal(saved.data().status, 'disputed');
  assert.equal(saved.data().dispute_reason, 'I was not present for this meal.');
});

test('a participant cannot approve or dispute without an atomic audit record', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('other').firestore();
  const responseRef = doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'other');
  await assertFails(updateDoc(responseRef, {
    status: 'approved',
    responded_at: '2026-10-28T12:30:00.000Z',
    responded_by: 'other',
    dispute_reason: ''
  }));
});

test('a material meal correction creates a new confirmation round and preserves the old one', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('member').firestore();
  const expenseRef = doc(db, 'rooms', 'room1', 'expenses', expense.id);
  const before = (await getDoc(expenseRef)).data();
  const now = '2026-10-28T13:00:00.000Z';
  const updated = {
    ...before,
    total_amount: 12,
    updated_at: now,
    confirmation_version: 2,
    confirmation_round_id: 'round-v2',
    shares: [{ user_id: 'member', amount: 6 }, { user_id: 'other', amount: 6 }]
  };
  const round = sampleConfirmationRound(updated, {
    id: 'round-v2',
    version: 2,
    created_at: now
  });
  const batch = writeBatch(db);
  batch.update(expenseRef, {
    total_amount: updated.total_amount,
    updated_at: now,
    confirmation_version: 2,
    confirmation_round_id: 'round-v2',
    shares: updated.shares
  });
  batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v2'), round);
  for (const share of updated.shares) {
    const isCreator = share.user_id === 'member';
    const response = {
      room_id: 'room1',
      expense_id: expense.id,
      round_id: 'round-v2',
      version: 2,
      user_id: share.user_id,
      requested_by: 'member',
      status: isCreator ? 'approved' : 'pending',
      dispute_reason: '',
      created_at: now,
      responded_at: isCreator ? now : null,
      responded_by: isCreator ? 'member' : null
    };
    batch.set(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v2', 'responses', share.user_id), response);
    if (isCreator) {
      const activityId = 'meal-confirmation-round-v2-member';
      batch.set(doc(db, 'rooms', 'room1', 'activity', activityId), sampleLog({
        actorId: 'member',
        action: 'meal.confirmation_approved',
        entityType: 'meal_confirmation',
        entityId: activityId,
        beforeData: null,
        afterData: response,
        detail: 'Confirmed own participation in corrected meal'
      }));
    }
  }
  batch.set(doc(collection(db, 'rooms', 'room1', 'activity')), sampleLog({
    actorId: 'member',
    action: 'expense.updated',
    entityType: 'expense',
    entityId: expense.id,
    beforeData: before,
    afterData: updated,
    detail: 'Corrected meal amount and shares'
  }));
  await assertSucceeds(batch.commit());

  const oldRound = await getDoc(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1'));
  const newRound = await getDoc(doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v2'));
  assert.equal(oldRound.exists(), true);
  assert.equal(newRound.data().total_amount, 12);
  assert.equal(newRound.data().version, 2);
});

test('a roommate not selected for a meal cannot create or change a confirmation response', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense({
    id: 'meal-without-admin',
    shares: [{ user_id: 'member', amount: 10 }]
  });
  await assertSucceeds(writeConfirmationMeal(expense));

  const db = env.authenticatedContext('admin').firestore();
  const responseRef = doc(db, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1', 'responses', 'admin');
  await assertFails(setDoc(responseRef, {
    room_id: 'room1', expense_id: expense.id, round_id: 'round-v1', version: 1,
    user_id: 'admin', requested_by: 'member', status: 'approved',
    dispute_reason: '', created_at: timestamp, responded_at: timestamp, responded_by: 'admin'
  }));
});

test('confirmation rounds are immutable and only active room members can read them', async () => {
  await enableMealConfirmation();
  const expense = sampleConfirmationExpense();
  await assertSucceeds(writeConfirmationMeal(expense));

  const memberDb = env.authenticatedContext('other').firestore();
  await assertFails(updateDoc(doc(memberDb, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1'), {
    total_amount: 999
  }));

  const strangerDb = env.authenticatedContext('stranger').firestore();
  await assertFails(getDoc(doc(strangerDb, 'rooms', 'room1', 'expenses', expense.id, 'confirmationRounds', 'round-v1')));
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
