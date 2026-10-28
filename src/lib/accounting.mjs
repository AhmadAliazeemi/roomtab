const EMPTY_LIST = [];

export function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new TypeError('Money values must be finite numbers.');
  }
  return Math.round((amount + Math.sign(amount) * Number.EPSILON) * 100);
}

export function centsToMoney(cents) {
  if (!Number.isInteger(cents)) {
    throw new TypeError('Cents must be an integer.');
  }
  return cents / 100;
}

function active(items) {
  return (items || EMPTY_LIST).filter(item => item && item.is_deleted !== true);
}

function amountCents(items, field) {
  return items.reduce((sum, item) => {
    const value = Number(item?.[field] ?? 0);
    return sum + (Number.isFinite(value) ? moneyToCents(value) : 0);
  }, 0);
}

function belongsToMonth(item, monthKey, dateField) {
  const itemMonth = item?.month_key || (typeof item?.[dateField] === 'string' ? item[dateField].slice(0, 7) + '-01' : '');
  return itemMonth === monthKey;
}

export function splitEqually(total, participantIds) {
  if (!Array.isArray(participantIds)) {
    throw new TypeError('Participants must be a list of member IDs.');
  }
  const uniqueIds = Array.from(new Set(participantIds.filter(id => typeof id === 'string' && id.trim().length > 0)));
  const totalCents = moneyToCents(total);
  if (totalCents <= 0) {
    throw new RangeError('The total must be at least one cent.');
  }
  if (uniqueIds.length === 0) {
    throw new RangeError('At least one participant is required.');
  }
  const baseCents = Math.floor(totalCents / uniqueIds.length);
  const remainingCents = totalCents % uniqueIds.length;
  return uniqueIds.map((user_id, index) => ({
    user_id,
    amount: centsToMoney(baseCents + (index < remainingCents ? 1 : 0))
  }));
}

export function calculateRoomAccounting({ expenses = EMPTY_LIST, payments = EMPTY_LIST, reimbursements = EMPTY_LIST, currentUserId = '', monthKey = '' }) {
  const allActiveExpenses = active(expenses);
  const allActivePayments = active(payments);
  const allActiveReimbursements = active(reimbursements);

  const totalExpenseCents = amountCents(allActiveExpenses, 'total_amount');
  const totalPaymentCents = amountCents(allActivePayments, 'amount');
  const thisMonthExpenseCents = amountCents(allActiveExpenses.filter(item => belongsToMonth(item, monthKey, 'meal_date')), 'total_amount');
  const thisMonthPaymentCents = amountCents(allActivePayments.filter(item => belongsToMonth(item, monthKey, 'payment_date')), 'amount');

  const ownShareCents = allActiveExpenses.reduce((sum, expense) => {
    return sum + (expense.shares || EMPTY_LIST)
      .filter(share => share?.user_id === currentUserId)
      .reduce((shareSum, share) => {
        const value = Number(share?.amount ?? 0);
        return shareSum + (Number.isFinite(value) ? moneyToCents(value) : 0);
      }, 0);
  }, 0);
  const ownPaidCents = amountCents(allActivePayments.filter(payment => payment.paid_by === currentUserId), 'amount');
  const ownReceivedCents = amountCents(allActiveReimbursements.filter(item => item.to_member === currentUserId), 'amount');
  const ownSentCents = amountCents(allActiveReimbursements.filter(item => item.from_member === currentUserId), 'amount');

  return {
    thisMonthExpenses: centsToMoney(thisMonthExpenseCents),
    thisMonthPayments: centsToMoney(thisMonthPaymentCents),
    totalExpenses: centsToMoney(totalExpenseCents),
    totalPayments: centsToMoney(totalPaymentCents),
    roomDebt: centsToMoney(totalExpenseCents - totalPaymentCents),
    ownShare: centsToMoney(ownShareCents),
    ownPaid: centsToMoney(ownPaidCents),
    ownReceived: centsToMoney(ownReceivedCents),
    ownSent: centsToMoney(ownSentCents),
    ownNet: centsToMoney(ownShareCents - ownPaidCents + ownReceivedCents - ownSentCents)
  };
}

export function makeMonthClosingSnapshot({ expenses = EMPTY_LIST, payments = EMPTY_LIST, monthKey, remaining }) {
  const monthExpenses = active(expenses).filter(item => belongsToMonth(item, monthKey, 'meal_date'));
  const monthPayments = active(payments).filter(item => belongsToMonth(item, monthKey, 'payment_date'));
  const expenseCents = amountCents(monthExpenses, 'total_amount');
  const paymentCents = amountCents(monthPayments, 'amount');
  return {
    expense_total: centsToMoney(expenseCents),
    payment_total: centsToMoney(paymentCents),
    monthly_net: centsToMoney(expenseCents - paymentCents),
    remaining: centsToMoney(moneyToCents(remaining))
  };
}
