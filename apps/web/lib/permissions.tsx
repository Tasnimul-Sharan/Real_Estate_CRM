"use client";
import { createContext, useContext } from 'react';
export type User = { sub: string; email: string; name: string; role: string; permissions: string[] };
export const UserContext = createContext<User | null>(null);
export const routes = ['dashboard', 'leads', 'customers', 'projects', 'plots', 'bookings', 'payments', 'users', 'access'];
export function routePermission(route: string) { return route === 'access' ? 'access.manage' : `${route}.view`; }
export function homeFor(user: User | null) { return '/' + (routes.find(route => user?.permissions.includes(routePermission(route))) ?? 'dashboard'); }
export function usePermissions() {
  const user = useContext(UserContext);
  const can = (permission: string) => user?.permissions.includes(permission) ?? false;
  return { user, can };
}
