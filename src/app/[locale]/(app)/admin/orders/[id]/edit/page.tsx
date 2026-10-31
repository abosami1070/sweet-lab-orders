import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrder, getOrderFormData } from '@/lib/orders';
import { EDITABLE_BY_ADMIN } from '@/lib/order-rules';
import { isUuid } from '@/lib/forms';
import { PageHeader } from '@/components/ui/page-parts';
import { OrderForm } from '@/components/orders/order-form';

export async function generateMetadata() {
  const t = await getTranslations('orders.edit');
  return { title: t('title') };
}

// تعديل الإدارة: بعد الاعتماد يصبح ذكر السبب إلزامياً، ويظهر للمعمل تنبيه بالتعديل
export default async function AdminEditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const t = await getTranslations('orders.edit');
  const { order } = await getOrder(id);
  if (!order) notFound();
  const back = { href: `/admin/orders/${id}`, label: t('back') };

  if (!EDITABLE_BY_ADMIN.includes(order.status)) {
    return (
      <section className="max-w-3xl">
        <PageHeader title={t('title')} back={back} />
        <p className="card p-5">{t('locked')}</p>
      </section>
    );
  }

  const data = await getOrderFormData(order.customer_id);
  const approved = Boolean(order.approved_at);
  return (
    <section>
      <PageHeader title={t('titleWithNumber', { n: order.order_number })} description={approved ? t('descriptionApproved') : t('description')} back={back} />
      <OrderForm
        data={data}
        mode="edit"
        basePath="/admin/orders"
        reasonRequired={approved}
        initial={{
          orderId: order.id,
          revision: order.revision,
          deliveryDate: order.delivery_date,
          windowId: order.delivery_window_id,
          branchId: order.branch_id,
          notes: order.customer_notes,
          items: order.order_items.map((i) => ({ product_id: i.product_id, quantity: Number(i.quantity), notes: i.item_notes }))
        }}
      />
    </section>
  );
}
