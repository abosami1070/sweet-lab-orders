import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarDays, Clock, MapPin, MessageSquareText, Store } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatNumber, hhmm } from '@/lib/format';
import type { OrderEvent, OrderRow } from '@/lib/orders';
import type { ProductUnit } from '@/types/app';

const dateLabel = (locale: string, iso: string) => formatDate(locale, `${iso}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' });

// بطاقة معلومات الطلب: المحل، الموعد، الفترة، الملاحظات، والأصناف
export async function OrderSummary({ order, showShop = false }: { order: OrderRow; showShop?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations('orders.details');
  const tu = await getTranslations('units');
  const ar = locale === 'ar';
  const name = (x: { name_ar: string; name_en: string } | null) => (x ? (ar ? x.name_ar : x.name_en) : '');

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-extrabold" dir="ltr">#{order.order_number}</p>
        <StatusBadge status={order.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {showShop && order.customer && (
          <div className="flex items-start gap-2">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <dt className="text-ink-muted">{t('shop')}</dt>
              <dd className="font-bold">{name(order.customer)}{order.branch && ` — ${name(order.branch)}`}</dd>
            </div>
          </div>
        )}
        {!showShop && order.branch && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <dt className="text-ink-muted">{t('branch')}</dt>
              <dd className="font-bold">{name(order.branch)}</dd>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <div>
            <dt className="text-ink-muted">{t('deliveryDate')}</dt>
            <dd className="font-bold">{dateLabel(locale, order.delivery_date)}</dd>
          </div>
        </div>
        {order.window && (
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
            <div>
              <dt className="text-ink-muted">{t('window')}</dt>
              <dd className="font-bold">
                {ar ? order.window.label_ar : order.window.label_en}{' '}
                <span dir="ltr" className="font-normal text-ink-muted">({hhmm(order.window.start_time)}–{hhmm(order.window.end_time)})</span>
              </dd>
            </div>
          </div>
        )}
      </dl>

      {order.customer_notes && (
        <p className="mt-4 flex items-start gap-2 rounded-control bg-surface-raised p-3 text-sm">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <span className="whitespace-pre-line">{order.customer_notes}</span>
        </p>
      )}

      {order.closed_reason && ['needs_review', 'rejected', 'cancelled'].includes(order.status) && (
        <p className="mt-4 rounded-control border border-danger p-3 text-sm">
          <b>{t('reasonLabel')}</b> {order.closed_reason}
        </p>
      )}

      <h3 className="mt-5 text-base">{t('items')}</h3>
      <ItemsList items={order.order_items} unitLabel={(u) => tu(u)} locale={locale} />
    </div>
  );
}

export function ItemsList({
  items,
  unitLabel,
  locale,
  large = false
}: {
  items: OrderRow['order_items'];
  unitLabel: (u: ProductUnit) => string;
  locale: string;
  large?: boolean;
}) {
  const ar = locale === 'ar';
  const sorted = [...items].sort((a, b) => (ar ? a.product_name_ar.localeCompare(b.product_name_ar, 'ar') : a.product_name_en.localeCompare(b.product_name_en)));
  return (
    <ul className={`mt-2 divide-y divide-line ${large ? 'text-lg' : 'text-sm'}`}>
      {sorted.map((i) => (
        <li key={i.product_id} className="flex items-start justify-between gap-3 py-2">
          <span className="min-w-0">
            <span className="block font-bold">{ar ? i.product_name_ar : i.product_name_en}</span>
            {i.item_notes && <span className="block text-sm text-ink-muted">{i.item_notes}</span>}
          </span>
          <span className="shrink-0 font-extrabold">
            {formatNumber(locale, Number(i.quantity))} <span className="font-normal text-ink-muted">{unitLabel(i.unit)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type SnapshotItem = { product_id: string; name_ar: string; name_en: string; quantity: number; notes: string | null };
type Snapshot = { delivery_date?: string; delivery_window_id?: string | null; notes?: string | null; items?: SnapshotItem[] };

// الفروقات في آخر تعديل: ما أُضيف وما حُذف وما تغيرت كميته، والتاريخ والملاحظات
export async function OrderDiff({ event }: { event: OrderEvent }) {
  const locale = await getLocale();
  const t = await getTranslations('orders.diff');
  const ar = locale === 'ar';
  const changes = (event.changes ?? {}) as { before?: Snapshot; after?: Snapshot };
  const before = changes.before ?? {};
  const after = changes.after ?? {};
  const b = new Map((before.items ?? []).map((i) => [i.product_id, i]));
  const a = new Map((after.items ?? []).map((i) => [i.product_id, i]));
  const n = (i: SnapshotItem) => (ar ? i.name_ar : i.name_en);
  const rows: { key: string; text: string; tone: 'add' | 'remove' | 'change' }[] = [];

  for (const [id, item] of a) {
    const old = b.get(id);
    if (!old) rows.push({ key: id, text: t('added', { name: n(item), qty: formatNumber(locale, Number(item.quantity)) }), tone: 'add' });
    else if (Number(old.quantity) !== Number(item.quantity))
      rows.push({ key: id, text: t('qtyChanged', { name: n(item), from: formatNumber(locale, Number(old.quantity)), to: formatNumber(locale, Number(item.quantity)) }), tone: 'change' });
    else if ((old.notes ?? '') !== (item.notes ?? '')) rows.push({ key: id, text: t('itemNoteChanged', { name: n(item) }), tone: 'change' });
  }
  for (const [id, item] of b) if (!a.has(id)) rows.push({ key: id, text: t('removed', { name: n(item) }), tone: 'remove' });
  if (before.delivery_date && before.delivery_date !== after.delivery_date)
    rows.push({ key: 'date', text: t('dateChanged', { from: dateLabel(locale, before.delivery_date), to: dateLabel(locale, after.delivery_date!) }), tone: 'change' });
  if ((before.delivery_window_id ?? null) !== (after.delivery_window_id ?? null)) rows.push({ key: 'window', text: t('windowChanged'), tone: 'change' });
  if ((before.notes ?? '') !== (after.notes ?? '')) rows.push({ key: 'notes', text: t('notesChanged'), tone: 'change' });

  if (rows.length === 0) return null;
  const tone = { add: 'text-success', remove: 'text-danger', change: 'text-ink' } as const;
  return (
    <div className="rounded-card border-2 border-primary bg-primary-soft p-4">
      <p className="font-bold">{t('title')}</p>
      {event.reason && <p className="mt-1 text-sm">{t('reason', { reason: event.reason })}</p>}
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.key} className={`font-bold ${tone[r.tone]}`}>{r.text}</li>
        ))}
      </ul>
    </div>
  );
}

// سجل الطلب: من غيّر ماذا ومتى
export async function OrderTimeline({ events }: { events: OrderEvent[] }) {
  const locale = await getLocale();
  const t = await getTranslations('orders.timeline');
  const ts = await getTranslations('status');
  const tr = await getTranslations('roles');
  if (events.length === 0) return null;

  const label = (e: OrderEvent) => {
    switch (e.event_type) {
      case 'created':
        return t('created');
      case 'items_edited':
        return t('edited');
      case 'change_acknowledged':
        return t('changeAcknowledged');
      case 'status_changed':
        return e.to_status ? t('statusChanged', { status: ts(e.to_status) }) : t('note');
      default:
        return t('note');
    }
  };

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-bold">{label(e)}</p>
            <p className="text-ink-muted">
              {formatDate(locale, e.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
              {e.actor_role && ` · ${tr(e.actor_role)}`}
            </p>
            {e.reason && <p className="mt-0.5">{e.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
