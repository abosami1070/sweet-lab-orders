import { getLocale, getTranslations } from 'next-intl/server';
import { Clock, MapPin, MessageSquareText, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { ORDER_SELECT, type OrderRow } from '@/lib/orders';
import { kitchenNextAction } from '@/lib/order-rules';
import { DATE_RE } from '@/lib/forms';
import { formatDate, formatNumber, hhmm, riyadhToday } from '@/lib/format';
import { ItemsList } from '@/components/orders/order-details';
import { AcknowledgeChangeButton, StaffActions } from '@/components/orders/order-actions';
import { KitchenAlerts } from '@/components/orders/kitchen-alerts';
import type { OrderStatus } from '@/types/app';

const COLUMNS: OrderStatus[] = ['awaiting_kitchen', 'acknowledged', 'in_production', 'ready'];
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function generateMetadata() {
  const t = await getTranslations('kitchen');
  return { title: t('title') };
}

// لوحة المعمل: الطلبات المعتمدة ليوم التسليم المختار، في أعمدة حسب مرحلة التجهيز.
// الطلب المعدّل بعد الاستلام لا يتقدم قبل أن يؤكد المعمل اطلاعه على التعديل (تفرضه القاعدة).
export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const locale = await getLocale();
  const t = await getTranslations('kitchen');
  const ts = await getTranslations('status');
  const tu = await getTranslations('units');
  const ar = locale === 'ar';
  const today = riyadhToday();
  const sp = await searchParams;
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const [{ data }, { data: overdue }] = await Promise.all([
    supabase.from('orders').select(ORDER_SELECT).eq('delivery_date', date).in('status', [...COLUMNS, 'cancelled', 'delivered']).order('created_at'),
    // طلبات أيام سابقة لم تُسلَّم بعد: تظهر كتنبيه حتى لا تضيع
    supabase.from('orders').select('delivery_date').lt('delivery_date', today).in('status', COLUMNS).order('delivery_date').limit(100)
  ]);
  const orders = (data ?? []) as unknown as OrderRow[];
  const overdueRows = (overdue ?? []) as { delivery_date: string }[];

  const known = Object.fromEntries(orders.map((o) => [o.id, { status: o.status, revision: o.revision }]));
  const days = [0, 1, 2].map((n) => addDays(today, n));
  const name = (x: { name_ar: string; name_en: string } | null) => (x ? (ar ? x.name_ar : x.name_en) : '');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  return (
    <section>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('title')}</h1>
          <p className="text-ink-muted">{formatDate(locale, `${date}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <KitchenAlerts known={known} />
      </header>

      <nav aria-label={t('daysLabel')} className="mb-5 flex flex-wrap gap-2">
        {days.map((d, i) => (
          <Link key={d} href={i === 0 ? '/kitchen' : `/kitchen?date=${d}`} aria-current={d === date ? 'page' : undefined} className={d === date ? 'btn-primary' : 'btn-ghost'}>
            {i === 0 ? t('today') : i === 1 ? t('tomorrow') : formatDate(locale, `${d}T12:00:00Z`, { weekday: 'long' })}
          </Link>
        ))}
        <Link href="/planner" className="btn-ghost">{t('planner')}</Link>
      </nav>

      {overdueRows.length > 0 && date === today && (
        <p role="alert" className="mb-5 flex flex-wrap items-center gap-2 rounded-card border-2 border-primary p-4 font-bold">
          <TriangleAlert className="h-5 w-5" aria-hidden />
          {t('overdue', { count: overdueRows.length, n: formatNumber(locale, overdueRows.length) })}
          <Link href={`/kitchen?date=${overdueRows[0].delivery_date}`} className="btn-ghost btn-sm">{t('showOverdue')}</Link>
        </p>
      )}

      {cancelled.length > 0 && (
        <div role="alert" className="mb-5 rounded-card border-2 border-danger p-4">
          <p className="flex items-center gap-2 font-extrabold text-danger">
            <TriangleAlert className="h-5 w-5" aria-hidden />
            {t('cancelledTitle')}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {cancelled.map((o) => (
              <li key={o.id}>
                <b dir="ltr">#{o.order_number}</b> — {name(o.customer)}
                {o.closed_reason && <span className="text-ink-muted"> · {o.closed_reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((status) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <section key={status} aria-label={ts(status)} className="rounded-card bg-surface-raised p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-base">
                <span className="status-badge" data-status={status}>{ts(status)}</span>
                <span className="text-xl font-extrabold">{formatNumber(locale, list.length)}</span>
              </h2>
              {list.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-ink-muted">{t('emptyColumn')}</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((o) => {
                    const changed = o.revision > o.kitchen_seen_revision && status !== 'awaiting_kitchen';
                    const next = kitchenNextAction(o.status);
                    return (
                      <li key={o.id} className={`card p-4 ${changed ? 'border-2 border-primary' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-2xl font-extrabold" dir="ltr">#{o.order_number}</span>
                          {o.window && (
                            <span className="flex items-center gap-1 text-sm font-bold">
                              <Clock className="h-4 w-4" aria-hidden />
                              <span dir="ltr">{hhmm(o.window.start_time)}–{hhmm(o.window.end_time)}</span>
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-bold">{name(o.customer)}</p>
                        {o.branch && (
                          <p className="flex items-center gap-1 text-sm text-ink-muted">
                            <MapPin className="h-4 w-4" aria-hidden />
                            {name(o.branch)}
                          </p>
                        )}

                        {changed && <p className="mt-3 rounded-control bg-primary-soft p-2 text-sm font-extrabold">{t('changedNotice')}</p>}

                        <ItemsList items={o.order_items} unitLabel={(u) => tu(u)} locale={locale} large />

                        {o.customer_notes && (
                          <p className="mt-2 flex items-start gap-2 rounded-control bg-surface-raised p-2 text-sm">
                            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                            <span className="whitespace-pre-line">{o.customer_notes}</span>
                          </p>
                        )}

                        <div className="mt-4">
                          {changed ? (
                            <AcknowledgeChangeButton orderId={o.id} size="lg" />
                          ) : next ? (
                            <StaffActions orderId={o.id} status={o.status} revision={o.revision} actions={[next]} size="lg" />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {deliveredCount > 0 && <p className="mt-5 text-sm text-ink-muted">{t('deliveredCount', { count: deliveredCount, n: formatNumber(locale, deliveredCount) })}</p>}
    </section>
  );
}
