export interface AccountingShare {
  user_id: string;
  amount: number;
}
export interface AccountingExpense {
  total_amount: number;
  shares?: AccountingShare[];
  is_deleted?: boolean;
  month_key?: string;
  meal_date?: string;
}
export interface AccountingPayment {
  amount: number;
  allocations?: AccountingShare[];
  paid_by?: string;
  is_deleted?: boolean;
  month_key?: string;
  payment_date?: string;
}
export interface AccountingReimbursement {
  amount: number;
  from_member?: string;
  to_member?: string;
  is_deleted?: boolean;
}
export interface MemberAccountingBalance {
  user_id: string;
  share: number;
  paid: number;
  outstanding: number;
}
export interface RoomAccountingSummary {
  thisMonthExpenses: number;
  thisMonthPayments: number;
  totalExpenses: number;
  totalPayments: number;
  roomDebt: number;
  memberBalances: MemberAccountingBalance[];
  ownShare: number;
  ownPaid: number;
  ownReceived: number;
  ownSent: number;
  ownNet: number;
}
export function moneyToCents(value: number | string): number;
export function centsToMoney(cents: number): number;
export function maximumCanteenPayment(roomDebt: number, existingPaymentAmount?: number): number;
export function validateCanteenPayment(args: {
  roomDebt: number;
  amount: number;
  existingPaymentAmount?: number;
}): number;
export function validateExpenseBalanceChange(args: {
  roomDebt: number;
  previousAmount?: number;
  nextAmount?: number;
}): number;
export function splitEqually(total: number, participantIds: string[]): AccountingShare[];
export function calculateMemberBalances(args?: {
  expenses?: AccountingExpense[];
  payments?: AccountingPayment[];
}): MemberAccountingBalance[];
export function calculatePaymentAllocations(args: {
  amount: number;
  selectedMemberIds: string[];
  memberBalances: Array<{ user_id: string; outstanding: number }>;
}): AccountingShare[];
export function calculateRoomAccounting(args: {
  expenses?: AccountingExpense[];
  payments?: AccountingPayment[];
  reimbursements?: AccountingReimbursement[];
  currentUserId?: string;
  monthKey?: string;
}): RoomAccountingSummary;
export function makeMonthClosingSnapshot(args: {
  expenses?: AccountingExpense[];
  payments?: AccountingPayment[];
  monthKey: string;
  remaining: number;
}): { expense_total: number; payment_total: number; monthly_net: number; remaining: number };
