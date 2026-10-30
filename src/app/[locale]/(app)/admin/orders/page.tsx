import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('orders.title') };
}

export default function AdminOrdersPage() {
  return <PhasePlaceholder page="orders" />;
}
