import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from './login-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { BrandMark } from '@/components/brand-mark';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('title') };
}

export default async function LoginPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  const { next, error } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <BrandMark className="h-9 w-9" />
          <span className="text-lg font-extrabold">{tc('appName')}</span>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] font-extrabold">{t('title')}</h1>
          <p className="mt-1 text-ink-muted">{t('subtitle')}</p>

          <div className="card mt-6 p-5">
            <LoginForm next={next} initialError={error === 'inactiveAccount' ? 'inactiveAccount' : undefined} />
          </div>

          <p className="mt-5 text-sm text-ink-muted">{t('noAccount')}</p>
        </div>
      </section>
    </main>
  );
}
