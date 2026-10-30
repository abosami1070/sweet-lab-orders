import { getLocale, getTranslations } from 'next-intl/server';
import { LogOut } from 'lucide-react';
import { BrandMark } from './brand-mark';
import { ConnectionBanner } from './connection-banner';
import { LocaleSwitcher } from './locale-switcher';
import { NavLinks } from './nav-links';
import { RiyadhClock } from './riyadh-clock';
import { navForRole } from '@/lib/nav';
import { signOut } from '@/lib/actions/auth';
import type { Profile } from '@/types/app';

// قالب التنقل: يتغير حسب الدور
// - العميل والإدارة: شريط جانبي على سطح المكتب، وأزرار أفقية على الجوال
// - المعمل: شريط علوي كبير للمس على الآيباد بدون شريط جانبي
export async function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations('common');
  const tr = await getTranslations('roles');
  const items = navForRole(profile.role);
  const isKitchen = profile.role === 'kitchen_staff';
  const shop = profile.customer ? (locale === 'ar' ? profile.customer.name_ar : profile.customer.name_en) : null;

  const signOutForm = (compact: boolean) => (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={compact ? 'btn-ghost min-h-[40px] px-3' : 'btn-ghost w-full'} aria-label={t('signOut')}>
        <LogOut className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        <span className={compact ? 'sr-only sm:not-sr-only' : ''}>{t('signOut')}</span>
      </button>
    </form>
  );

  const identity = (
    <div className="min-w-0">
      <p className="truncate font-bold">{profile.full_name || tr(profile.role)}</p>
      <p className="truncate text-sm text-ink-muted">{shop ?? tr(profile.role)}</p>
    </div>
  );

  if (isKitchen) {
    return (
      <div className="flex min-h-dvh flex-col">
        <ConnectionBanner />
        <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
          <div className="flex flex-wrap items-center gap-4 px-5 py-3">
            <div className="flex items-center gap-3">
              <BrandMark className="h-11 w-11" />
              {identity}
            </div>
            <nav aria-label={t('mainNav')} className="order-last w-full md:order-none md:w-auto md:flex-1 md:ps-6">
              <NavLinks items={items} variant="kitchen" />
            </nav>
            <div className="ms-auto flex items-center gap-3">
              <RiyadhClock />
              <LocaleSwitcher />
              {signOutForm(true)}
            </div>
          </div>
        </header>
        <main className="flex-1 p-5">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <BrandMark className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-lg font-extrabold">{t('appName')}</p>
            <p className="text-xs text-ink-muted">{t('appTagline')}</p>
          </div>
        </div>
        <nav aria-label={t('mainNav')} className="flex-1">
          <NavLinks items={items} variant="sidebar" />
        </nav>
        <div className="space-y-3 border-t border-line pt-4">
          {identity}
          <LocaleSwitcher className="w-full" />
          {signOutForm(false)}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <BrandMark className="h-9 w-9" />
            {identity}
            <div className="ms-auto flex items-center gap-2">
              <LocaleSwitcher />
              {signOutForm(true)}
            </div>
          </div>
          <nav aria-label={t('mainNav')}>
            <NavLinks items={items} variant="pills" />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
