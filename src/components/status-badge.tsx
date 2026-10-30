import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@/types/app';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('status');
  return (
    <span className="status-badge" data-status={status}>
      {t(status)}
    </span>
  );
}
