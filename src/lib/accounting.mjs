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

export function maximumCanteenPayment(roomDebt, existingPaymentAmount = 0) {
  const availableCents = moneyToCents(roomDebt) + moneyToCents(existingPaymentAmount);
  return centsToMoney(Math.max(0, availableCents));
}

export function validateCanteenPayment({ roomDebt, amount, existingPaymentAmount = 0 }) {
  const paymentCents = moneyToCents(amount);
  if (paymentCents <= 0) {
    throw new RangeError('The canteen payment must be at least Rs. 0.01.');
  }

  const maximumCents = moneyToCents(maximumCanteenPayment(roomDebt, existingPaymentAmount));
  if (paymentCents > maximumCents) {
    throw new RangeError(
      `The room only owes Rs. ${centsToMoney(maximumCents).toFixed(2)}. A payment cannot be higher than the outstanding canteen balance.`
    );
  }

  return centsToMoney(paymentCents);
}

export function validateExpenseBalanceChange({ roomDebt, previousAmount = 0, nextAmount = 0 }) {
  const nextDebtCents = moneyToCents(roomDebt) - moneyToCents(previousAmount) + moneyToCents(nextAmount);
  if (nextDebtCents < 0) {
    throw new RangeError(
      'This change would make canteen payments higher than recorded food expenses. Correct the canteen payment first.'
    );
  }
  return centsToMoney(nextDebtCents);
}


function distributeProportionally(totalCents, weightedItems) {
  const validItems = weightedItems.filter(item => item.weightCents > 0);
  const totalWeight = validItems.reduce((sum, item) => sum + item.weightCents, 0);
  if (totalCents <= 0 || totalWeight <= 0 || validItems.length === 0) return new Map();

  const allocations = validItems.map(item => {
    const numerator = totalCents * item.weightCents;
    const baseCents = Math.floor(numerator / totalWeight);
    return { user_id: item.user_id, cents: baseCents, remainder: numerator % totalWeight };
  });
  let centsLeft = totalCents - allocations.reduce((sum, item) => sum + item.cents, 0);
  allocations.sort((a, b) => b.remainder - a.remainder || a.user_id.localeCompare(b.user_id));
  for (let index = 0; centsLeft > 0; index = (index + 1) % allocations.length) {
    allocations[index].cents += 1;
    centsLeft -= 1;
  }
  return new Map(allocations.filter(item => item.cents > 0).map(item => [item.user_id, item.cents]));
}

export function calculateMemberBalances({ expenses = EMPTY_LIST, payments = EMPTY_LIST } = {}) {
  const sharesByMember = new Map();
  const paidByMember = new Map();
  const events = [
    ...active(expenses).map(item => ({
      type: 'expense',
      date: item.meal_date || '',
      createdAt: item.created_at || '',
      id: item.id || '',
      item
    })),
    ...active(payments).map(item => ({
      type: 'payment',
      date: item.payment_date || '',
      createdAt: item.created_at || '',
      id: item.id || '',
      item
    }))
  ].sort((a, b) =>
    a.date.localeCompare(b.date)
    || a.createdAt.localeCompare(b.createdAt)
    || (a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1)
    || a.id.localeCompare(b.id)
  );

  for (const event of events) {
    if (event.type === 'expense') {
      for (const share of event.item.shares || EMPTY_LIST) {
        if (!share || typeof share.user_id !== 'string' || !share.user_id) continue;
        const value = Number(share.amount);
        if (!Number.isFinite(value)) continue;
        sharesByMember.set(share.user_id, (sharesByMember.get(share.user_id) || 0) + moneyToCents(value));
      }
      continue;
    }

    const payment = event.item;
    if (Array.isArray(payment.allocations) && payment.allocations.length > 0) {
      for (const allocation of payment.allocations) {
        if (!allocation || typeof allocation.user_id !== 'string' || !allocation.user_id) continue;
        const value = Number(allocation.amount);
        if (!Number.isFinite(value)) continue;
        paidByMember.set(
          allocation.user_id,
          (paidByMember.get(allocation.user_id) || 0) + moneyToCents(value)
        );
      }
      continue;
    }

    // Legacy payments did not record beneficiaries. Allocate them across
    // the debts that existed on the payment date, not future meal entries.
    const value = Number(payment.amount);
    if (!Number.isFinite(value)) continue;
    const weights = Array.from(sharesByMember.entries()).map(([user_id, shareCents]) => ({
      user_id,
      weightCents: Math.max(0, shareCents - (paidByMember.get(user_id) || 0))
    })).filter(item => item.weightCents > 0);
    const availableCents = weights.reduce((sum, item) => sum + item.weightCents, 0);
    const allocation = distributeProportionally(Math.min(moneyToCents(value), availableCents), weights);
    for (const [user_id, cents] of allocation) {
      paidByMember.set(user_id, (paidByMember.get(user_id) || 0) + cents);
    }
  }

  const memberIds = new Set([...sharesByMember.keys(), ...paidByMember.keys()]);
  return Array.from(memberIds).sort((a, b) => a.localeCompare(b)).map(user_id => {
    const shareCents = sharesByMember.get(user_id) || 0;
    const paidCents = paidByMember.get(user_id) || 0;
    const outstandingCents = Math.max(0, shareCents - paidCents);
    return {
      user_id,
      share: centsToMoney(shareCents),
      paid: centsToMoney(shareCents - outstandingCents),
      outstanding: centsToMoney(outstandingCents)
    };
  });
}

