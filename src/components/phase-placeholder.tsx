import { getTranslations } from 'next-intl/server';
import { Hammer } from 'lucide-react';

// شاشة محجوزة لمرحلة لاحقة: توضح ما ستفعله الشاشة بدل "لا توجد بيانات"
export async function PhasePlaceholder({ page }: { page: string }) {
  const t = await getTranslations('pages');
  return (
    <section>
      <h1 className="text-2xl font-extrabold">{t(`${page}.title`)}</h1>
      <div className="card mt-5 flex gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-soft">
          <Hammer className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-bold">{t(`${page}.body`)}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('nextPhase')}</p>
        </div>
      </div>
    </section>
  );
}
