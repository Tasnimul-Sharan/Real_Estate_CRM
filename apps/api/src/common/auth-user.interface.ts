import { Role } from '@prisma/client';
export interface AuthUser { sub: string; email: string; role: Role; name: string; }
