import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: Array<string | undefined | false | null>) { return twMerge(clsx(inputs)); }

export function Button({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' }) {
  return <button className={cn('inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50', variant === 'primary' && 'bg-ink text-white shadow-float hover:bg-leaf', variant === 'soft' && 'bg-mint text-ink hover:bg-[#c5ead5]', variant === 'ghost' && 'text-ink hover:bg-black/5', variant === 'danger' && 'bg-[#fff0ed] text-[#b94f3b] hover:bg-[#ffe1db]', className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-3xl border border-black/[.06] bg-white p-5 shadow-soft', className)} {...props} />; }

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) { return <span className={cn('inline-flex items-center rounded-full bg-[#f1f3ef] px-3 py-1 text-xs font-semibold text-[#587169]', className)}>{children}</span>; }
