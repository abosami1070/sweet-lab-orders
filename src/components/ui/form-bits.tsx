'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';
import type { FormState } from '@/lib/forms';

// حقل بتسمية فوقه، وتلميح، ورسالة خطأ تحته
export function Field({
  id, label, error, hint, optional, children, className = ''
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 flex items-baseline gap-2 font-bold">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">{t('forms.optional')}</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-danger">{t(error)}</p>}
    </div>
  );
}

// خصائص الوصول للحقل حسب وجود خطأ أو تلميح
export const describe = (id: string, error?: string, hint?: string) => ({
  id,
  name: id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined
});

// زر الحفظ: يتعطل أثناء الإرسال لمنع الإرسال المزدوج
export function SubmitButton({
  children, pending, pendingLabel, variant = 'primary', className = '', icon
}: {
  children: ReactNode;
  pending: boolean;
  pendingLabel?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  icon?: ReactNode;
}) {
  const t = useTranslations('forms');
  const base = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost';
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${base} ${className}`}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {pending ? pendingLabel ?? t('saving') : children}
    </button>
  );
}

// رسالة النتيجة أعلى النموذج: الخطأ يبقى، والنجاح يختفي بعد ثوانٍ
export function FormAlert({ state, success }: { state: FormState; success?: string }) {
  const t = useTranslations();
  const [showOk, setShowOk] = useState(false);

  useEffect(() => {
    if (state.status !== 'ok') return;
    setShowOk(true);
    const timer = setTimeout(() => setShowOk(false), 3500);
    return () => clearTimeout(timer);
  }, [state.status, state.at]);

  if (state.status === 'error' && state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-control border border-danger bg-surface-raised p-3 text-sm text-danger">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t(state.error)}
      </p>
    );
  }
  if (showOk && state.status === 'ok') {
    return (
      <p role="status" className="flex items-center gap-2 rounded-control border border-success bg-surface-raised p-3 text-sm font-bold text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        {success ?? t('forms.saved')}
      </p>
    );
  }
  return null;
}

// ربط النموذج بإجراء الخادم دون أن يمسح React الحقول بعد الإرسال
// (React 19 يفرّغ النموذج تلقائياً مع action=، فيضيع ما كتبه المستخدم عند خطأ تحقق)
// resetOnSuccess: يفرغ نموذج الإضافة بعد كل نجاح جديد
export function useServerForm(
  action: (prev: FormState, fd: FormData) => Promise<FormState>,
  { resetOnSuccess = false, confirm }: { resetOnSuccess?: boolean; confirm?: string } = {}
) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, { status: 'idle' });
  const formRef = useRef<HTMLFormElement>(null);
  const lastAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (resetOnSuccess && state.status === 'ok' && state.at !== lastAt.current) {
      lastAt.current = state.at;
      formRef.current?.reset();
    }
  }, [state, resetOnSuccess]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (confirm && !window.confirm(confirm)) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  const err = (field: string) => state.fields?.[field];
  return { state, pending, formRef, onSubmit, err };
}

// مفتاح تبديل (checkbox) بشكل واضح وكبير للمس
export function Toggle({
  name, label, defaultChecked, hint
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-control border border-line bg-surface px-3 py-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info rtl:peer-checked:after:-translate-x-5"
      />
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      </span>
    </label>
  );
}
