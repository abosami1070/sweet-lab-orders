import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('planner.title') };
}

export default function PlannerPage() {
  return <PhasePlaceholder page="planner" />;
}
