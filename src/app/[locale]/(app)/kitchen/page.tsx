import { getTranslations } from 'next-intl/server';
import { getCurrentProfile } from '@/lib/auth';
import { RoleHome } from '@/components/role-home';
import { PhasePlaceholder } from '@/components/phase-placeholder';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('kitchen.title') };
}

export default async function KitchenPage() {
  const profile = (await getCurrentProfile())!;
  return (
    <div className="space-y-10">
      <RoleHome profile={profile} />
      <PhasePlaceholder page="kitchen" />
    </div>
  );
}
