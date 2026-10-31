import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarRange } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { DATE_RE } from '@/lib/forms';
import { formatDate, formatNumber, riyadhToday } from '@/lib/format';
import { EmptyState, PageHeader } from '@/components/ui/page-parts';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import type { ProductUnit } from '@/types/app';

type PlanRow = {
  delivery_date: string;
  product_id: string;
  product_name_ar: string;
  product_name_en: string;
  unit: ProductUnit;
  approved_quantity: number | null;
  pending_quantity: number | null;
  order_count: number;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function generateMetadata() {
  const t = await getTranslations('planner');
  return { title: t('title') };
}

// جدول الإنتاج: مجموع الكميات لكل صنف في يوم التسليم. المعتمد للتجهيز، والمعلّق للتخطيط فقط.
// المعمل يرى المعتمد فقط (RLS عبر الـ view)، والإدارة ترى الاثنين.
export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const locale = await getLocale();
  const t = await getTranslations('planner');
  const tu = await getTranslations('units');
  const ar = locale === 'ar';
  const today = riyadhToday();
  const sp = await searchParams;
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const supabase = await createClient();
  const { data } = await supabase.from('production_plan').select('*').eq('delivery_date', date);
  const rows = ((data ?? []) as PlanRow[]).sort((a, b) =>
    ar ? a.product_name_ar.localeCompare(b.product_name_ar, 'ar') : a.product_name_en.localeCompare(b.product_name_en)
  );
  const anyPending = rows.some((r) => Number(r.pending_quantity ?? 0) > 0);
  const n = (v: number | null) => formatNumber(locale, Number(v ?? 0));

  return (
    <section>
      <RealtimeRefresh channel="planner" />
      <PageHeader title={t('title')} description={t('description')} />

      <nav aria-label={t('daysLabel')} className="mb-5 flex flex-wrap gap-2">
        {days.map((d, i) => (
          <Link key={d} href={i === 0 ? '/planner' : `/planner?date=${d}`} aria-current={d === date ? 'page' : undefined} className={d === date ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>
            {i === 0 ? t('today') : formatDate(locale, `${d}T12:00:00Z`, { weekday: 'short', day: 'numeric' })}
          </Link>
        ))}
      </nav>

      <h2 className="mb-3 text-lg">{formatDate(locale, `${date}T12:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>

      {rows.length === 0 ? (
        <EmptyState icon={<CalendarRange className="h-6 w-6" aria-hidden />} title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-start">
            <thead className="border-b border-line text-sm text-ink-muted">
              <tr>
                <th scope="col" className="p-3 text-start font-bold">{t('product')}</th>
                <th scope="col" className="p-3 text-start font-bold">{t('approved')}</th>
                {anyPending && <th scope="col" className="p-3 text-start font-bold">{t('pending')}</th>}
                <th scope="col" className="p-3 text-start font-bold">{t('orders')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.product_id}>
                  <th scope="row" className="p-3 text-start text-lg font-bold">{ar ? r.product_name_ar : r.product_name_en}</th>
                  <td className="p-3 text-xl font-extrabold">
                    {n(r.approved_quantity)} <span className="text-sm font-normal text-ink-muted">{tu(r.unit)}</span>
                  </td>
                  {anyPending && <td className="p-3 text-ink-muted">{Number(r.pending_quantity ?? 0) > 0 ? `${n(r.pending_quantity)} ${tu(r.unit)}` : '—'}</td>}
                  <td className="p-3">{n(r.order_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {anyPending && <p className="mt-3 text-sm text-ink-muted">{t('pendingHint')}</p>}
    </section>
  );
}
