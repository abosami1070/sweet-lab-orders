import { getTranslations } from 'next-intl/server';
import { getCurrentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getOrderFormData } from '@/lib/orders';
import { isUuid } from '@/lib/forms';
import { PageHeader } from '@/components/ui/page-parts';
import { OrderForm, type OrderFormInitial } from '@/components/orders/order-form';

export async function generateMetadata() {
  const t = await getTranslations('orders.new');
  return { title: t('title') };
}

// طلب جديد، أو إعادة طلب سابق (?reorder=<id>) بنفس الأصناف والكميات
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ reorder?: string }> }) {
  const t = await getTranslations('orders.new');
  const profile = (await getCurrentProfile())!;
  const { reorder } = await searchParams;
  const data = await getOrderFormData(profile.customer_id!);

  let initial: OrderFormInitial | undefined;
  if (reorder && isUuid(reorder)) {
    const supabase = await createClient();
    const { data: prev } = await supabase
      .from('orders')
      .select('branch_id, delivery_window_id, order_items(product_id, quantity, item_notes)')
      .eq('id', reorder)
      .maybeSingle();
    if (prev) {
      initial = {
        branchId: prev.branch_id,
        windowId: prev.delivery_window_id,
        items: (prev.order_items ?? []).map((i: { product_id: string; quantity: number; item_notes: string | null }) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          notes: i.item_notes
        }))
      };
    }
  }

  return (
    <section>
      <PageHeader title={t('title')} description={initial ? t('reorderDescription') : t('description')} back={{ href: '/customer/orders', label: t('back') }} />
      <OrderForm data={data} mode="create" initial={initial} basePath="/customer/orders" />
    </section>
  );
}
