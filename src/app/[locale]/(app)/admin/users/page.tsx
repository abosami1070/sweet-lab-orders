import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft, KeyRound, UserPlus, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, hasServiceKey } from '@/lib/supabase/admin';
import { getCurrentProfile } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { ActiveBadge, EmptyState, PageHeader } from '@/components/ui/page-parts';
import type { AppRole } from '@/types/app';

export async function generateMetadata() {
  const t = await getTranslations('admin.users');
  return { title: t('title') };
}

type Row = {
  id: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  customer: { name_ar: string; name_en: string } | null;
};

const ROLE_ORDER: AppRole[] = ['super_admin', 'admin', 'kitchen_staff', 'customer'];

// البريد وآخر دخول من Auth (بمفتاح الخدمة في الخادم فقط)
async function authInfo() {
  const info = new Map<string, { email: string; last: string | null }>();
  if (!hasServiceKey()) return info;
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data?.users ?? []) info.set(u.id, { email: u.email ?? '', last: u.last_sign_in_at ?? null });
  } catch {
    // نعرض القائمة بدون البريد بدل إيقاف الصفحة
  }
  return info;
}

export default async function UsersPage() {
  const locale = await getLocale();
  const t = await getTranslations('admin.users');
  const tc = await getTranslations('admin.common');
  const tr = await getTranslations('roles');
  const me = (await getCurrentProfile())!;
  const supabase = await createClient();

  let query = supabase
    .from('profiles')
    .select('id, full_name, role, is_active, customer:customers(name_ar, name_en)')
    .order('full_name');
  // المشرف يدير حسابات العملاء فقط
  if (me.role === 'admin') query = query.eq('role', 'customer');
  const [{ data }, info] = await Promise.all([query, authInfo()]);
  const rows = ((data ?? []) as unknown as Row[]).sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || Number(b.is_active) - Number(a.is_active)
  );
  const serviceReady = hasServiceKey();

  const addButton = serviceReady ? (
    <Link href="/admin/users/new" className="btn-primary">
      <UserPlus className="h-4 w-4" aria-hidden />
      {t('add')}
    </Link>
  ) : undefined;

  return (
    <section>
      <PageHeader title={t('title')} description={me.role === 'admin' ? t('descriptionAdmin') : t('description')} action={addButton} />

      {!serviceReady && (
        <div role="note" className="mb-5 flex items-start gap-3 rounded-card border border-warning bg-surface p-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-bold">{t('serviceKeyTitle')}</p>
            <p className="text-sm text-ink-muted">{t('serviceKeyBody')}</p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" aria-hidden />} title={t('emptyTitle')} body={t('emptyBody')} action={addButton} />
      ) : (
        <ul className="card divide-y divide-line">
          {rows.map((u) => {
            const auth = info.get(u.id);
            const shop = u.customer ? (locale === 'ar' ? u.customer.name_ar : u.customer.name_en) : null;
            return (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex min-h-touch-lg items-center gap-3 px-4 py-3 hover:bg-primary-soft">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{u.full_name || '—'}</span>
                      {u.id === me.id && <span className="text-xs text-ink-muted">{t('you')}</span>}
                    </span>
                    {auth?.email && <span dir="ltr" className="block truncate text-sm text-ink-muted rtl:text-right">{auth.email}</span>}
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-ink-muted">
                      <span className="font-bold">{tr(u.role)}</span>
                      {shop && <span>{shop}</span>}
                      <span>
                        {auth?.last
                          ? t('lastSignIn', { date: formatDate(locale, auth.last, { dateStyle: 'medium', timeStyle: 'short' }) })
                          : auth
                            ? t('neverSignedIn')
                            : null}
                      </span>
                    </span>
                  </span>
                  <ActiveBadge active={u.is_active} labels={{ on: tc('active'), off: tc('inactive') }} />
                  <ChevronLeft className="h-5 w-5 shrink-0 text-ink-muted ltr:-scale-x-100" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
