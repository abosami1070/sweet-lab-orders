'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/types/app';

type Known = Record<string, { status: OrderStatus; revision: number }>;
const STORAGE_KEY = 'sweetlab:kitchen-sound';

// نغمة قصيرة بثلاث نقرات عبر Web Audio (بدون ملفات صوت)
function chime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.18, 0.36].forEach((offset, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1175 : 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.18);
  });
}

// يستمع لطلبات المعمل لحظياً: يحدّث اللوحة، ويرن ويعرض تنبيهاً عند وصول طلب جديد أو تعديل طلب قيد العمل.
// المتصفح لا يسمح بالصوت قبل لمسة من المستخدم، لذلك يُفعّل التنبيه الصوتي بزر.
export function KitchenAlerts({ known }: { known: Known }) {
  const t = useTranslations('kitchen');
  const router = useRouter();
  const knownRef = useRef<Known>(known);
  const audioRef = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    knownRef.current = known;
  }, [known]);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(STORAGE_KEY) === '1');
    } catch {}
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let subscribedOnce = false;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 250);
    };
    const alert = (message: string) => {
      setToast(message);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToast(null), 8000);
      const ctx = audioRef.current;
      if (ctx && ctx.state !== 'closed') {
        void ctx.resume().then(() => chime(ctx));
      }
      if ('vibrate' in navigator) navigator.vibrate?.(200);
    };

    const channel = supabase
      .channel('kitchen-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { id?: string; status?: OrderStatus; revision?: number; order_number?: number } | undefined;
        if (row?.id && row.status) {
          const prev = knownRef.current[row.id];
          if (row.status === 'awaiting_kitchen' && prev?.status !== 'awaiting_kitchen') alert(t('newOrderToast', { n: row.order_number ?? '' }));
          else if (prev && typeof row.revision === 'number' && row.revision > prev.revision && row.status !== 'cancelled')
            alert(t('changedToast', { n: row.order_number ?? '' }));
          else if (row.status === 'cancelled' && prev && prev.status !== 'cancelled') alert(t('cancelledToast', { n: row.order_number ?? '' }));
          knownRef.current = { ...knownRef.current, [row.id]: { status: row.status, revision: row.revision ?? prev?.revision ?? 0 } };
        }
        refresh();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (subscribedOnce) refresh();
          subscribedOnce = true;
        }
      });
    window.addEventListener('online', refresh);
    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(toastTimer);
      window.removeEventListener('online', refresh);
      supabase.removeChannel(channel);
    };
  }, [router, t]);

  // يجب إنشاء/تشغيل سياق الصوت داخل لمسة المستخدم (حتى لو كان التنبيه مفعّلاً من زيارة سابقة)
  const [ready, setReady] = useState(false);
  const store = (v: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {}
  };
  const enable = () => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioRef.current ??= new Ctx();
    const ctx = audioRef.current;
    void ctx.resume().then(() => chime(ctx));
    setSoundOn(true);
    setReady(true);
    store('1');
  };
  const disable = () => {
    void audioRef.current?.close();
    audioRef.current = null;
    setSoundOn(false);
    setReady(false);
    store('0');
  };
  const active = soundOn && ready;

  return (
    <>
      <button type="button" onClick={active ? disable : enable} className={active ? 'btn-primary' : 'btn-ghost'} aria-pressed={active}>
        {active ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
        {active ? t('soundOn') : soundOn ? t('soundTap') : t('soundOff')}
      </button>
      {toast && (
        <div role="alert" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-lg rounded-card border-2 border-primary bg-surface p-4 text-center text-lg font-extrabold shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
