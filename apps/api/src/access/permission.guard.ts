import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export const RequirePermissions = (...keys: string[]) => SetMetadata('required_permissions', keys);
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const keys = this.reflector.getAllAndOverride<string[]>('required_permissions', [context.getHandler(), context.getClass()]);
    const user = context.switchToHttp().getRequest().user;
    if (!user || !keys?.length) throw new ForbiddenException('Access is not configured for this action');
    if (!keys.every(key => user.permissions?.includes(key))) throw new ForbiddenException('Your role does not have access to this feature or action');
    return true;
  }
}
