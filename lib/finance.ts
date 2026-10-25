import type { Transaction } from './types';

export function totals(transactions: Transaction[]) {
  return transactions.reduce((result, transaction) => {
    if (transaction.type === 'income') result.income += transaction.amount;
    else result.expenses += transaction.amount;
    result.balance = result.income - result.expenses;
    return result;
  }, { income: 0, expenses: 0, balance: 0 });
}

export function currency(amount: number, currencyCode = 'ILS', locale = 'en') {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(amount);
}

export function csvFromTransactions(transactions: Transaction[]) {
  const header = 'Title,Amount,Type,Category,Date,Note';
  const rows = transactions.map((item) => [item.title, item.amount, item.type, item.category, item.date, item.note ?? ''].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','));
  return [header, ...rows].join('\n');
}
