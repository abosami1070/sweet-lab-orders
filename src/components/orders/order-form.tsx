'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, CircleAlert, LoaderCircle, Minus, Plus, Send, WifiOff } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { placeOrder, updateOrder, type OrderInput } from '@/lib/actions/orders';
import { formatDate, formatNumber, riyadhToday, hhmm } from '@/lib/format';
import { toLatinDigits } from '@/lib/forms';
import type { CatalogProduct, OrderFormData } from '@/lib/orders';

export type OrderFormInitial = {
  orderId?: string;
  revision?: number;
  deliveryDate?: string;
  windowId?: string | null;
  branchId?: string | null;
  notes?: string | null;
  items?: { product_id: string; quantity: number; notes?: string | null }[];
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const riyadhTimeNow = () =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

// تقريب الكمية إلى أقرب مضاعف للخطوة لا يقل عن الحد الأدنى
const clampQty = (p: CatalogProduct, value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const steps = Math.ceil(value / p.quantity_step - 1e-9);
  return Math.max(p.min_quantity, Number((steps * p.quantity_step).toFixed(2)));
};

// نموذج الطلب: إنشاء طلب جديد أو تعديل طلب قائم. كل القواعد تتحقق منها القاعدة عند الإرسال،
// والتنبيهات هنا لمساعدة العميل قبل الإرسال فقط.
export function OrderForm({
  data,
  mode,
  initial,
  basePath,
  reasonRequired = false,
  customerId
}: {
  data: OrderFormData;
  mode: 'create' | 'edit';
  initial?: OrderFormInitial;
  basePath: string;
  reasonRequired?: boolean;
  customerId?: string;
}) {
  const t = useTranslations('orders.form');
  const tAll = useTranslations();
  const tu = useTranslations('units');
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === 'ar';

  const productIds = useMemo(() => new Set(data.products.map((p) => p.id)), [data.products]);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries((initial?.items ?? []).filter((i) => productIds.has(i.product_id)).map((i) => [i.product_id, Number(i.quantity)]))
  );
  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.items ?? []).filter((i) => i.notes).map((i) => [i.product_id, i.notes ?? '']))
  );
  const today = riyadhToday();
  const [date, setDate] = useState(initial?.deliveryDate ?? '');
  const [windowId, setWindowId] = useState(initial?.windowId ?? (data.windows.length === 1 ? data.windows[0].id : ''));
  const [branchId, setBranchId] = useState(initial?.branchId ?? (data.branches.length === 1 ? data.branches[0].id : ''));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<{ key: string; productId?: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, startTransition] = useTransition();
  // معرّف ثابت للطلب حتى ينجح الإرسال: إعادة المحاولة بعد انقطاع لا تنشئ طلباً مكرراً
  const requestId = useRef<string>('');
  if (!requestId.current && typeof crypto !== 'undefined' && 'randomUUID' in crypto) requestId.current = crypto.randomUUID();
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const maxDate = addDays(today, data.maxDaysAhead);
  const selected = data.products.filter((p) => (qty[p.id] ?? 0) > 0);
  const closed = data.closedDates.find((c) => c.date === date);
  const cutoffPassed = date === today && riyadhTimeNow() >= data.cutoff;
  const leadIssues = date ? selected.filter((p) => date < addDays(today, p.lead_days)) : [];

  const grouped = useMemo(() => {
    const byCat = new Map<string | null, CatalogProduct[]>();
    for (const p of data.products) {
      const key = data.categories.some((c) => c.id === p.category_id) ? p.category_id : null;
      byCat.set(key, [...(byCat.get(key) ?? []), p]);
    }
    const ordered = data.categories.filter((c) => byCat.has(c.id)).map((c) => ({ id: c.id, name: ar ? c.name_ar : c.name_en, items: byCat.get(c.id)! }));
    if (byCat.has(null)) ordered.push({ id: 'none', name: data.categories.length ? t('otherProducts') : '', items: byCat.get(null)! });
    return ordered;
  }, [data.products, data.categories, ar, t]);

  const setProductQty = (p: CatalogProduct, value: number) => {
    setError(null);
    setQty((prev) => ({ ...prev, [p.id]: clampQty(p, value) }));
  };
  const step = (p: CatalogProduct, dir: 1 | -1) => {
    const current = qty[p.id] ?? 0;
    if (dir === 1) setProductQty(p, current === 0 ? p.min_quantity : current + p.quantity_step);
    else setProductQty(p, current - p.quantity_step < p.min_quantity ? 0 : current - p.quantity_step);
  };

  const submit = () => {
    if (pending) return;
    if (!navigator.onLine) return setError({ key: 'orders.form.offline' });
    if (selected.length === 0) return setError({ key: 'errors.ERR_ITEMS_REQUIRED' });
    if (!date) return setError({ key: 'errors.ERR_DATE_REQUIRED' });
    if (data.windows.length > 0 && !windowId) return setError({ key: 'orders.form.windowRequired' });
    if (reasonRequired && !reason.trim()) return setError({ key: 'errors.ERR_REASON_REQUIRED' });

    const input: OrderInput = {
      requestId: requestId.current,
      orderId: initial?.orderId,
      expectedRevision: initial?.revision,
      deliveryDate: date,
      windowId: windowId || null,
      branchId: branchId || null,
      notes,
      reason,
      customerId,
      items: selected.map((p) => ({ product_id: p.id, quantity: qty[p.id], notes: itemNotes[p.id] }))
    };
    setError(null);
    startTransition(async () => {
      try {
        const res = mode === 'create' ? await placeOrder(input) : await updateOrder(input);
        if (!res.ok) {
          setError({ key: res.error, productId: res.detail });
          return;
        }
        requestId.current = '';
        router.push(`${basePath}/${res.orderId}?${mode === 'create' ? 'placed' : 'updated'}=1`);
        router.refresh();
      } catch {
        // انقطاع أثناء الإرسال: نفس المعرّف عند إعادة المحاولة، فلا تكرار
        setError({ key: 'orders.form.networkError' });
      }
    });
  };

  const productName = (p: { name_ar: string; name_en: string }) => (ar ? p.name_ar : p.name_en);
  const errorProduct = error?.productId ? data.products.find((p) => p.id === error.productId) : undefined;

  if (data.products.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-lg font-bold">{t('noProductsTitle')}</p>
        <p className="mt-1 text-sm text-ink-muted">{t('noProductsBody')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      {/* المنتجات */}
      <div className="space-y-6">
        {grouped.map((g) => (
          <section key={g.id} aria-label={g.name || t('products')}>
            {g.name && <h2 className="mb-3 text-lg">{g.name}</h2>}
            <ul className="grid gap-3 sm:grid-cols-2">
              {g.items.map((p) => {
                const q = qty[p.id] ?? 0;
                const highlighted = error?.productId === p.id;
                return (
                  <li key={p.id} className={`card p-4 ${q > 0 ? 'border-primary' : ''} ${highlighted ? 'border-danger' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold">{productName(p)}</p>
                        {(ar ? p.description_ar : p.description_en) && (
                          <p className="mt-0.5 text-sm text-ink-muted">{ar ? p.description_ar : p.description_en}</p>
                        )}
                        <p className="mt-1 text-xs text-ink-muted">
                          {t('rules', { min: formatNumber(locale, p.min_quantity), step: formatNumber(locale, p.quantity_step), unit: tu(p.unit) })}
                          {p.lead_days > 0 && ` · ${t('leadDays', { count: p.lead_days, n: formatNumber(locale, p.lead_days) })}`}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" onClick={() => step(p, -1)} disabled={q === 0 || pending} className="btn-ghost h-11 w-11 p-0" aria-label={t('decrease', { name: productName(p) })}>
                        <Minus className="h-4 w-4" aria-hidden />
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={q === 0 ? '' : String(q)}
                        placeholder="0"
                        onChange={(e) => {
                          const raw = toLatinDigits(e.target.value).replace(/[^0-9.]/g, '');
                          setError(null);
                          setQty((prev) => ({ ...prev, [p.id]: raw === '' ? 0 : Number(raw) }));
                        }}
                        onBlur={() => setProductQty(p, qty[p.id] ?? 0)}
                        aria-label={t('quantityOf', { name: productName(p), unit: tu(p.unit) })}
                        className="field h-11 w-24 text-center text-lg font-bold"
                      />
                      <button type="button" onClick={() => step(p, 1)} disabled={pending} className="btn-ghost h-11 w-11 p-0" aria-label={t('increase', { name: productName(p) })}>
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                      <span className="text-sm text-ink-muted">{tu(p.unit)}</span>
                    </div>
                    {q > 0 && (
                      <input
                        type="text"
                        value={itemNotes[p.id] ?? ''}
                        maxLength={300}
                        onChange={(e) => setItemNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={t('itemNotePlaceholder')}
                        aria-label={t('itemNote', { name: productName(p) })}
                        className="field mt-3 text-sm"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* التسليم والملخص */}
      <aside className="card space-y-4 p-5 lg:sticky lg:top-6">
        <h2 className="text-lg">{t('delivery')}</h2>

        <div>
          <label htmlFor="delivery_date" className="mb-1 block font-bold">{t('date')}</label>
          <input
            id="delivery_date"
            type="date"
            dir="ltr"
            min={today}
            max={maxDate}
            value={date}
            onChange={(e) => {
              setError(null);
              setDate(e.target.value);
            }}
            className="field rtl:text-right"
          />
          {date && (
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-muted">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {formatDate(locale, `${date}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-muted">{t('cutoffHint', { time: data.cutoff })}</p>
        </div>

        {data.windows.length > 0 && (
          <div>
            <label htmlFor="delivery_window" className="mb-1 block font-bold">{t('window')}</label>
            <select id="delivery_window" value={windowId} onChange={(e) => setWindowId(e.target.value)} className="field">
              <option value="" disabled>{t('chooseWindow')}</option>
              {data.windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {(ar ? w.label_ar : w.label_en) + ` (${hhmm(w.start_time)}–${hhmm(w.end_time)})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'create' && data.branches.length > 0 && (
          <div>
            <label htmlFor="branch" className="mb-1 block font-bold">{t('branch')}</label>
            <select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="field">
              <option value="">{t('mainBranch')}</option>
              {data.branches.map((b) => (
                <option key={b.id} value={b.id}>{ar ? b.name_ar : b.name_en}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="order_notes" className="mb-1 block font-bold">
            {t('notes')} <span className="text-xs font-normal text-ink-muted">{tAll('forms.optional')}</span>
          </label>
          <textarea id="order_notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="field" />
        </div>

        {reasonRequired && (
          <div>
            <label htmlFor="edit_reason" className="mb-1 block font-bold">{t('reason')}</label>
            <textarea id="edit_reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="field" placeholder={t('reasonPlaceholder')} />
          </div>
        )}

        {/* تنبيهات قبل الإرسال */}
        {(closed || cutoffPassed || leadIssues.length > 0) && (
          <ul className="space-y-2 text-sm">
            {closed && <li className="rounded-control bg-primary-soft p-2">{t('warnClosed', { reason: (ar ? closed.reason_ar : closed.reason_en) || '' })}</li>}
            {cutoffPassed && <li className="rounded-control bg-primary-soft p-2">{t('warnCutoff', { time: data.cutoff })}</li>}
            {leadIssues.map((p) => (
              <li key={p.id} className="rounded-control bg-primary-soft p-2">
                {t('warnLead', { name: productName(p), date: formatDate(locale, `${addDays(today, p.lead_days)}T12:00:00Z`, { day: 'numeric', month: 'long' }) })}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line pt-4">
          <p className="font-bold">{t('summary', { count: selected.length })}</p>
          {selected.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {selected.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">{productName(p)}</span>
                  <span className="shrink-0 font-bold" dir="ltr">{formatNumber(locale, qty[p.id])} {tu(p.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-control border border-danger p-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {tAll(error.key)}
              {errorProduct && <> — <b>{productName(errorProduct)}</b></>}
            </span>
          </p>
        )}

        {!online && (
          <p role="status" className="flex items-center gap-2 rounded-control bg-surface-raised p-3 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {t('offline')}
          </p>
        )}

        <button type="button" onClick={submit} disabled={pending || !online} aria-busy={pending} className="btn-primary w-full">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {pending ? t('sending') : mode === 'create' ? t('submit') : t('saveChanges')}
        </button>
        {mode === 'create' && <p className="text-xs text-ink-muted">{t('afterSubmit')}</p>}
      </aside>
    </div>
  );
}
