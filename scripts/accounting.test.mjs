import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRoomAccounting,
  makeMonthClosingSnapshot,
  moneyToCents,
  splitEqually
} from '../src/lib/accounting.mjs';

const sharesFor = (userIds, amount) => {
  const each = amount / userIds.length;
  return userIds.map(user_id => ({ user_id, amount: each }));
};

test('equal split reconciles a Rs. 1,000 meal for four people exactly', () => {
  const split = splitEqually(1000, ['a', 'b', 'c', 'd']);
  assert.deepEqual(split.map(share => share.amount), [250, 250, 250, 250]);
  assert.equal(split.reduce((sum, share) => sum + moneyToCents(share.amount), 0), moneyToCents(1000));
});

test('equal split allocates remaining cents without losing money', () => {
  const split = splitEqually(10, ['a', 'b', 'c']);
  assert.deepEqual(split.map(share => share.amount), [3.34, 3.33, 3.33]);
  assert.equal(split.reduce((sum, share) => sum + moneyToCents(share.amount), 0), moneyToCents(10));
});

test('split ignores duplicate participant IDs and rejects empty lists or sub-cent totals', () => {
  assert.deepEqual(splitEqually(10, ['a', 'a', 'b']).map(share => share.user_id), ['a', 'b']);
  assert.throws(() => splitEqually(10, []), /participant/i);
  assert.throws(() => splitEqually(0.004, ['a']), /cent/i);
});

test('room debt is expenses minus canteen payments; reimbursements do not change canteen debt', () => {
  const expenses = [
    { total_amount: 1000, meal_date: '2026-09-12', month_key: '2026-09-01', shares: [{ user_id: 'a', amount: 500 }, { user_id: 'b', amount: 500 }] },
    { total_amount: 500, meal_date: '2026-10-05', month_key: '2026-10-01', shares: [{ user_id: 'a', amount: 250 }, { user_id: 'b', amount: 250 }] }
  ];
  const payments = [
    { amount: 100, paid_by: 'b', payment_date: '2026-09-20', month_key: '2026-09-01' },
    { amount: 300, paid_by: 'b', payment_date: '2026-10-08', month_key: '2026-10-01' },
    { amount: 120, paid_by: 'b', payment_date: '2026-10-09', month_key: '2026-10-01', is_deleted: true }
  ];
  const reimbursements = [
    { amount: 100, from_member: 'a', to_member: 'b' },
    { amount: 500, from_member: 'a', to_member: 'b', is_deleted: true }
  ];

  const a = calculateRoomAccounting({ expenses, payments, reimbursements, currentUserId: 'a', monthKey: '2026-10-01' });
  const b = calculateRoomAccounting({ expenses, payments, reimbursements, currentUserId: 'b', monthKey: '2026-10-01' });

  assert.equal(a.roomDebt, 1100);
  assert.equal(b.roomDebt, 1100);
  assert.equal(a.thisMonthExpenses, 500);
  assert.equal(a.thisMonthPayments, 300);
  assert.equal(a.ownShare, 750);
  assert.equal(a.ownSent, 100);
  assert.equal(a.ownNet, 650);
  assert.equal(b.ownPaid, 400);
  assert.equal(b.ownReceived, 100);
  assert.equal(b.ownNet, 450);
});

test('month close snapshot separates monthly activity from carried room debt and ignores deleted entries', () => {
  const expenses = [
    { total_amount: 1000, meal_date: '2026-09-12', month_key: '2026-09-01' },
    { total_amount: 500, meal_date: '2026-10-05' },
    { total_amount: 90, meal_date: '2026-10-06', month_key: '2026-10-01', is_deleted: true }
  ];
  const payments = [
    { amount: 100, payment_date: '2026-09-20', month_key: '2026-09-01' },
    { amount: 300, payment_date: '2026-10-08' },
    { amount: 80, payment_date: '2026-10-09', month_key: '2026-10-01', is_deleted: true }
  ];
  const snapshot = makeMonthClosingSnapshot({
    expenses,
    payments,
    monthKey: '2026-10-01',
    remaining: 1100
  });
  assert.deepEqual(snapshot, {
    expense_total: 500,
    payment_total: 300,
    monthly_net: 200,
    remaining: 1100
  });
});
