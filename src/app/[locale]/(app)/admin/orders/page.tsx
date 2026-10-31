import { getTranslations } from 'next-intl/server';
import { ClipboardList } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { ORDER_SELECT, type OrderRow } from '@/lib/orders';
import { DATE_RE } from '@/lib/forms';
import { EmptyState, PageHeader } from '@/components/ui/page-parts';
import { OrderList } from '@/components/orders/order-list';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import type { OrderStatus } from '@/types/app';

const TABS = {
  review: ['pending_approval', 'needs_review'],
  active: ['awaiting_kitchen', 'acknowledged', 'in_production', 'ready'],
  closed: ['delivered', 'rejected', 'cancelled']
} as const satisfies Record<string, readonly OrderStatus[]>;
type Tab = keyof typeof TABS;

export async function generateMetadata() {
  const t = await getTranslations('orders.admin');
  return { title: t('title') };
}

// طلبات الإدارة: بانتظار القرار أولاً، ثم الجارية في المعمل، ثم المنتهية. مع تصفية بتاريخ التسليم
export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; date?: string }> }) {
  const t = await getTranslations('orders.admin');
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : 'review';
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : '';

  const supabase = await createClient();
  let query = supabase.from('orders').select(ORDER_SELECT).in('status', [...TABS[tab]]);
  if (date) query = query.eq('delivery_date', date);
  query = tab === 'closed' ? query.order('delivery_date', { ascending: false }).limit(100) : query.order('delivery_date').order('created_at').limit(300);
  const { data } = await query;
  const orders = (data ?? []) as unknown as OrderRow[];

  const href = (next: { tab?: Tab; date?: string }) => {
    const q = new URLSearchParams();
    const nt = next.tab ?? tab;
    const nd = next.date ?? date;
    if (nt !== 'review') q.set('tab', nt);
    if (nd) q.set('date', nd);
    const s = q.toString();
    return `/admin/orders${s ? `?${s}` : ''}`;
  };

  return (
    <section>
      <RealtimeRefresh channel="admin-orders" />
      <PageHeader title={t('title')} description={t('description')} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <nav aria-label={t('tabsLabel')} className="flex flex-wrap gap-2">
          {(Object.keys(TABS) as Tab[]).map((k) => (
            <Link key={k} href={href({ tab: k })} aria-current={k === tab ? 'page' : undefined} className={k === tab ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>
              {t(`tabs.${k}`)}
            </Link>
          ))}
        </nav>
        <form className="flex items-end gap-2" action="">
          {tab !== 'review' && <input type="hidden" name="tab" value={tab} />}
          <label className="text-sm">
            <span className="mb-1 block font-bold">{t('dateFilter')}</span>
            <input type="date" name="date" defaultValue={date} dir="ltr" className="field h-10" />
          </label>
          <button type="submit" className="btn-ghost btn-sm h-10">{t('apply')}</button>
          {date && <Link href={href({ date: '' })} className="btn-ghost btn-sm h-10">{t('clear')}</Link>}
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" aria-hidden />} title={t(`empty.${tab}`)} />
      ) : (
        <OrderList orders={orders} basePath="/admin/orders" showShop />
      )}
    </section>
  );
}
