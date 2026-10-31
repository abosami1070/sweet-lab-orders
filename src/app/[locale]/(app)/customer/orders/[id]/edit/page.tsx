import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentProfile } from '@/lib/auth';
import { getOrder, getOrderFormData } from '@/lib/orders';
import { EDITABLE_BY_CUSTOMER } from '@/lib/order-rules';
import { isUuid } from '@/lib/forms';
import { PageHeader } from '@/components/ui/page-parts';
import { OrderForm } from '@/components/orders/order-form';

export async function generateMetadata() {
  const t = await getTranslations('orders.edit');
  return { title: t('title') };
}

// تعديل الطلب متاح للعميل قبل الاعتماد فقط (والقاعدة تفرض ذلك أيضاً)
export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const t = await getTranslations('orders.edit');
  const profile = (await getCurrentProfile())!;
  const { order } = await getOrder(id);
  if (!order) notFound();

  const back = { href: `/customer/orders/${id}`, label: t('back') };
  if (!EDITABLE_BY_CUSTOMER.includes(order.status)) {
    return (
      <section className="max-w-3xl">
        <PageHeader title={t('title')} back={back} />
        <p className="card p-5">{t('locked')}</p>
      </section>
    );
  }

  const data = await getOrderFormData(profile.customer_id!);
  return (
    <section>
      <PageHeader title={t('titleWithNumber', { n: order.order_number })} description={t('description')} back={back} />
      <OrderForm
        data={data}
        mode="edit"
        basePath="/customer/orders"
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
