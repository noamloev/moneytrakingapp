'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownLeft, ArrowUpRight, BarChart3, Bell, Check, ChevronRight, CircleHelp, Download, FileUp, Flame, Home, Leaf, ListFilter, LockKeyhole, Moon, MoreHorizontal, Plus, Receipt, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, Upload, Wallet, Wifi, WifiOff, X, Zap } from 'lucide-react';
import { z } from 'zod';
import { clearAllData, db, ensureSeedData, getBackupPayload, restoreBackup } from '@/lib/db';
import { currency, csvFromTransactions, totals } from '@/lib/finance';
import type { AppSettings, BackupPayload, Challenge, Goal, PurchaseAnalysis, Transaction } from '@/lib/types';
import { Button, Card, Pill, cn } from '@/components/ui';

type Tab = 'home' | 'transactions' | 'worth' | 'goals' | 'profile';

const tabs: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'transactions', label: 'Activity', icon: Receipt },
  { id: 'worth', label: 'Worth it?', icon: Sparkles },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'profile', label: 'Profile', icon: MoreHorizontal }
];

const categoryColors: Record<string, string> = { Food: '#ee856e', Shopping: '#b29fe9', Transport: '#6ab2c4', Fun: '#f4bb66', Home: '#83b99f', Health: '#e18eaa', Income: '#2b7457' };

const analysisSchema = z.object({
  item: z.string().trim().min(1),
  price: z.coerce.number().positive(),
  decision: z.enum(['wait', 'bought', 'skipped']),
  createdAt: z.string(),
  cooldownUntil: z.string().optional(),
  reason: z.string().optional()
});

function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function greeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function formatDate(date: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }

