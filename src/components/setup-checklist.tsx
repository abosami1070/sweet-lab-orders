import { getTranslations } from 'next-intl/server';
import { CheckCircle2, ChevronLeft, Circle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/app';

// خطوات تجهيز المعمل قبل استقبال أول طلب. تختفي عند اكتمالها كلها.
export async function SetupChecklist({ profile }: { profile: Profile }) {
  const t = await getTranslations('admin.setup');
  const supabase = await createClient();
  const head = { count: 'exact' as const, head: true };
  const results = await Promise.all([
    supabase.from('products').select('id', head).eq('is_active', true),
    supabase.from('delivery_windows').select('id', head).eq('is_active', true),
    supabase.from('customers').select('id', head).eq('is_active', true),
    supabase.from('profiles').select('id', head).eq('role', 'customer').eq('is_active', true),
    supabase.from('profiles').select('id', head).eq('role', 'kitchen_staff').eq('is_active', true)
  ]);
  const [products, windows, shops, shopAccounts, kitchenAccounts] = results.map((r) => r.count ?? 0);

  const steps = [
    { key: 'products', done: products > 0, href: '/admin/products' },
    { key: 'settings', done: windows > 0, href: '/admin/settings' },
    { key: 'shops', done: shops > 0, href: '/admin/customers' },
    { key: 'shopAccounts', done: shopAccounts > 0, href: '/admin/users/new' },
    ...(profile.role === 'super_admin' ? [{ key: 'kitchen', done: kitchenAccounts > 0, href: '/admin/users/new' }] : [])
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <section className="card mt-6 p-5">
      <h2 className="text-lg">{t('title')}</h2>
      <p className="text-sm text-ink-muted">{t('body', { done: steps.length - remaining, total: steps.length })}</p>
      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={`flex min-h-touch items-center gap-3 rounded-control border px-3 py-2 ${s.done ? 'border-line text-ink-muted' : 'border-primary bg-primary-soft font-bold'}`}
            >
              {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden /> : <Circle className="h-5 w-5 shrink-0" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="sr-only">{i + 1}. </span>
                {t(`steps.${s.key}`)}
                {s.done && <span className="sr-only"> — {t('done')}</span>}
              </span>
              {!s.done && <ChevronLeft className="h-5 w-5 shrink-0 ltr:-scale-x-100" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
