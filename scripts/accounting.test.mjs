import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRoomAccounting,
  calculateMemberBalances,
  calculatePaymentAllocations,
  makeMonthClosingSnapshot,
  moneyToCents,
  maximumCanteenPayment,
  validateCanteenPayment,
  validateExpenseBalanceChange,
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
  assert.equal(a.ownNet, 550);
  assert.equal(b.ownPaid, 200);
  assert.equal(b.ownReceived, 100);
  assert.equal(b.ownNet, 550);
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


test('canteen payments allow partial and exact payments but reject amounts above the room balance', () => {
  assert.equal(maximumCanteenPayment(2000), 2000);
  assert.equal(validateCanteenPayment({ roomDebt: 2000, amount: 500 }), 500);
  assert.equal(validateCanteenPayment({ roomDebt: 2000, amount: 2000 }), 2000);
  assert.throws(
    () => validateCanteenPayment({ roomDebt: 2000, amount: 2000.01 }),
    /cannot be higher than the outstanding canteen balance/i
  );
});

test('editing a canteen payment can replace its existing amount without creating extra room debt', () => {
  assert.equal(maximumCanteenPayment(2000, 700), 2700);
  assert.equal(validateCanteenPayment({ roomDebt: 2000, amount: 2700, existingPaymentAmount: 700 }), 2700);
  assert.throws(
    () => validateCanteenPayment({ roomDebt: 2000, amount: 2700.01, existingPaymentAmount: 700 }),
    /cannot be higher than the outstanding canteen balance/i
  );
});

test('no new canteen payment is allowed when the room is already settled', () => {
  assert.equal(maximumCanteenPayment(0), 0);
  assert.equal(maximumCanteenPayment(-50), 0);
  assert.throws(
    () => validateCanteenPayment({ roomDebt: 0, amount: 0.01 }),
    /only owes Rs\. 0\.00/i
  );
});


test('meal corrections and deletions cannot make recorded canteen payments exceed food expenses', () => {
  assert.equal(validateExpenseBalanceChange({ roomDebt: 500, previousAmount: 200, nextAmount: 100 }), 400);
  assert.equal(validateExpenseBalanceChange({ roomDebt: 500, previousAmount: 500, nextAmount: 0 }), 0);
  assert.throws(
    () => validateExpenseBalanceChange({ roomDebt: 100, previousAmount: 200, nextAmount: 0 }),
    /correct the canteen payment first/i
  );
  assert.throws(
    () => validateExpenseBalanceChange({ roomDebt: 100, previousAmount: 300, nextAmount: 100 }),
    /correct the canteen payment first/i
  );
});

test('canteen payment allocation reduces the selected roommates debts, not the physical payer balance', () => {
  const expenses = [{ total_amount: 1000, shares: [{ user_id: 'a', amount: 600 }, { user_id: 'b', amount: 400 }] }];
  const payments = [{ amount: 400, paid_by: 'a', allocations: [{ user_id: 'b', amount: 400 }] }];
  const a = calculateRoomAccounting({ expenses, payments, currentUserId: 'a' });
  const b = calculateRoomAccounting({ expenses, payments, currentUserId: 'b' });
  assert.equal(a.roomDebt, 600);
  assert.equal(a.ownNet, 600);
  assert.equal(a.ownPaid, 0);
  assert.equal(b.ownNet, 0);
  assert.equal(b.ownPaid, 400);
});

test('full payment allocation settles each selected roommate by their exact outstanding debt', () => {
  const memberBalances = [{ user_id: 'a', outstanding: 600 }, { user_id: 'b', outstanding: 400 }, { user_id: 'c', outstanding: 300 }];
  assert.deepEqual(calculatePaymentAllocations({ amount: 1300, selectedMemberIds: ['a', 'b', 'c'], memberBalances }), [
    { user_id: 'a', amount: 600 }, { user_id: 'b', amount: 400 }, { user_id: 'c', amount: 300 }
  ]);
});

test('partial payments are distributed proportionally across selected roommates debts', () => {
  const memberBalances = [{ user_id: 'a', outstanding: 600 }, { user_id: 'b', outstanding: 400 }, { user_id: 'c', outstanding: 300 }];
  assert.deepEqual(calculatePaymentAllocations({ amount: 500, selectedMemberIds: ['a', 'b'], memberBalances }), [
    { user_id: 'a', amount: 300 }, { user_id: 'b', amount: 200 }
  ]);
});

test('partial allocation distributes remaining cents deterministically and rejects excess', () => {
  const memberBalances = [{ user_id: 'a', outstanding: 1 }, { user_id: 'b', outstanding: 1 }, { user_id: 'c', outstanding: 1 }];
  assert.deepEqual(calculatePaymentAllocations({ amount: 1, selectedMemberIds: ['c', 'b', 'a'], memberBalances }), [
    { user_id: 'a', amount: 0.34 }, { user_id: 'b', amount: 0.33 }, { user_id: 'c', amount: 0.33 }
  ]);
  assert.throws(() => calculatePaymentAllocations({ amount: 301, selectedMemberIds: ['a', 'b'], memberBalances }), /select more roommates or reduce the payment/i);
  assert.throws(() => calculatePaymentAllocations({ amount: 1, selectedMemberIds: [], memberBalances }), /select at least one roommate/i);
});

test('legacy payments without allocations are distributed across outstanding roommate debts', () => {
  const result = calculateMemberBalances({
    expenses: [{ total_amount: 1000, shares: [{ user_id: 'a', amount: 600 }, { user_id: 'b', amount: 400 }] }],
    payments: [{ amount: 500, paid_by: 'a' }]
  });
  assert.deepEqual(result, [
    { user_id: 'a', share: 600, paid: 300, outstanding: 300 },
    { user_id: 'b', share: 400, paid: 200, outstanding: 200 }
  ]);
});
