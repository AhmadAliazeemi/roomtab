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
export interface RoomAccountingSummary {
  thisMonthExpenses: number;
  thisMonthPayments: number;
  totalExpenses: number;
  totalPayments: number;
  roomDebt: number;
  ownShare: number;
  ownPaid: number;
  ownReceived: number;
  ownSent: number;
  ownNet: number;
}
export function moneyToCents(value: number | string): number;
export function centsToMoney(cents: number): number;
export function splitEqually(total: number, participantIds: string[]): AccountingShare[];
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
