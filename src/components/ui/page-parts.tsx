import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';

// رأس الصفحة: رابط رجوع اختياري، عنوان، وصف، وزر إجراء
export function PageHeader({
  title, description, back, action
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex min-h-[36px] items-center gap-1 text-sm font-bold text-ink-muted hover:text-ink">
          <ChevronRight className="h-4 w-4 ltr:-scale-x-100" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {description && <p className="mt-1 text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

// قسم داخل الصفحة بعنوان
export function Section({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg">{title}</h2>
          {description && <p className="text-sm text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// حالة فارغة تدعو لفعل بدل "لا توجد بيانات"
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">{icon}</span>
      <p className="text-lg font-bold">{title}</p>
      {body && <p className="max-w-md text-sm text-ink-muted">{body}</p>}
      {action}
    </div>
  );
}

// شارة مفعّل/موقوف
export function ActiveBadge({ active, labels }: { active: boolean; labels: { on: string; off: string } }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${active ? 'text-success' : 'text-ink-muted'}`}
      style={{ background: `color-mix(in srgb, var(${active ? '--color-success' : '--color-ink-muted'}) 13%, transparent)` }}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {active ? labels.on : labels.off}
    </span>
  );
}
