'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BellRing, Check, CircleAlert, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { acknowledgeChange, transitionOrder } from '@/lib/actions/orders';
import { ACTION_TARGET, needsReason, type StaffAction } from '@/lib/order-rules';
import type { OrderStatus } from '@/types/app';

const VARIANT: Record<StaffAction, string> = {
  approve: 'btn-primary',
  acknowledge: 'btn-primary',
  start: 'btn-primary',
  ready: 'btn-primary',
  deliver: 'btn-primary',
  needsReview: 'btn-ghost',
  reject: 'btn-danger',
  cancel: 'btn-ghost'
};

function useRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) return setError(res.error ?? 'errors.unknown');
        onDone?.();
        router.refresh();
      } catch {
        setError('orders.form.networkError');
      }
    });
  };
  return { pending, error, setError, run };
}

function ErrorLine({ error }: { error: string | null }) {
  const t = useTranslations();
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-control border border-danger p-2 text-sm text-danger">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {t(error)}
    </p>
  );
}

// أزرار الإدارة والمعمل لنقل الطلب بين الحالات. ما يحتاج سبباً يفتح خانة السبب أولاً
export function StaffActions({
  orderId,
  status,
  revision,
  actions,
  size = 'md'
}: {
  orderId: string;
  status: OrderStatus;
  revision: number;
  actions: StaffAction[];
  size?: 'md' | 'lg';
}) {
  const t = useTranslations('orders.actions');
  const { pending, error, setError, run } = useRunner();
  const [asking, setAsking] = useState<StaffAction | null>(null);
  const [reason, setReason] = useState('');
  const [active, setActive] = useState<StaffAction | null>(null);

  if (actions.length === 0) return null;

  const go = (action: StaffAction) => {
    const to = ACTION_TARGET[action];
    if (needsReason(to, status) && asking !== action) {
      setAsking(action);
      setReason('');
      setError(null);
      return;
    }
    if (needsReason(to, status) && !reason.trim()) return setError('errors.ERR_REASON_REQUIRED');
    setActive(action);
    run(() => transitionOrder(orderId, to, reason || null, revision), () => setAsking(null));
  };

  const big = size === 'lg' ? 'min-h-[56px] px-6 text-lg' : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a} type="button" disabled={pending} onClick={() => go(a)} className={`${VARIANT[a]} ${big}`} aria-busy={pending && active === a}>
            {pending && active === a && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
            {t(a)}
          </button>
        ))}
      </div>
      {asking && (
        <div className="space-y-2 rounded-control border border-line p-3">
          <label htmlFor={`reason-${orderId}`} className="block font-bold">{t('reasonFor', { action: t(asking) })}</label>
          <textarea id={`reason-${orderId}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="field" autoFocus />
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => go(asking)} className={VARIANT[asking]}>
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {t('confirm')}
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking(null)} className="btn-ghost">
              <X className="h-4 w-4" aria-hidden />
              {t('back')}
            </button>
          </div>
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

// إجراءات العميل: إلغاء طلب لم يُعتمد، أو إعادة إرساله للاعتماد بعد طلب التعديل
export function CustomerActions({ orderId, status, revision }: { orderId: string; status: OrderStatus; revision: number }) {
  const t = useTranslations('orders.actions');
  const { pending, error, run } = useRunner();
  const canCancel = status === 'pending_approval' || status === 'needs_review';
  if (!canCancel) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'needs_review' && (
          <button type="button" disabled={pending} onClick={() => run(() => transitionOrder(orderId, 'pending_approval', null, revision))} className="btn-ghost">
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t('resubmit')}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => window.confirm(t('cancelConfirm')) && run(() => transitionOrder(orderId, 'cancelled', null, revision))}
          className="btn-danger"
        >
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
          {t('cancelOrder')}
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

// تأكيد المعمل على الاطلاع على تعديل جديد قبل متابعة التجهيز
export function AcknowledgeChangeButton({ orderId, size = 'md' }: { orderId: string; size?: 'md' | 'lg' }) {
  const t = useTranslations('orders.actions');
  const { pending, error, run } = useRunner();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => acknowledgeChange(orderId))}
        className={`btn-primary ${size === 'lg' ? 'min-h-[56px] px-6 text-lg' : ''}`}
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <BellRing className="h-4 w-4" aria-hidden />}
        {t('seenChange')}
      </button>
      <ErrorLine error={error} />
    </div>
  );
}
