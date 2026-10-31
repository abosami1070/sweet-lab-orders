'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Copy, KeyRound, MessageCircle } from 'lucide-react';

// تُعرض كلمة المرور المؤقتة مرة واحدة فقط، مع نسخ رسالة جاهزة أو إرسالها عبر واتساب
export function PasswordReveal({ email, password, name, phone }: { email: string; password: string; name?: string; phone?: string }) {
  const t = useTranslations('admin.users');
  const locale = useLocale();
  const [copied, setCopied] = useState<'password' | 'message' | null>(null);
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  const message = t('shareMessage', { name: name || email, url: `${origin}/${locale}/login`, email, password });

  const copy = async (text: string, which: 'password' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      window.prompt(t('copyManually'), text);
    }
  };

  const wa = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(message)}`;

  return (
    <div className="space-y-4 rounded-card border-2 border-primary bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-bold">{t('passwordTitle')}</p>
          <p className="text-sm text-ink-muted">{t('passwordOnce')}</p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-ink-muted">{t('email')}</dt>
          <dd dir="ltr" className="break-all font-bold rtl:text-right">{email}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">{t('temporaryPassword')}</dt>
          <dd dir="ltr" className="select-all font-mono text-xl font-bold rtl:text-right">{password}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy(password, 'password')} className="btn-ghost">
          {copied === 'password' ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied === 'password' ? t('copied') : t('copyPassword')}
        </button>
        <button type="button" onClick={() => copy(message, 'message')} className="btn-ghost">
          {copied === 'message' ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied === 'message' ? t('copied') : t('copyMessage')}
        </button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-primary">
          <MessageCircle className="h-4 w-4" aria-hidden />
          {phone ? t('sendWhatsapp') : t('shareWhatsapp')}
        </a>
      </div>
    </div>
  );
}
