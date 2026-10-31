'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { KeyRound, Save, UserPlus, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createUser, resetUserPassword, updateUser } from '@/lib/actions/users';
import { describe, Field, FormAlert, SubmitButton, Toggle, useServerForm } from '@/components/ui/form-bits';
import { PasswordReveal } from './password-reveal';
import type { AppRole } from '@/types/app';

export type ShopOption = { id: string; name_ar: string; name_en: string; is_active: boolean };

function RoleAndShop({
  roles, shops, role, setRole, defaultCustomer, err, disabled
}: {
  roles: AppRole[];
  shops: ShopOption[];
  role: AppRole;
  setRole: (r: AppRole) => void;
  defaultCustomer?: string | null;
  err: (f: string) => string | undefined;
  disabled?: boolean;
}) {
  const t = useTranslations('admin.users');
  const tr = useTranslations('roles');
  const locale = useLocale();
  return (
    <>
      {roles.length > 1 ? (
        <Field id="role" label={t('role')} error={err('role')} hint={t(`roleHint.${role}`)}>
          <select
            {...describe('role', err('role'), t(`roleHint.${role}`))}
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            disabled={disabled}
            className="field"
          >
            {roles.map((r) => (
              <option key={r} value={r}>{tr(r)}</option>
            ))}
          </select>
          {/* الحقل المعطّل لا يُرسل؛ نرسل القيمة بحقل مخفي */}
          {disabled && <input type="hidden" name="role" value={role} />}
        </Field>
      ) : (
        <input type="hidden" name="role" value={roles[0]} />
      )}
      {role === 'customer' && (
        <Field id="customer_id" label={t('shop')} error={err('customer_id')} hint={t('shopHint')}>
          <select {...describe('customer_id', err('customer_id'), t('shopHint'))} defaultValue={defaultCustomer ?? ''} className="field">
            <option value="" disabled>{t('chooseShop')}</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.is_active && s.id !== defaultCustomer}>
                {locale === 'ar' ? s.name_ar : s.name_en}
                {!s.is_active ? ` (${t('shopInactive')})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

// ---------- إنشاء حساب ----------
export function CreateUserForm({ roles, shops, defaultCustomer }: { roles: AppRole[]; shops: ShopOption[]; defaultCustomer?: string }) {
  const [round, setRound] = useState(0); // لإضافة حساب آخر بنموذج نظيف
  return <CreateUserInner key={round} roles={roles} shops={shops} defaultCustomer={defaultCustomer} onAnother={() => setRound((r) => r + 1)} />;
}

function CreateUserInner({
  roles, shops, defaultCustomer, onAnother
}: {
  roles: AppRole[];
  shops: ShopOption[];
  defaultCustomer?: string;
  onAnother: () => void;
}) {
  const t = useTranslations('admin.users');
  const locale = useLocale();
  const [role, setRole] = useState<AppRole>('customer');
  const { state, pending, formRef, onSubmit, err } = useServerForm(createUser);

  if (state.status === 'ok' && state.data?.password) {
    const d = state.data;
    return (
      <div className="space-y-4">
        <PasswordReveal email={d.email} password={d.password} name={d.name} phone={d.phone || undefined} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/users/${d.userId}`} className="btn-ghost">
            <UserRound className="h-4 w-4" aria-hidden />
            {t('openAccount')}
          </Link>
          <button type="button" onClick={onAnother} className="btn-ghost">
            <UserPlus className="h-4 w-4" aria-hidden />
            {t('addAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label={t('fullName')} error={err('full_name')}>
          <input {...describe('full_name', err('full_name'))} autoComplete="off" className="field" />
        </Field>
        <Field id="email" label={t('email')} error={err('email')} hint={t('emailHint')}>
          <input {...describe('email', err('email'), t('emailHint'))} type="email" inputMode="email" autoComplete="off" dir="ltr" className="field rtl:text-right" />
        </Field>
        <RoleAndShop roles={roles} shops={shops} role={role} setRole={setRole} defaultCustomer={defaultCustomer} err={err} />
        <Field id="preferred_locale" label={t('language')}>
          <select {...describe('preferred_locale')} defaultValue={locale} className="field">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>
      <p className="rounded-control bg-primary-soft p-3 text-sm">{t('createNote')}</p>
      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel={t('creating')} icon={<UserPlus className="h-4 w-4" aria-hidden />}>
          {t('create')}
        </SubmitButton>
      </div>
    </form>
  );
}

// ---------- تعديل حساب ----------
export type EditableUser = { id: string; full_name: string; role: AppRole; customer_id: string | null; is_active: boolean };

export function EditUserForm({ user, roles, shops, isSelf }: { user: EditableUser; roles: AppRole[]; shops: ShopOption[]; isSelf: boolean }) {
  const t = useTranslations('admin.users');
  const tf = useTranslations('forms');
  const [role, setRole] = useState<AppRole>(user.role);
  const { state, pending, formRef, onSubmit, err } = useServerForm(updateUser);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
      <input type="hidden" name="user_id" value={user.id} />
      <FormAlert state={state} />
      {isSelf && <p className="rounded-control bg-primary-soft p-3 text-sm">{t('selfNote')}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label={t('fullName')} error={err('full_name')}>
          <input {...describe('full_name', err('full_name'))} defaultValue={user.full_name} className="field" />
        </Field>
        <RoleAndShop roles={roles} shops={shops} role={role} setRole={setRole} defaultCustomer={user.customer_id} err={err} disabled={isSelf} />
      </div>
      {isSelf ? (
        <input type="hidden" name="is_active" value="on" />
      ) : (
        <Toggle name="is_active" label={t('active')} hint={t('activeHint')} defaultChecked={user.is_active} />
      )}
      <div className="flex justify-end">
        <SubmitButton pending={pending} icon={<Save className="h-4 w-4" aria-hidden />}>{tf('save')}</SubmitButton>
      </div>
    </form>
  );
}

// ---------- إعادة تعيين كلمة المرور ----------
export function ResetPassword({ userId, email, name, phone }: { userId: string; email: string; name: string; phone?: string }) {
  const t = useTranslations('admin.users');
  const { state, pending, onSubmit } = useServerForm(resetUserPassword, { confirm: t('resetConfirm') });

  if (state.status === 'ok' && state.data?.password) {
    return <PasswordReveal email={email} password={state.data.password} name={name} phone={phone} />;
  }
  return (
    <form onSubmit={onSubmit} className="card space-y-3 p-5">
      <input type="hidden" name="user_id" value={userId} />
      <FormAlert state={state} />
      <p className="text-sm text-ink-muted">{t('resetHint')}</p>
      <SubmitButton pending={pending} variant="ghost" pendingLabel={t('resetting')} icon={<KeyRound className="h-4 w-4" aria-hidden />}>
        {t('resetPassword')}
      </SubmitButton>
    </form>
  );
}
