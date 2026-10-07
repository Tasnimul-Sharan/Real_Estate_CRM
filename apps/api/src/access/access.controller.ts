import { Body, Controller, Get, Param, ParseEnumPipe, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsString, Min } from 'class-validator';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { AccessService } from './access.service';
import { PermissionGuard, RequirePermissions } from './permission.guard';
class SavePolicyDto {
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({ each: true }) permissions!: string[];
  @IsInt() @Min(0) version!: number;
}
@Controller('access')
@UseGuards(AuthGuard)
export class AccessController {
  constructor(private access: AccessService) {}
  @Get('assignable-roles') assignable(@CurrentUser() user: AuthUser) { return this.access.assignable(user); }
  @Get('roles') @UseGuards(PermissionGuard) @RequirePermissions('access.manage') catalog() { return this.access.catalog(); }
  @Put('roles/:role') @UseGuards(PermissionGuard) @RequirePermissions('access.manage') save(@Param('role', new ParseEnumPipe(Role)) role: Role, @Body() data: SavePolicyDto, @CurrentUser() user: AuthUser) { return this.access.save(role, data.permissions, data.version, user); }
  @Get('history') @UseGuards(PermissionGuard) @RequirePermissions('access.manage') history() { return this.access.history(); }
}
