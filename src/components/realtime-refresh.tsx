'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// يستمع لتغييرات الطلبات (حسب صلاحية المستخدم في RLS) ويحدّث بيانات الصفحة دون إعادة تحميلها
export function RealtimeRefresh({ channel }: { channel: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscribedOnce = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const sub = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refresh)
      .subscribe((status) => {
        // بعد انقطاع وعودة الاتصال: حدّث مرة لالتقاط ما فات
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) refresh();
          subscribedOnce = true;
        }
      });

    window.addEventListener('online', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', refresh);
      supabase.removeChannel(sub);
    };
  }, [channel, router]);

  return null;
}
