import Dexie, { type Table } from 'dexie';
import type { AppSettings, BackupPayload, Budget, Challenge, FinancialHistory, Goal, PurchaseAnalysis, Transaction } from './types';

class BuyByeDatabase extends Dexie {
  transactions!: Table<Transaction, number>;
  goals!: Table<Goal, number>;
  budgets!: Table<Budget, number>;
  challenges!: Table<Challenge, number>;
  analyses!: Table<PurchaseAnalysis, number>;
  history!: Table<FinancialHistory, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('buybye-local');
    this.version(1).stores({
      transactions: '++id, date, category, type',
      goals: '++id',
      budgets: '++id, category',
      challenges: '++id, active',
      analyses: '++id, createdAt, decision',
      history: '++id, month',
      settings: 'id'
    });
  }
}

export const db = new BuyByeDatabase();

export const defaultSettings: AppSettings = {
  id: 'settings', name: 'You', currency: 'ILS', locale: 'en', theme: 'light', monthlyIncome: 0, onboardingComplete: true
};

export async function ensureSeedData() {
  const settings = await db.settings.get('settings');
  if (!settings) await db.settings.put(defaultSettings);
}

export async function clearAllData() {
  await db.transaction('rw', [db.transactions, db.goals, db.budgets, db.challenges, db.analyses, db.history, db.settings], async () => {
    await Promise.all([
      db.transactions.clear(), db.goals.clear(), db.budgets.clear(), db.challenges.clear(), db.analyses.clear(), db.history.clear(), db.settings.clear()
    ]);
    await db.settings.put(defaultSettings);
  });
}

export async function getBackupPayload(): Promise<BackupPayload> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      transactions: await db.transactions.toArray(),
      goals: await db.goals.toArray(),
      budgets: await db.budgets.toArray(),
      challenges: await db.challenges.toArray(),
      analyses: await db.analyses.toArray(),
      history: await db.history.toArray()
    },
    settings: (await db.settings.get('settings')) ?? defaultSettings
  };
}

export async function restoreBackup(payload: BackupPayload) {
  await db.transaction('rw', [db.transactions, db.goals, db.budgets, db.challenges, db.analyses, db.history, db.settings], async () => {
    await Promise.all([
      db.transactions.clear(), db.goals.clear(), db.budgets.clear(), db.challenges.clear(), db.analyses.clear(), db.history.clear(), db.settings.clear()
    ]);
    await db.transactions.bulkAdd(payload.tables.transactions.map(({ id, ...item }) => item));
    await db.goals.bulkAdd(payload.tables.goals.map(({ id, ...item }) => item));
    await db.budgets.bulkAdd(payload.tables.budgets.map(({ id, ...item }) => item));
    await db.challenges.bulkAdd(payload.tables.challenges.map(({ id, ...item }) => item));
    await db.analyses.bulkAdd(payload.tables.analyses.map(({ id, ...item }) => item));
    await db.history.bulkAdd(payload.tables.history.map(({ id, ...item }) => item));
    await db.settings.put(payload.settings);
  });
}
