import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { defaults, DEPENDENCIES, FEATURES, PERMISSION_KEYS } from './permissions.catalog';
import { AuthUser } from '../common/auth-user.interface';

@Injectable()
export class AccessService {
  constructor(private p: PrismaService) {}
  async effective(role: Role) {
    if (role === Role.SUPER_ADMIN) return defaults(role);
    const policy = await this.p.rolePolicy.findUnique({ where: { role } });
    return policy ? policy.permissions : defaults(role);
  }
  async catalog() {
    const policies = await this.p.rolePolicy.findMany();
    return {
      features: FEATURES, dependencies: DEPENDENCIES,
      roles: Object.values(Role).map(role => {
        const policy = policies.find(p => p.role === role);
        return { role, permissions: role === Role.SUPER_ADMIN ? defaults(role) : policy?.permissions ?? defaults(role), version: policy?.version ?? 0, updatedAt: policy?.updatedAt ?? null, locked: role === Role.SUPER_ADMIN };
      }),
    };
  }
  async save(role: Role, permissions: string[], version: number, actor: AuthUser) {
    if (actor.role !== Role.SUPER_ADMIN || role === Role.SUPER_ADMIN) throw new ForbiddenException('Only Super Admin can configure other roles; Super Admin access is permanent');
    if (permissions.some(p => !PERMISSION_KEYS.includes(p))) throw new BadRequestException('Unknown or protected permission');
    const unique = [...new Set(permissions)].sort();
    for (const key of unique) for (const dependency of DEPENDENCIES[key] ?? []) {
      if (!unique.includes(dependency)) throw new BadRequestException(`${key} requires ${dependency}`);
    }
    return this.p.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(824618)::text`;
      const old = await tx.rolePolicy.findUnique({ where: { role } });
      if ((old?.version ?? 0) !== version) throw new ConflictException('This role was changed by another administrator. Reload before saving.');
      const saved = await tx.rolePolicy.upsert({ where: { role }, create: { role, permissions: unique, version: 1, updatedBy: actor.sub }, update: { permissions: unique, version: { increment: 1 }, updatedBy: actor.sub } });
      await tx.accessAudit.create({ data: { role, actorId: actor.sub, before: old?.permissions ?? defaults(role), after: unique } });
      return saved;
    });
  }
  async assignable(actor: AuthUser) {
    if (actor.role === Role.SUPER_ADMIN) return Object.values(Role);
    const own = await this.effective(actor.role);
    const roles = await Promise.all(Object.values(Role).filter(r => r !== Role.SUPER_ADMIN).map(async role => ({ role, permissions: await this.effective(role) })));
    return roles.filter(r => r.permissions.every(p => own.includes(p))).map(r => r.role);
  }
  async assertAssignable(role: Role, actor: AuthUser) {
    if (!(await this.assignable(actor)).includes(role)) throw new ForbiddenException('You cannot assign or manage a role with access beyond your own');
  }
  history() { return this.p.accessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }); }
}
