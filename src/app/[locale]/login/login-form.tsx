'use client';

import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LogIn } from 'lucide-react';
import { signIn, type SignInError, type SignInState } from '@/lib/actions/auth';

export function LoginForm({ next, initialError }: { next?: string; initialError?: SignInError }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: initialError });

  const emailError = state.field === 'email' ? state.error : undefined;
  const passwordError = state.field === 'password' ? state.error : undefined;
  const formError = !state.field ? state.error : undefined;

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />
      <input type="hidden" name="locale" value={locale} />

      {formError && (
        <p role="alert" className="rounded-control border border-danger bg-surface-raised p-3 text-sm text-danger">
          {t(`errors.${formError}`)}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block font-bold">{t('email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          inputMode="email"
          defaultValue={state.email}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
          className="field rtl:text-right"
        />
        {emailError && <p id="email-error" className="mt-1 text-sm text-danger">{t(`errors.${emailError}`)}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block font-bold">{t('password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? 'password-error' : undefined}
          className="field rtl:text-right"
        />
        {passwordError && <p id="password-error" className="mt-1 text-sm text-danger">{t(`errors.${passwordError}`)}</p>}
      </div>

      {/* الزر يتعطل أثناء الإرسال لمنع الإرسال المزدوج */}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        <LogIn className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
