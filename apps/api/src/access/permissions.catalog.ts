import { Role } from '@prisma/client';
export const FEATURES = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'leads', label: 'Leads', actions: ['view', 'create', 'edit', 'convert'] },
  { key: 'activities', label: 'Activities & follow-ups', actions: ['view', 'create'] },
  { key: 'customers', label: 'Customers', actions: ['view', 'create', 'edit'] },
  { key: 'projects', label: 'Projects', actions: ['view', 'create', 'edit', 'blocks'] },
  { key: 'plots', label: 'Plot inventory', actions: ['view', 'create', 'edit'] },
  { key: 'bookings', label: 'Bookings', actions: ['view', 'create', 'edit'] },
  { key: 'payments', label: 'Payments', actions: ['view', 'create'] },
  { key: 'users', label: 'Team & users', actions: ['view', 'create', 'edit'] },
];
export const PERMISSION_KEYS = FEATURES.flatMap(f => f.actions.map(a => `${f.key}.${a}`));
export const DEPENDENCIES: Record<string, string[]> = {
  ...Object.fromEntries(FEATURES.flatMap(f => f.actions.filter(a => a !== 'view').map(a => [`${f.key}.${a}`, [`${f.key}.view`]]))),
  'activities.view': ['leads.view'],
  'plots.view': ['projects.view'],
  'bookings.view': ['plots.view', 'customers.view'],
  'payments.view': ['bookings.view'],
  'leads.convert': ['leads.view', 'customers.create'],
};
export function defaults(role: Role): string[] {
  if (role === Role.SUPER_ADMIN) return [...PERMISSION_KEYS, 'access.manage'];
  const permissions = PERMISSION_KEYS.filter(p => p.endsWith('.view'));
  const grant = (...features: string[]) => permissions.push(...PERMISSION_KEYS.filter(p => features.includes(p.split('.')[0]) && !p.endsWith('.view')));
  if ([Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE].includes(role as any)) grant('leads', 'activities', 'customers', 'bookings');
  if ([Role.ADMIN, Role.SALES_MANAGER].includes(role as any)) grant('projects', 'plots');
  if ([Role.ADMIN, Role.SALES_MANAGER, Role.ACCOUNTS].includes(role as any)) grant('payments');
  if (role === Role.ADMIN) grant('users');
  return [...new Set(permissions)].sort();
}
