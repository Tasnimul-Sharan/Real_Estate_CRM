import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'; import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'; import { AuthGuard } from '../common/auth.guard'; import { CurrentUser } from '../common/current-user.decorator'; import { AuthUser } from '../common/auth-user.interface'; import { ActivitiesService } from './activities.service'; import { CreateActivityDto } from './dto/activity.dto';
@ApiTags('activities') @ApiBearerAuth() @UseGuards(AuthGuard,RolesGuard) @Controller('activities') export class ActivitiesController{constructor(private s:ActivitiesService){} @Roles(Role.SUPER_ADMIN,Role.ADMIN,Role.SALES_MANAGER,Role.SALES_EXECUTIVE) @Post() create(@CurrentUser()u:AuthUser,@Body()d:CreateActivityDto){return this.s.create(u.sub,d)} @Get() list(@Query('leadId')id:string){return this.s.list(id)}}
