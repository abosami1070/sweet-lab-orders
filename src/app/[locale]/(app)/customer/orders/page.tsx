import { getTranslations } from 'next-intl/server';
import { ClipboardList, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { ORDER_SELECT, type OrderRow } from '@/lib/orders';
import { OPEN_STATUSES } from '@/lib/order-rules';
import { EmptyState, PageHeader, Section } from '@/components/ui/page-parts';
import { OrderList } from '@/components/orders/order-list';
import { RealtimeRefresh } from '@/components/realtime-refresh';

export async function generateMetadata() {
  const t = await getTranslations('orders.mine');
  return { title: t('title') };
}

// طلبات المحل: الجارية أولاً ثم آخر الطلبات المنتهية
export default async function MyOrdersPage() {
  const t = await getTranslations('orders.mine');
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select(ORDER_SELECT).order('delivery_date', { ascending: true }).order('created_at', { ascending: false }).limit(200);
  const orders = (data ?? []) as unknown as OrderRow[];
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status));
  const past = orders
    .filter((o) => !OPEN_STATUSES.includes(o.status))
    .sort((a, b) => b.delivery_date.localeCompare(a.delivery_date))
    .slice(0, 50);

  const newButton = (
    <Link href="/customer/orders/new" className="btn-primary">
      <Plus className="h-4 w-4" aria-hidden />
      {t('new')}
    </Link>
  );

  return (
    <section>
      <RealtimeRefresh channel="my-orders" />
      <PageHeader title={t('title')} description={t('description')} action={orders.length > 0 ? newButton : undefined} />
      {orders.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" aria-hidden />} title={t('emptyTitle')} body={t('emptyBody')} action={newButton} />
      ) : (
        <>
          <Section title={t('open')}>
            {open.length ? <OrderList orders={open} basePath="/customer/orders" /> : <p className="text-sm text-ink-muted">{t('noOpen')}</p>}
          </Section>
          {past.length > 0 && (
            <Section title={t('past')}>
              <OrderList orders={past} basePath="/customer/orders" />
            </Section>
          )}
        </>
      )}
    </section>
  );
}
