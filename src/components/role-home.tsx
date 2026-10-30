import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatNumber } from '@/lib/format';
import { navForRole } from '@/lib/nav';
import { StatusBadge } from './status-badge';
import { RealtimeRefresh } from './realtime-refresh';
import type { OrderStatus, Profile } from '@/types/app';

const STATUSES_BY_ROLE: Record<Profile['role'], OrderStatus[]> = {
  customer: ['pending_approval', 'needs_review', 'awaiting_kitchen', 'in_production', 'ready'],
  admin: ['pending_approval', 'needs_review', 'awaiting_kitchen', 'acknowledged', 'in_production', 'ready'],
  super_admin: ['pending_approval', 'needs_review', 'awaiting_kitchen', 'acknowledged', 'in_production', 'ready'],
  kitchen_staff: ['awaiting_kitchen', 'acknowledged', 'in_production', 'ready']
};

// الصفحة الرئيسية لكل دور: الأرقام تأتي من view يحترم RLS، فكل مستخدم يرى ما يخصه فقط
export async function RoleHome({ profile }: { profile: Profile }) {
  const locale = await getLocale();
  const t = await getTranslations('home');
  const tn = await getTranslations('nav');
  const tr = await getTranslations('roles');

  const supabase = await createClient();
  const { data } = await supabase.from('order_status_counts').select('status, total');
  const rows = (data ?? []) as { status: OrderStatus; total: number }[];
  const counts = new Map<OrderStatus, number>(rows.map((r) => [r.status, r.total] as const));
  const statuses = STATUSES_BY_ROLE[profile.role];
  const anyOrders = statuses.some((s) => (counts.get(s) ?? 0) > 0);

  const shop = profile.customer ? (locale === 'ar' ? profile.customer.name_ar : profile.customer.name_en) : '';
  const links = navForRole(profile.role).slice(1);

  return (
    <section>
      <RealtimeRefresh channel={`home-${profile.id}`} />
      <h1 className="text-2xl font-extrabold sm:text-[28px]">{t('greeting', { name: profile.full_name || tr(profile.role) })}</h1>
      <p className="text-ink-muted">
        {profile.role === 'customer' ? t('customerIntro', { shop }) : t('staffIntro', { role: tr(profile.role) })}
      </p>

      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-lg">{t('summary')}</h2>
        <p className="text-xs text-ink-muted">{t('liveHint')}</p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statuses.map((s) => (
          <li key={s} className="card p-4">
            <StatusBadge status={s} />
            <p className="mt-3 text-[32px] font-extrabold leading-none tabular-nums">
              {formatNumber(locale, counts.get(s) ?? 0)}
            </p>
          </li>
        ))}
      </ul>
      {!anyOrders && (
        <p className="mt-3 text-sm text-ink-muted">
          {profile.role === 'customer' ? t('emptyCustomer') : t('emptyStaff')}
        </p>
      )}

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card flex min-h-touch-lg items-center justify-between px-5 font-bold hover:border-primary">
              {tn(l.key)}
              <ChevronLeft className="h-5 w-5 text-ink-muted ltr:-scale-x-100" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
