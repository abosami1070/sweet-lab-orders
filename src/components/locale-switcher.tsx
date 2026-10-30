'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { savePreferredLocale } from '@/lib/actions/locale';

export function LocaleSwitcher({ className = '' }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const target = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t('switchLanguageLabel')}
      lang={target}
      onClick={() =>
        startTransition(async () => {
          await savePreferredLocale(target);
          router.replace(pathname, { locale: target });
        })
      }
      className={`btn-ghost min-h-[40px] px-3 text-sm ${className}`}
    >
      <Languages className="h-4 w-4" aria-hidden />
      {t('switchLanguage')}
    </button>
  );
}
