import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CheckCircle2, Pencil, Repeat } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getOrder } from '@/lib/orders';
import { EDITABLE_BY_CUSTOMER } from '@/lib/order-rules';
import { isUuid } from '@/lib/forms';
import { PageHeader, Section } from '@/components/ui/page-parts';
import { OrderSummary, OrderTimeline } from '@/components/orders/order-details';
import { CustomerActions } from '@/components/orders/order-actions';
import { RealtimeRefresh } from '@/components/realtime-refresh';

export async function generateMetadata() {
  const t = await getTranslations('orders.view');
  return { title: t('title') };
}

export default async function CustomerOrderPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; updated?: string }>;
}) {
  const { id } = await params;
  const { placed, updated } = await searchParams;
  if (!isUuid(id)) notFound();
  const t = await getTranslations('orders.view');
  const { order, events } = await getOrder(id);
  if (!order) notFound();
  const editable = EDITABLE_BY_CUSTOMER.includes(order.status);

  return (
    <section className="max-w-3xl">
      <RealtimeRefresh channel={`order-${id}`} />
      <PageHeader title={t('title')} back={{ href: '/customer/orders', label: t('back') }} />

      {(placed || updated) && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-card border border-success p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <span>
            <b>{placed ? t('placedTitle') : t('updatedTitle')}</b>
            <span className="block text-sm text-ink-muted">{t('placedBody')}</span>
          </span>
        </p>
      )}

      {order.status === 'needs_review' && (
        <p className="mb-4 rounded-card border-2 border-primary bg-primary-soft p-4 text-sm">
          <b className="block">{t('needsReviewTitle')}</b>
          {t('needsReviewBody')}
        </p>
      )}

      <OrderSummary order={order} />

      <div className="mt-4 flex flex-wrap items-start gap-2">
        {editable && (
          <Link href={`/customer/orders/${order.id}/edit`} className="btn-primary">
            <Pencil className="h-4 w-4" aria-hidden />
            {t('edit')}
          </Link>
        )}
        <Link href={`/customer/orders/new?reorder=${order.id}`} className="btn-ghost">
          <Repeat className="h-4 w-4" aria-hidden />
          {t('reorder')}
        </Link>
      </div>
      <div className="mt-3">
        <CustomerActions orderId={order.id} status={order.status} revision={order.revision} />
      </div>

      <Section title={t('history')}>
        <OrderTimeline events={events} />
      </Section>
    </section>
  );
}
