import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PermissionGuard, RequirePermissions } from '../access/permission.guard';
import { LegacyService } from './legacy.service';
import { LegacyQuery } from './legacy.dto';

@Controller('legacy')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('legacy.view')
export class LegacyController {
  constructor(private readonly legacy: LegacyService) {}
  @Get('imports') imports() { return this.legacy.imports(); }
  @Get('summary') summary(@Query()q: LegacyQuery) { return this.legacy.summary(q); }
}