export default function BuyByeApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [analyses, setAnalyses] = useState<PurchaseAnalysis[]>([]);
  const [history, setHistory] = useState<Array<{ month: string; income: number; expenses: number; saved: number }>>([]);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    await ensureSeedData();
    const [nextTransactions, nextGoals, nextSettings, nextChallenges, nextAnalyses, nextHistory] = await Promise.all([
      db.transactions.orderBy('date').reverse().toArray(), db.goals.toArray(), db.settings.get('settings'), db.challenges.toArray(), db.analyses.orderBy('createdAt').reverse().toArray(), db.history.toArray()
    ]);
    setTransactions(nextTransactions); setGoals(nextGoals); setSettings(nextSettings ?? null); setChallenges(nextChallenges); setAnalyses(nextAnalyses); setHistory(nextHistory); setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const updateNetwork = () => setOffline(!navigator.onLine);
    updateNetwork();
    window.addEventListener('online', updateNetwork); window.addEventListener('offline', updateNetwork);
    return () => { window.removeEventListener('online', updateNetwork); window.removeEventListener('offline', updateNetwork); };
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalsValue = useMemo(() => totals(transactions), [transactions]);
  const currentSettings = settings ?? { id: 'settings' as const, name: 'Noam', currency: 'ILS' as const, locale: 'en' as const, theme: 'light' as const, monthlyIncome: 12000, onboardingComplete: true };
  const money = (amount: number) => currency(amount, currentSettings.currency, currentSettings.locale);

  async function addTransaction(formData: FormData) {
    const type = String(formData.get('type')) as Transaction['type'];
    await db.transactions.add({ title: String(formData.get('title')), amount: Number(formData.get('amount')), type, category: String(formData.get('category')) as Transaction['category'], date: String(formData.get('date')), note: String(formData.get('note') ?? '') });
    setShowTransaction(false); setToast('Transaction saved locally'); refresh();
  }

  async function addGoal(formData: FormData) {
    await db.goals.add({ title: String(formData.get('title')), target: Number(formData.get('target')), saved: 0, emoji: String(formData.get('emoji') || '✨'), color: 'mint', dueDate: String(formData.get('dueDate') || '') });
    setShowGoal(false); setToast('Goal created'); refresh();
  }

  async function saveAnalysis(formData: FormData) {
    const decision = String(formData.get('decision')) as PurchaseAnalysis['decision'];
    const payload = analysisSchema.parse({ item: formData.get('item'), price: formData.get('price'), decision, createdAt: new Date().toISOString(), cooldownUntil: decision === 'wait' ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString() : undefined, reason: formData.get('reason') });
    await db.analyses.add(payload); setToast(decision === 'wait' ? 'A 3-day cooldown is active' : 'Decision saved'); refresh();
  }

  async function toggleChallenge() {
    const challenge = challenges[0];
    if (challenge) await db.challenges.update(challenge.id!, { active: !challenge.active });
    else await db.challenges.add({ title: 'No-buy weekend', endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), progress: 0, active: true });
    setToast('Challenge updated'); refresh();
  }

  async function updateSetting(patch: Partial<AppSettings>) { await db.settings.update('settings', patch); setSettings((previous) => previous ? { ...previous, ...patch } : previous); }

  async function clearLocalData() {
    if (!window.confirm('Clear all local BuyBye data? This cannot be undone unless you have a backup.')) return;
    await clearAllData();
    await refresh();
    setToast('All local data cleared');
  }

  async function exportBackup(encrypted = false) {
    const payload = await getBackupPayload();
    if (!encrypted) { downloadFile(`buybye-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2)); setToast('Backup downloaded'); return; }
    const password = window.prompt('Create a password for this encrypted backup');
    if (!password) return;
    const encoded = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoded.encode(password), 'PBKDF2', false, ['deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded.encode(JSON.stringify(payload)));
    const toBase64 = (value: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer)));
    downloadFile(`buybye-encrypted-backup-${new Date().toISOString().slice(0, 10)}.buybye`, JSON.stringify({ version: 1, encrypted: true, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(encryptedData) }));
    setToast('Encrypted backup downloaded');
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.encrypted) { setToast('Encrypted restore is supported after password entry in the next update'); return; }
      const valid = z.object({ version: z.literal(1), exportedAt: z.string(), tables: z.object({ transactions: z.array(z.any()), goals: z.array(z.any()), budgets: z.array(z.any()), challenges: z.array(z.any()), analyses: z.array(z.any()), history: z.array(z.any()) }), settings: z.object({ id: z.literal('settings'), name: z.string(), currency: z.enum(['ILS', 'USD', 'EUR']), locale: z.enum(['en', 'he']), theme: z.enum(['light', 'dark', 'system']), monthlyIncome: z.number(), onboardingComplete: z.boolean() }) }).parse(parsed) as BackupPayload;
      await restoreBackup(valid); await refresh(); setToast('Backup restored');
    } catch { setToast('That backup file could not be restored'); }
    event.target.value = '';
  }

  function exportCsv() { downloadFile('buybye-transactions.csv', csvFromTransactions(transactions), 'text/csv'); setToast('CSV downloaded'); }
  function exportExcel() { const rows = transactions.map((item) => `<tr><td>${item.title}</td><td>${item.amount}</td><td>${item.type}</td><td>${item.category}</td><td>${item.date}</td></tr>`).join(''); downloadFile('buybye-transactions.xls', `<table><tr><th>Title</th><th>Amount</th><th>Type</th><th>Category</th><th>Date</th></tr>${rows}</table>`, 'application/vnd.ms-excel'); setToast('Excel file downloaded'); }

  if (!ready) return <div className="app-bg flex min-h-screen items-center justify-center"><div className="text-center"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-ink text-white shadow-float"><Leaf size={30} /></div><p className="text-sm font-semibold text-[#6d8179]">Making space for better money habits…</p></div></div>;

  return (
    <div className={cn('app-bg min-h-screen pb-28', currentSettings.theme === 'dark' && 'theme-dark')} dir={currentSettings.locale === 'he' ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-10">
        <header className="relative flex items-center justify-between py-5 sm:py-7">
          <button onClick={() => setTab('home')} className="flex items-center gap-2.5 text-left"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-ink text-white shadow-float"><Leaf size={20} /></span><span><span className="block text-lg font-black tracking-[-.04em] text-ink">buybye</span><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-[#789088]">money, mindfully</span></span></button>
          <div className="flex items-center gap-2"><button aria-label="Notifications" onClick={() => setShowNotifications((current) => !current)} className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white text-ink shadow-soft"><Bell size={19} /><span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-coral" /></button><button onClick={() => setTab('profile')} className="grid h-11 w-11 place-items-center rounded-2xl bg-lilac text-ink font-bold">{currentSettings.name.slice(0, 1)}</button></div>
          {showNotifications && <div className="absolute right-0 top-20 z-20 w-[min(340px,calc(100vw-2rem))] rounded-3xl border border-black/[.06] bg-white p-4 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-black text-ink">Your reminders</h2><button onClick={() => setShowNotifications(false)} className="text-xs font-bold text-leaf">Done</button></div><div className="mt-3 space-y-2">{challenges.some((challenge) => challenge.active) && <div className="rounded-2xl bg-lilac p-3 text-xs leading-5 text-[#706888]"><strong className="block text-ink">No-buy challenge active</strong>Future-you is cheering you on.</div>}{analyses.filter((item) => item.decision === 'wait' && item.cooldownUntil && new Date(item.cooldownUntil) > new Date()).slice(0, 2).map((item) => <div key={item.id} className="rounded-2xl bg-sand p-3 text-xs leading-5 text-[#8e672b]"><strong className="block text-ink">Pause: {item.item}</strong>Revisit after {formatDate(item.cooldownUntil!.slice(0, 10))}.</div>)}{!challenges.some((challenge) => challenge.active) && !analyses.some((item) => item.decision === 'wait' && item.cooldownUntil && new Date(item.cooldownUntil) > new Date()) && <p className="rounded-2xl bg-[#f1f3ef] p-3 text-xs leading-5 text-[#81938b]">Nothing needs your attention. That’s a good thing.</p>}</div></div>}
        </header>

        {offline && <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-[#fff4df] px-4 py-2.5 text-xs font-semibold text-[#8e672b]"><WifiOff size={15} /> You’re offline — your changes are saved on this device</div>}
        <AnimatePresence mode="wait"><motion.main key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>{tab === 'home' && <HomeView name={currentSettings.name} totalsValue={totalsValue} goals={goals} money={money} history={history} transactions={transactions} setTab={setTab} onAdd={() => setShowTransaction(true)} challenge={challenges[0]} onChallenge={toggleChallenge} />}{tab === 'transactions' && <TransactionsView transactions={transactions} money={money} onAdd={() => setShowTransaction(true)} onDelete={async (id) => { await db.transactions.delete(id); refresh(); setToast('Transaction removed'); }} onExportCsv={exportCsv} onExportExcel={exportExcel} />}{tab === 'worth' && <WorthView analyses={analyses} money={money} onSave={saveAnalysis} onDelete={async (id) => { await db.analyses.delete(id); refresh(); setToast('Decision removed'); }} />}{tab === 'goals' && <GoalsView goals={goals} money={money} onAdd={() => setShowGoal(true)} onDelete={async (id) => { await db.goals.delete(id); refresh(); setToast('Goal removed'); }} onAddMoney={async (goal) => { await db.goals.update(goal.id!, { saved: Math.min(goal.target, goal.saved + 250) }); refresh(); setToast('Nice — progress saved'); }} />}{tab === 'profile' && <ProfileView settings={currentSettings} onSetting={updateSetting} onBackup={() => exportBackup(false)} onEncryptedBackup={() => exportBackup(true)} onImport={() => importRef.current?.click()} onInstall={() => setShowInstall(true)} onClearData={clearLocalData} />}</motion.main></AnimatePresence>
      </div>

      <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-black/[.06] bg-white/90 px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"><div className="mx-auto flex max-w-[640px] items-center justify-around">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={cn('flex min-w-[60px] flex-col items-center gap-1 rounded-2xl px-3 py-2 text-[10px] font-bold transition', tab === id ? 'text-leaf' : 'text-[#9aa8a2]')}><span className={cn('grid h-8 w-8 place-items-center rounded-xl', tab === id && 'bg-mint')}>{id === 'worth' ? <Sparkles size={19} /> : <Icon size={19} />}</span>{label}</button>)}</div></nav>
      <input ref={importRef} type="file" accept=".json,.buybye" className="hidden" onChange={importBackup} />
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="toast fixed bottom-28 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-3 text-xs font-semibold text-white shadow-float"><Check size={15} /> {toast}</motion.div>}</AnimatePresence>
      <Sheet open={showTransaction} onClose={() => setShowTransaction(false)} title="New transaction"><TransactionForm onSubmit={addTransaction} /></Sheet>
      <Sheet open={showGoal} onClose={() => setShowGoal(false)} title="New savings goal"><GoalForm onSubmit={addGoal} /></Sheet>
      <Sheet open={showInstall} onClose={() => setShowInstall(false)} title="Make BuyBye yours"><div className="space-y-5"><div className="grid h-20 w-20 place-items-center rounded-3xl bg-ink text-white shadow-float"><Leaf size={36} /></div><p className="text-sm leading-6 text-[#6d8179]">On iPhone, open BuyBye in Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>. The app will open in its own window and keep working offline after its first visit.</p><div className="rounded-2xl bg-[#fff4df] p-4 text-xs leading-5 text-[#8e672b]"><ShieldCheck size={17} className="mb-2" /> iOS does not run ordinary JavaScript timers or local notifications while Safari is closed. BuyBye stores cooldown timestamps and checks them when you return, so your decisions stay accurate.</div><Button className="w-full" onClick={() => setShowInstall(false)}>Got it</Button></div></Sheet>
    </div>
  );
}

function HomeView({ name, totalsValue, goals, money, history, transactions, setTab, onAdd, challenge, onChallenge }: { name: string; totalsValue: ReturnType<typeof totals>; goals: Goal[]; money: (value: number) => string; history: Array<{ month: string; income: number; expenses: number; saved: number }>; transactions: Transaction[]; setTab: (tab: Tab) => void; onAdd: () => void; challenge?: Challenge; onChallenge: () => void }) {
  const progress = goals[0] ? Math.round((goals[0].saved / goals[0].target) * 100) : 0;
  return <div className="space-y-5 pb-4"><div className="flex items-end justify-between"><div><Pill className="bg-mint text-leaf">Thursday, Jan 16</Pill><h1 className="mt-3 text-[clamp(2rem,8vw,3.5rem)] font-black leading-[.95] tracking-[-.06em] text-ink">{greeting(name)}.</h1><p className="mt-3 text-sm text-[#75877f]">A little clarity goes a long way.</p></div><div className="hidden rounded-3xl bg-sand p-4 text-center sm:block"><span className="block text-2xl">🌱</span><span className="text-[10px] font-bold text-[#94723a]">7 day streak</span></div></div>
    <section className="hero-card relative overflow-hidden rounded-[2rem] bg-ink p-6 text-white shadow-float sm:p-8"><div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border-[28px] border-white/5" /><div className="absolute -bottom-32 right-20 h-56 w-56 rounded-full border-[24px] border-leaf/40" /><div className="relative"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.14em] text-[#b6d9c6]">Available to spend</span><Wallet size={20} className="text-[#b6d9c6]" /></div><div className="mt-4 text-4xl font-black tracking-[-.05em] sm:text-5xl">{money(totalsValue.balance)}</div><div className="mt-6 flex flex-wrap items-center gap-5 text-xs"><span className="flex items-center gap-1.5 text-[#b6d9c6]"><ArrowUpRight size={15} /> {money(totalsValue.income)} in</span><span className="flex items-center gap-1.5 text-[#f5b5a8]"><ArrowDownLeft size={15} /> {money(totalsValue.expenses)} out</span></div></div></section>
    <div className="grid gap-4 sm:grid-cols-2"><Card className="min-h-[184px] bg-white"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#81938b]">Savings goal</p><h2 className="mt-2 text-xl font-black text-ink">{goals[0]?.emoji} {goals[0]?.title ?? 'Start a goal'}</h2></div><button onClick={() => setTab('goals')} className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3ef] text-ink"><ChevronRight size={17} /></button></div><div className="mt-6 flex items-end justify-between"><span className="text-2xl font-black text-ink">{money(goals[0]?.saved ?? 0)}</span><span className="text-xs font-semibold text-[#81938b]">of {money(goals[0]?.target ?? 0)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1ed]"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-leaf" /></div></Card><Card className="min-h-[184px] bg-lilac"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#71648f]">Impulse control</p><h2 className="mt-2 text-xl font-black text-ink">{challenge?.active ? 'No-buy weekend' : 'Pause before buying'}</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/70 text-[#746397]"><Zap size={19} /></span></div><p className="mt-5 text-sm leading-5 text-[#706888]">{challenge?.active ? 'You’re choosing future-you first.' : 'A three-day pause can change everything.'}</p><button onClick={onChallenge} className="mt-4 text-xs font-black uppercase tracking-[.12em] text-[#645585]">{challenge?.active ? 'End challenge' : 'Start a challenge'} →</button></Card></div>
    <Card className="overflow-hidden"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#81938b]">Money flow</p><h2 className="mt-1 text-xl font-black text-ink">A calmer picture</h2></div><button onClick={() => setTab('transactions')} className="text-xs font-bold text-leaf">Details</button></div><div className="h-44 -ml-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="saved" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2b7457" stopOpacity={.28} /><stop offset="100%" stopColor="#2b7457" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef1ed" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#91a199', fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={{ border: 0, borderRadius: 16, boxShadow: '0 8px 22px rgba(0,0,0,.08)', fontSize: 12 }} formatter={(value) => money(Number(value))} /><Area type="monotone" dataKey="saved" stroke="#2b7457" strokeWidth={3} fill="url(#saved)" /></AreaChart></ResponsiveContainer></div></Card>
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-ink">Recent activity</h2><p className="mt-1 text-sm text-[#81938b]">Small choices, visible progress.</p></div><Button onClick={onAdd} variant="soft" className="min-h-10 rounded-xl px-3"><Plus size={16} /> Add</Button></div><div className="space-y-2">{transactions.slice(0, 3).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} money={money} />)}</div></div>;
}

function TransactionRow({ transaction, money }: { transaction: Transaction; money: (value: number) => string }) { return <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft"><span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ backgroundColor: `${categoryColors[transaction.category] ?? '#d8f3e3'}35`, color: categoryColors[transaction.category] ?? '#2b7457' }}>{transaction.type === 'income' ? <ArrowDownLeft size={18} /> : <Receipt size={18} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{transaction.title}</p><p className="text-xs text-[#92a19b]">{transaction.category} · {formatDate(transaction.date)}</p></div><span className={cn('text-sm font-black', transaction.type === 'income' ? 'text-leaf' : 'text-ink')}>{transaction.type === 'income' ? '+' : '−'}{money(transaction.amount)}</span></div>; }

function TransactionsView({ transactions, money, onAdd, onDelete, onExportCsv, onExportExcel }: { transactions: Transaction[]; money: (value: number) => string; onAdd: () => void; onDelete: (id: number) => void; onExportCsv: () => void; onExportExcel: () => void }) { const [search, setSearch] = useState(''); const filtered = transactions.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase())); return <div className="space-y-5"><div className="flex items-end justify-between"><div><Pill>All money movement</Pill><h1 className="mt-3 text-4xl font-black tracking-[-.06em] text-ink">Activity</h1></div><Button onClick={onAdd} className="min-h-11 rounded-2xl px-3"><Plus size={18} /> <span className="hidden sm:inline">Add</span></Button></div><div className="flex gap-2"><label className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a49c]" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions" className="h-12 w-full rounded-2xl border-0 bg-white pl-11 text-sm shadow-soft outline-none ring-0 placeholder:text-[#a4b0ab] focus:ring-2 focus:ring-mint" /></label><button className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-ink shadow-soft"><ListFilter size={18} /></button></div><Card className="flex items-center justify-between bg-mint"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-leaf">Export anytime</p><p className="mt-1 text-sm text-[#557b68]">Your data stays yours.</p></div><div className="flex gap-2"><button onClick={onExportCsv} className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-leaf" title="CSV"><Download size={16} /></button><button onClick={onExportExcel} className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-leaf" title="Excel"><BarChart3 size={16} /></button></div></Card><div className="space-y-2">{filtered.length ? filtered.map((transaction) => <div key={transaction.id} className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft"><TransactionRow transaction={transaction} money={money} /><button aria-label={`Delete ${transaction.title}`} onClick={() => transaction.id && onDelete(transaction.id)} className="mr-1 hidden h-8 w-8 place-items-center rounded-lg text-[#b1bbb6] hover:bg-[#fff0ed] hover:text-coral group-hover:grid"><Trash2 size={15} /></button></div>) : <EmptyState icon={<Receipt size={23} />} title="Nothing here yet" description="Add your first transaction to see it appear." />}</div></div>; }

function WorthView({ analyses, money, onSave, onDelete }: { analyses: PurchaseAnalysis[]; money: (value: number) => string; onSave: (formData: FormData) => void; onDelete: (id: number) => void }) { const [decision, setDecision] = useState<PurchaseAnalysis['decision']>('wait'); return <div className="space-y-5"><div><Pill className="bg-lilac text-[#71648f]">Impulse control</Pill><h1 className="mt-3 text-4xl font-black tracking-[-.06em] text-ink">Worth it?</h1><p className="mt-3 max-w-md text-sm leading-6 text-[#75877f]">A tiny pause between wanting and buying. No judgement, just a little more you in the decision.</p></div><Card className="overflow-hidden bg-ink text-white"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#b6d9c6]">The 3-day pause</p><h2 className="mt-2 text-2xl font-black">Ask future-you first.</h2></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Sparkles size={20} className="text-[#b6d9c6]" /></span></div><form action={onSave} className="mt-6 space-y-3"><input name="item" required placeholder="What are you thinking about?" className="h-12 w-full rounded-2xl border-0 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-mint" /><input name="price" required type="number" min="1" step="1" placeholder="How much?" className="h-12 w-full rounded-2xl border-0 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-mint" /><input type="hidden" name="decision" value={decision} /><div className="grid grid-cols-3 gap-2">{(['wait', 'skipped', 'bought'] as const).map((option) => <button type="button" key={option} onClick={() => setDecision(option)} className={cn('rounded-xl border border-white/15 px-2 py-3 text-xs font-bold capitalize', decision === option ? 'bg-white text-ink' : 'text-white/70')}>{option === 'wait' ? 'Pause 3 days' : option === 'skipped' ? 'Skip it' : 'Bought it'}</button>)}</div><input name="reason" placeholder="One line: what matters most?" className="h-12 w-full rounded-2xl border-0 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-mint" /><Button type="submit" className="w-full bg-mint text-ink hover:bg-white">Save this thought <ArrowUpRight size={16} /></Button></form></Card><div className="flex items-center justify-between"><h2 className="text-xl font-black text-ink">Decision history</h2><Pill>{analyses.length} saved</Pill></div>{analyses.length ? <div className="space-y-2">{analyses.map((item) => <Card key={item.id} className="flex items-center gap-3 p-4"><span className={cn('grid h-10 w-10 place-items-center rounded-2xl', item.decision === 'wait' ? 'bg-sand text-[#a47936]' : item.decision === 'skipped' ? 'bg-mint text-leaf' : 'bg-[#fff0ed] text-coral')}>{item.decision === 'wait' ? <RotateCcw size={17} /> : item.decision === 'skipped' ? <Check size={17} /> : <ShoppingBagIcon size={17} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{item.item}</p><p className="text-xs text-[#91a199]">{item.decision === 'wait' && item.cooldownUntil && new Date(item.cooldownUntil) > new Date() ? `Cooldown ends ${formatDate(item.cooldownUntil.slice(0, 10))}` : `${item.decision} · ${formatDate(item.createdAt.slice(0, 10))}`}</p></div><span className="text-sm font-black text-ink">{money(item.price)}</span><button aria-label={`Delete ${item.item}`} onClick={() => item.id && onDelete(item.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#b1bbb6] hover:bg-[#fff0ed] hover:text-coral"><Trash2 size={15} /></button></Card>)}</div> : <EmptyState icon={<Sparkles size={23} />} title="Your pause list is empty" description="Use the form above when something shiny catches your eye." />}</div>; }

function ShoppingBagIcon({ size }: { size: number }) { return <span style={{ fontSize: size }}>🛍️</span>; }

function GoalsView({ goals, money, onAdd, onDelete, onAddMoney }: { goals: Goal[]; money: (value: number) => string; onAdd: () => void; onDelete: (id: number) => void; onAddMoney: (goal: Goal) => void }) { return <div className="space-y-5"><div className="flex items-end justify-between"><div><Pill className="bg-sand text-[#94723a]">Future plans</Pill><h1 className="mt-3 text-4xl font-black tracking-[-.06em] text-ink">Goals</h1></div><Button onClick={onAdd} variant="soft" className="min-h-11 rounded-2xl px-3"><Plus size={17} /> <span className="hidden sm:inline">New goal</span></Button></div><div className="grid gap-4 sm:grid-cols-2">{goals.map((goal) => { const percent = Math.min(100, Math.round((goal.saved / goal.target) * 100)); return <Card key={goal.id} className="relative overflow-hidden"><div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[4rem] bg-mint/70" /><div className="relative flex items-start justify-between"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#f7f6f1] text-3xl">{goal.emoji}</div><div className="flex items-center gap-2"><Pill>{percent}% there</Pill><button aria-label={`Delete ${goal.title}`} onClick={() => goal.id && onDelete(goal.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[#b1bbb6] hover:bg-[#fff0ed] hover:text-coral"><Trash2 size={15} /></button></div></div><h2 className="relative mt-5 text-xl font-black text-ink">{goal.title}</h2><div className="relative mt-5 flex items-end justify-between"><span className="text-2xl font-black text-ink">{money(goal.saved)}</span><span className="text-xs font-semibold text-[#81938b]">of {money(goal.target)}</span></div><div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#edf1ed]"><motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full rounded-full bg-leaf" /></div><button onClick={() => onAddMoney(goal)} className="relative mt-5 flex items-center gap-1.5 text-xs font-black uppercase tracking-[.12em] text-leaf">Add {money(250)} <ArrowUpRight size={14} /></button></Card>})}</div>{goals.length === 0 && <EmptyState icon={<Target size={23} />} title="What are you making room for?" description="Create a first goal and let small progress compound." action={onAdd} />}</div>; }

function ProfileView({ settings, onSetting, onBackup, onEncryptedBackup, onImport, onInstall, onClearData }: { settings: AppSettings; onSetting: (patch: Partial<AppSettings>) => void; onBackup: () => void; onEncryptedBackup: () => void; onImport: () => void; onInstall: () => void; onClearData: () => void }) { return <div className="space-y-5"><div><Pill className="bg-[#e8f0ec] text-leaf">Your private space</Pill><h1 className="mt-3 text-4xl font-black tracking-[-.06em] text-ink">Profile</h1></div><Card className="flex items-center gap-4 bg-mint"><div className="grid h-16 w-16 place-items-center rounded-3xl bg-ink text-2xl font-black text-white">{settings.name.slice(0, 1)}</div><div><h2 className="text-xl font-black text-ink">{settings.name}</h2><p className="mt-1 text-sm text-[#587b68]">Your data lives on this device.</p></div><ShieldCheck className="ml-auto text-leaf" size={22} /></Card><section><h2 className="mb-3 text-sm font-black uppercase tracking-[.12em] text-[#81938b]">Preferences</h2><Card className="divide-y divide-black/[.06] p-0"><label className="flex items-center justify-between gap-3 p-4"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3ef]"><Wallet size={17} /></span><span><span className="block text-sm font-bold text-ink">Currency</span><span className="block text-xs text-[#91a199]">Used across your totals</span></span></span><select value={settings.currency} onChange={(event) => onSetting({ currency: event.target.value as AppSettings['currency'] })} className="rounded-xl border-0 bg-[#f1f3ef] py-2 text-sm font-bold text-ink"><option>ILS</option><option>USD</option><option>EUR</option></select></label><div className="flex items-center justify-between p-4"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3ef]"><Moon size={17} /></span><span><span className="block text-sm font-bold text-ink">Appearance</span><span className="block text-xs text-[#91a199]">Comfortable in any light</span></span></span><div className="flex rounded-xl bg-[#f1f3ef] p-1">{(['light', 'dark'] as const).map((theme) => <button key={theme} onClick={() => onSetting({ theme })} className={cn('rounded-lg px-3 py-1.5 text-xs font-bold capitalize', settings.theme === theme ? 'bg-white text-ink shadow-sm' : 'text-[#91a199]')}>{theme}</button>)}</div></div><div className="flex items-center justify-between p-4"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1f3ef]"><Leaf size={17} /></span><span><span className="block text-sm font-bold text-ink">Language</span><span className="block text-xs text-[#91a199]">RTL Hebrew is supported</span></span></span><select value={settings.locale} onChange={(event) => onSetting({ locale: event.target.value as AppSettings['locale'] })} className="rounded-xl border-0 bg-[#f1f3ef] py-2 text-sm font-bold text-ink"><option value="en">English</option><option value="he">עברית</option></select></div></Card></section><section><h2 className="mb-3 text-sm font-black uppercase tracking-[.12em] text-[#81938b]">Keep it safe</h2><Card className="space-y-2 p-2"><button onClick={onInstall} className="profile-action"><span className="icon-tile bg-lilac"><Download size={17} /></span><span><strong>Install BuyBye</strong><small>Add it to your iPhone home screen</small></span><ChevronRight size={17} /></button><button onClick={onBackup} className="profile-action"><span className="icon-tile bg-mint"><Download size={17} /></span><span><strong>Download backup</strong><small>Plain JSON for easy restore</small></span><ChevronRight size={17} /></button><button onClick={onEncryptedBackup} className="profile-action"><span className="icon-tile bg-sand"><LockKeyhole size={17} /></span><span><strong>Encrypted backup</strong><small>Protect an export with a password</small></span><ChevronRight size={17} /></button><button onClick={onImport} className="profile-action"><span className="icon-tile bg-[#fff0ed]"><Upload size={17} /></span><span><strong>Restore backup</strong><small>Import a JSON export on this device</small></span><ChevronRight size={17} /></button><button onClick={onClearData} className="profile-action"><span className="icon-tile bg-[#fff0ed] text-coral"><Trash2 size={17} /></span><span><strong className="text-coral">Clear all local data</strong><small>Reset this browser to an empty BuyBye</small></span><ChevronRight size={17} /></button></Card><p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#91a199]"><CircleHelp size={15} className="mt-0.5 shrink-0" /> Browser storage can be cleared or evicted. Back up important data regularly, especially before switching devices.</p></section></div>; }

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: () => void }) { return <Card className="flex flex-col items-center justify-center py-12 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-mint text-leaf">{icon}</span><h3 className="mt-4 text-lg font-black text-ink">{title}</h3><p className="mt-2 max-w-xs text-sm leading-5 text-[#91a199]">{description}</p>{action && <Button onClick={action} variant="soft" className="mt-5">Create one <Plus size={16} /></Button>}</Card>; }

function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) { return <AnimatePresence>{open && <><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" /><motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90vh] max-w-xl overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl sm:bottom-4 sm:rounded-[2rem]"><div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#dfe7e2] sm:hidden" /><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black tracking-[-.04em] text-ink">{title}</h2><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f3ef] text-ink"><X size={18} /></button></div>{children}</motion.div></>}</AnimatePresence>; }

function TransactionForm({ onSubmit }: { onSubmit: (data: FormData) => void }) { const [type, setType] = useState<Transaction['type']>('expense'); return <form action={onSubmit} className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f1f3ef] p-1">{(['expense', 'income'] as const).map((option) => <button type="button" key={option} onClick={() => setType(option)} className={cn('rounded-xl py-3 text-sm font-bold capitalize', type === option ? 'bg-white text-ink shadow-sm' : 'text-[#8b9b94]')}>{option}</button>)}</div><input type="hidden" name="type" value={type} /><label className="field-label">What was it?<input name="title" required placeholder="e.g. Dinner with friends" className="field-input" /></label><label className="field-label">Amount<input name="amount" required min="1" step="1" type="number" inputMode="decimal" placeholder="0" className="field-input text-2xl font-black" /></label><label className="field-label">Category<select name="category" className="field-input"><option>Food</option><option>Home</option><option>Transport</option><option>Fun</option><option>Health</option><option>Shopping</option><option>Income</option></select></label><label className="field-label">Date<input name="date" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field-input" /></label><label className="field-label">Note <span className="font-normal text-[#a4b0ab]">optional</span><input name="note" placeholder="A little context" className="field-input" /></label><Button type="submit" className="w-full">Save transaction <Check size={17} /></Button></form>; }

function GoalForm({ onSubmit }: { onSubmit: (data: FormData) => void }) { return <form action={onSubmit} className="space-y-4"><label className="field-label">What are you saving for?<input name="title" required placeholder="e.g. A weekend away" className="field-input" /></label><label className="field-label">Target amount<input name="target" required min="1" step="1" type="number" inputMode="decimal" placeholder="0" className="field-input text-2xl font-black" /></label><label className="field-label">Emoji <span className="font-normal text-[#a4b0ab]">optional</span><input name="emoji" maxLength={2} placeholder="✈️" className="field-input" /></label><label className="field-label">Target date <span className="font-normal text-[#a4b0ab]">optional</span><input name="dueDate" type="date" className="field-input" /></label><Button type="submit" className="w-full">Create goal <Target size={17} /></Button></form>; }
