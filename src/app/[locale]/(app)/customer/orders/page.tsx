import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('myOrders.title') };
}

export default function MyOrdersPage() {
  return <PhasePlaceholder page="myOrders" />;
}
