'use client';

import { useTranslations } from 'next-intl';
import {
  CakeSlice, CalendarRange, ChefHat, House, LayoutDashboard, ListChecks, Plus, Settings, Store, Users,
  type LucideIcon
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import type { NavIcon, NavItem } from '@/lib/nav';

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House, plus: Plus, list: ListChecks, layout: LayoutDashboard, calendar: CalendarRange,
  cake: CakeSlice, store: Store, users: Users, settings: Settings, chef: ChefHat
};

// العنصر النشط = أطول مسار يطابق بداية الصفحة الحالية
function activeHref(pathname: string, items: NavItem[]) {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

const styles = {
  sidebar: {
    list: 'flex flex-col gap-1',
    link: 'flex min-h-touch items-center gap-3 rounded-control px-3 font-bold text-ink-muted hover:bg-primary-soft hover:text-ink',
    active: 'bg-primary-soft text-ink',
    icon: 'h-5 w-5'
  },
  pills: {
    list: 'flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]',
    link: 'flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-bold text-ink-muted',
    active: 'border-primary bg-primary text-primary-on',
    icon: 'h-4 w-4'
  },
  kitchen: {
    list: 'flex gap-2',
    link: 'flex min-h-touch-lg items-center gap-3 rounded-card px-6 text-lg font-bold text-ink-muted hover:bg-primary-soft',
    active: 'bg-primary text-primary-on hover:bg-primary-hover',
    icon: 'h-6 w-6'
  }
} as const;

export function NavLinks({ items, variant }: { items: NavItem[]; variant: keyof typeof styles }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const active = activeHref(pathname, items);
  const s = styles[variant];

  return (
    <ul className={s.list}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const isActive = item.href === active;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`${s.link} ${isActive ? s.active : ''}`}
            >
              <Icon className={s.icon} aria-hidden />
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
