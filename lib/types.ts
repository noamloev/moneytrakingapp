export type Currency = 'ILS' | 'USD' | 'EUR';
export type Category = 'Food' | 'Home' | 'Transport' | 'Fun' | 'Health' | 'Shopping' | 'Income';

export type Transaction = {
  id?: number;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  category: Category;
  date: string;
  note?: string;
};

export type Goal = {
  id?: number;
  title: string;
  target: number;
  saved: number;
  emoji: string;
  color: string;
  dueDate?: string;
};

export type Budget = { id?: number; category: Category; limit: number; spent: number };

export type Challenge = {
  id?: number;
  title: string;
  endsAt: string;
  progress: number;
  active: boolean;
};

export type PurchaseAnalysis = {
  id?: number;
  item: string;
  price: number;
  decision: 'wait' | 'bought' | 'skipped';
  createdAt: string;
  cooldownUntil?: string;
  reason?: string;
};

export type AppSettings = {
  id: 'settings';
  name: string;
  currency: Currency;
  locale: 'en' | 'he';
  theme: 'light' | 'dark' | 'system';
  monthlyIncome: number;
  onboardingComplete: boolean;
};

export type FinancialHistory = {
  id?: number;
  month: string;
  income: number;
  expenses: number;
  saved: number;
};

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  encrypted?: boolean;
  tables: {
    transactions: Transaction[];
    goals: Goal[];
    budgets: Budget[];
    challenges: Challenge[];
    analyses: PurchaseAnalysis[];
    history: FinancialHistory[];
  };
  settings: AppSettings;
};
