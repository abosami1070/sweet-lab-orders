import { getLocale, getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@/components/status-badge';
import { formatDate } from '@/lib/format';
import type { OrderRow } from '@/lib/orders';

// قائمة طلبات مختصرة (للعميل والإدارة)
export async function OrderList({ orders, basePath, showShop = false }: { orders: OrderRow[]; basePath: string; showShop?: boolean }) {
  const locale = await getLocale();
  const t = await getTranslations('orders.list');
  const ar = locale === 'ar';
  return (
    <ul className="space-y-2">
      {orders.map((o) => {
        const changed = o.revision > o.kitchen_seen_revision && o.approved_at && ['acknowledged', 'in_production', 'ready'].includes(o.status);
        return (
          <li key={o.id}>
            <Link href={`${basePath}/${o.id}`} className="card flex items-center gap-3 p-4 hover:border-primary">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold" dir="ltr">#{o.order_number}</span>
                  <StatusBadge status={o.status} />
                  {changed && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold">{t('changedBadge')}</span>}
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {showShop && o.customer && <b className="text-ink">{ar ? o.customer.name_ar : o.customer.name_en} · </b>}
                  {t('deliveryOn', { date: formatDate(locale, `${o.delivery_date}T12:00:00Z`, { weekday: 'short', day: 'numeric', month: 'short' }) })}
                  {o.window && ` · ${ar ? o.window.label_ar : o.window.label_en}`}
                  {` · ${t('itemsCount', { count: o.order_items.length })}`}
                </p>
              </div>
              <ChevronLeft className="h-5 w-5 shrink-0 text-ink-muted ltr:-scale-x-100" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
