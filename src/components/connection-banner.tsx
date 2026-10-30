'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WifiOff, Wifi } from 'lucide-react';

// تنبيه دائم عند انقطاع الاتصال، ورسالة قصيرة عند عودته
export function ConnectionBanner() {
  const t = useTranslations('common');
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    let timer: ReturnType<typeof setTimeout>;
    const up = () => {
      setOnline(true);
      setRestored(true);
      timer = setTimeout(() => setRestored(false), 3000);
    };
    const down = () => {
      clearTimeout(timer);
      setRestored(false);
      setOnline(false);
    };
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online && !restored) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold ${
        online ? 'bg-success text-white' : 'bg-danger text-white'
      }`}
    >
      {online ? <Wifi className="h-4 w-4" aria-hidden /> : <WifiOff className="h-4 w-4" aria-hidden />}
      {online ? t('backOnline') : t('offline')}
    </div>
  );
}
