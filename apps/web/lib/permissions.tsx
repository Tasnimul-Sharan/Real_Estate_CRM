"use client";
import { createContext, useContext } from 'react';
export type User = { sub: string; email: string; name: string; role: string };
export const UserContext = createContext<User | null>(null);
export function usePermissions() {
  const user = useContext(UserContext);
  const role = user?.role || '';
  return {
    user,
    sales: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXECUTIVE'].includes(role),
    inventory: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(role),
    payments: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'ACCOUNTS'].includes(role),
    users: ['SUPER_ADMIN', 'ADMIN'].includes(role),
  };
}
