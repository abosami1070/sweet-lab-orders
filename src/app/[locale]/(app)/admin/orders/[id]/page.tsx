import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Pencil } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getOrder } from '@/lib/orders';
import { adminActions, EDITABLE_BY_ADMIN } from '@/lib/order-rules';
import { isUuid } from '@/lib/forms';
import { PageHeader, Section } from '@/components/ui/page-parts';
import { OrderDiff, OrderSummary, OrderTimeline } from '@/components/orders/order-details';
import { StaffActions } from '@/components/orders/order-actions';
import { RealtimeRefresh } from '@/components/realtime-refresh';

export async function generateMetadata() {
  const t = await getTranslations('orders.view');
  return { title: t('title') };
}

// تفاصيل الطلب للإدارة: القرار (اعتماد/تعديل/رفض/إلغاء)، التعديل، الفروقات، والسجل
export default async function AdminOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string }> }) {
  const { id } = await params;
  const { updated } = await searchParams;
  if (!isUuid(id)) notFound();
  const t = await getTranslations('orders.view');
  const { order, events } = await getOrder(id);
  if (!order) notFound();

  const lastEdit = events.find((e) => e.event_type === 'items_edited');
  const showDiff = lastEdit && lastEdit.revision === order.revision && order.status !== 'delivered';

  return (
    <section className="max-w-3xl">
      <RealtimeRefresh channel={`admin-order-${id}`} />
      <PageHeader title={t('title')} back={{ href: '/admin/orders', label: t('backAdmin') }} />

      {updated && (
        <p role="status" className="mb-4 rounded-card border border-success p-3 font-bold text-success">{t('updatedTitle')}</p>
      )}
      {showDiff && (
        <div className="mb-4">
          <OrderDiff event={lastEdit!} />
        </div>
      )}

      <OrderSummary order={order} showShop />

      <div className="mt-4 space-y-3">
        <StaffActions orderId={order.id} status={order.status} revision={order.revision} actions={adminActions(order.status)} />
        {EDITABLE_BY_ADMIN.includes(order.status) && (
          <Link href={`/admin/orders/${order.id}/edit`} className="btn-ghost">
            <Pencil className="h-4 w-4" aria-hidden />
            {t('editItems')}
          </Link>
        )}
      </div>

      <Section title={t('history')}>
        <OrderTimeline events={events} />
      </Section>
    </section>
  );
}
