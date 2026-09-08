import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');
    let payload: { sub: string };
    try { payload = await this.jwt.verifyAsync(token); }
    catch { throw new UnauthorizedException('Invalid or expired token'); }
    const user = typeof payload.sub === 'string' ? await this.prisma.user.findUnique({ where: { id: payload.sub } }) : null;
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account is inactive or unavailable');
    // Apply role changes and account deactivation immediately, including existing sessions.
    req.user = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return true;
  }
}
