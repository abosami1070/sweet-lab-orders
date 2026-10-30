'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';

// ساعة المعمل: دائماً بتوقيت الرياض بغض النظر عن إعداد الجهاز
export function RiyadhClock() {
  const locale = useLocale();
  const t = useTranslations('common');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="inline-block w-24" />;
  return (
    <span className="flex flex-col items-end leading-tight" title={t('riyadhTime')}>
      <span className="text-xl font-extrabold tabular-nums">
        {formatDate(locale, now, { hour: 'numeric', minute: '2-digit' })}
      </span>
      <span className="text-xs text-ink-muted">{formatDate(locale, now, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
    </span>
  );
}
