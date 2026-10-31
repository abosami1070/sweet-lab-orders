import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasServiceKey } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/auth';
import { isUuid } from '@/lib/forms';
import { formatDate } from '@/lib/format';
import { ActiveBadge, PageHeader, Section } from '@/components/ui/page-parts';
import { EditUserForm, ResetPassword, type EditableUser, type ShopOption } from '../user-forms';
import type { AppRole } from '@/types/app';

export async function generateMetadata() {
  const t = await getTranslations('admin.users');
  return { title: t('editTitle') };
}

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const locale = await getLocale();
  const t = await getTranslations('admin.users');
  const tc = await getTranslations('admin.common');
  const tr = await getTranslations('roles');
  const me = (await getCurrentProfile())!;
  const supabase = await createClient();

  const [{ data: profile }, { data: shopsData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, customer_id, is_active, customer:customers(phone)')
      .eq('id', id)
      .maybeSingle<EditableUser & { customer: { phone: string | null } | null }>(),
    supabase.from('customers').select('id, name_ar, name_en, is_active').order(locale === 'ar' ? 'name_ar' : 'name_en')
  ]);
  if (!profile) notFound();
  // المشرف لا يفتح حسابات الموظفين
  if (me.role === 'admin' && profile.role !== 'customer') notFound();

  let email = '';
  let lastSignIn: string | null = null;
  let createdAt: string | null = null;
  if (hasServiceKey()) {
    try {
      const { data } = await createAdminClient().auth.admin.getUserById(id);
      email = data.user?.email ?? '';
      lastSignIn = data.user?.last_sign_in_at ?? null;
      createdAt = data.user?.created_at ?? null;
    } catch {
      // الصفحة تعمل بدون البريد
    }
  }

  const isSelf = me.id === profile.id;
  const roles: AppRole[] = me.role === 'super_admin' ? ['customer', 'kitchen_staff', 'admin', 'super_admin'] : ['customer'];
  const { customer, ...user } = profile;

  return (
    <section className="max-w-3xl">
      <PageHeader
        title={profile.full_name || tr(profile.role)}
        description={email || undefined}
        back={{ href: '/admin/users', label: t('title') }}
        action={<ActiveBadge active={profile.is_active} labels={{ on: tc('active'), off: tc('inactive') }} />}
      />
      {(createdAt || lastSignIn) && (
        <p className="-mt-3 mb-5 text-sm text-ink-muted">
          {createdAt && t('createdAt', { date: formatDate(locale, createdAt) })}
          {createdAt && ' · '}
          {lastSignIn ? t('lastSignIn', { date: formatDate(locale, lastSignIn, { dateStyle: 'medium', timeStyle: 'short' }) }) : t('neverSignedIn')}
        </p>
      )}

      <EditUserForm user={user} roles={roles} shops={(shopsData ?? []) as ShopOption[]} isSelf={isSelf} />

      {hasServiceKey() && email && (
        <Section title={t('passwordSection')} description={t('passwordSectionHint')}>
          <ResetPassword userId={profile.id} email={email} name={profile.full_name} phone={customer?.phone ?? undefined} />
        </Section>
      )}
    </section>
  );
}