export function calculatePaymentAllocations({ amount, selectedMemberIds, memberBalances = EMPTY_LIST }) {
  const amountCents = moneyToCents(amount);
  if (amountCents <= 0) throw new RangeError('The payment must be at least Rs. 0.01.');
  if (!Array.isArray(selectedMemberIds)) throw new TypeError('Select the roommates whose debts this payment will settle.');

  const balanceById = new Map(memberBalances.map(item => [item.user_id, moneyToCents(item.outstanding || 0)]));
  const selectedIds = Array.from(new Set(selectedMemberIds.filter(id => typeof id === 'string' && id.trim())));
  const selected = selectedIds
    .map(user_id => ({ user_id, weightCents: balanceById.get(user_id) || 0 }))
    .filter(item => item.weightCents > 0);
  const selectedDebtCents = selected.reduce((sum, item) => sum + item.weightCents, 0);

  if (selected.length === 0) {
    throw new RangeError('Select at least one roommate who still owes money to the canteen.');
  }
  if (selected.length > 6) throw new RangeError('A payment can cover up to 6 roommates at once.');
  if (amountCents > selectedDebtCents) {
    throw new RangeError(
      'The selected roommates owe only Rs. ' + centsToMoney(selectedDebtCents).toFixed(2) + '. Select more roommates or reduce the payment amount.'
    );
  }

  const allocation = distributeProportionally(amountCents, selected);
  return Array.from(allocation.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([user_id, cents]) => ({ user_id, amount: centsToMoney(cents) }));
}

export function calculateRoomAccounting({ expenses = EMPTY_LIST, payments = EMPTY_LIST, reimbursements = EMPTY_LIST, currentUserId = '', monthKey = '' }) {
  const allActiveExpenses = active(expenses);
  const allActivePayments = active(payments);
  const allActiveReimbursements = active(reimbursements);

  const totalExpenseCents = amountCents(allActiveExpenses, 'total_amount');
  const totalPaymentCents = amountCents(allActivePayments, 'amount');
  const thisMonthExpenseCents = amountCents(allActiveExpenses.filter(item => belongsToMonth(item, monthKey, 'meal_date')), 'total_amount');
  const thisMonthPaymentCents = amountCents(allActivePayments.filter(item => belongsToMonth(item, monthKey, 'payment_date')), 'amount');

  const memberBalances = calculateMemberBalances({ expenses: allActiveExpenses, payments: allActivePayments });
  const ownBalance = memberBalances.find(item => item.user_id === currentUserId);
  const ownShareCents = ownBalance ? moneyToCents(ownBalance.share) : 0;
  const ownPaidCents = ownBalance ? moneyToCents(ownBalance.paid) : 0;
  const ownReceivedCents = amountCents(allActiveReimbursements.filter(item => item.to_member === currentUserId), 'amount');
  const ownSentCents = amountCents(allActiveReimbursements.filter(item => item.from_member === currentUserId), 'amount');

  return {
    thisMonthExpenses: centsToMoney(thisMonthExpenseCents),
    thisMonthPayments: centsToMoney(thisMonthPaymentCents),
    totalExpenses: centsToMoney(totalExpenseCents),
    totalPayments: centsToMoney(totalPaymentCents),
    roomDebt: centsToMoney(totalExpenseCents - totalPaymentCents),
    memberBalances,
    ownShare: centsToMoney(ownShareCents),
    ownPaid: centsToMoney(ownPaidCents),
    ownReceived: centsToMoney(ownReceivedCents),
    ownSent: centsToMoney(ownSentCents),
    ownNet: centsToMoney(ownBalance ? moneyToCents(ownBalance.outstanding) : 0)
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
