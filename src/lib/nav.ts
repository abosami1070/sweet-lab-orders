import type { AppRole } from '@/types/app';

export type NavIcon =
  | 'home' | 'plus' | 'list' | 'layout' | 'calendar' | 'cake' | 'store' | 'users' | 'settings' | 'chef';

export type NavItem = { href: string; key: string; icon: NavIcon };

export const homeFor = (role: AppRole): string =>
  role === 'customer' ? '/customer' : role === 'kitchen_staff' ? '/kitchen' : '/admin';

const customerNav: NavItem[] = [
  { href: '/customer', key: 'home', icon: 'home' },
  { href: '/customer/orders/new', key: 'newOrder', icon: 'plus' },
  { href: '/customer/orders', key: 'myOrders', icon: 'list' }
];

const adminNav: NavItem[] = [
  { href: '/admin', key: 'dashboard', icon: 'layout' },
  { href: '/admin/orders', key: 'orders', icon: 'list' },
  { href: '/planner', key: 'planner', icon: 'calendar' },
  { href: '/admin/products', key: 'products', icon: 'cake' },
  { href: '/admin/customers', key: 'customers', icon: 'store' },
  { href: '/admin/users', key: 'users', icon: 'users' },
  { href: '/admin/settings', key: 'settings', icon: 'settings' }
];

const kitchenNav: NavItem[] = [
  { href: '/kitchen', key: 'kitchenBoard', icon: 'chef' },
  { href: '/planner', key: 'planner', icon: 'calendar' }
];

export function navForRole(role: AppRole): NavItem[] {
  switch (role) {
    case 'customer':
      return customerNav;
    case 'kitchen_staff':
      return kitchenNav;
    case 'admin':
    case 'super_admin':
      // المشرف يرى حسابات العملاء فقط داخل صفحة المستخدمين، والمشرف العام يرى الجميع
      return adminNav;
  }
}
