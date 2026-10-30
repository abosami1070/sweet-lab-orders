import { getTranslations } from 'next-intl/server';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('settings.title') };
}

export default function SettingsPage() {
  return <PhasePlaceholder page="settings" />;
}
