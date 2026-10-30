import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Almarai, Figtree } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { directionOf, routing } from '@/i18n/routing';
import '../globals.css';

// Almarai للحروف العربية، وFigtree للحروف اللاتينية والأرقام
const arabic = Almarai({ subsets: ['arabic'], weight: ['300', '400', '700', '800'], variable: '--font-arabic', display: 'swap' });
const latin = Figtree({ subsets: ['latin'], weight: ['400', '700', '800'], variable: '--font-latin', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title'), template: `%s · Sweet Lab` },
    description: t('description'),
    applicationName: 'Sweet Lab',
    appleWebApp: { capable: true, title: 'Sweet Lab', statusBarStyle: 'default' },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' }
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBF8F1' },
    { media: '(prefers-color-scheme: dark)', color: '#15120C' }
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={directionOf(locale)} className={`${arabic.variable} ${latin.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
