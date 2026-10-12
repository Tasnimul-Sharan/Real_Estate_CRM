import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth-user.interface';
import { PermissionGuard, RequirePermissions } from '../access/permission.guard';
import { FinanceService, sums } from './finance.service';
import { CalendarService } from './calendar.service';
import { ReportsService } from './reports.service';
import { CalendarQuery, CompleteFollowUpDto, FollowUpDto, PlanDto, ReportQuery } from './operations.dto';
import { todayDhaka } from './finance.math';
@Controller('installments') @UseGuards(AuthGuard,PermissionGuard)
export class FinanceController {
  constructor(private finance:FinanceService){}
  @Get() @RequirePermissions('installments.view') list(){return this.finance.list();}
  @Post() @RequirePermissions('installments.create') create(@Body()dto:PlanDto,@CurrentUser()u:AuthUser){return this.finance.create(dto,u.sub);}
}
@Controller('statements') @UseGuards(AuthGuard,PermissionGuard)
export class StatementsController {
  constructor(private finance:FinanceService){}
  @Get('customers/:id') @RequirePermissions('statements.view') statement(@Param('id')id:string){return this.finance.statement(id);}
  @Get('receipts/:id') @RequirePermissions('statements.view') receipt(@Param('id')id:string){return this.finance.receipt(id);}
}
@Controller('calendar') @UseGuards(AuthGuard,PermissionGuard)
export class CalendarController {
  constructor(private calendar:CalendarService){}
  @Get() @RequirePermissions('calendar.view') list(@Query()q:CalendarQuery){return this.calendar.list(q);}
  @Post() @RequirePermissions('calendar.create') save(@Body()d:FollowUpDto,@CurrentUser()u:AuthUser){return this.calendar.save(d,u.sub);}
  @Patch(':id/complete') @RequirePermissions('calendar.edit') complete(@Param('id')id:string,@Body()d:CompleteFollowUpDto,@CurrentUser()u:AuthUser){return this.calendar.complete(id,d,u.sub);}
}
@Controller('reports') @UseGuards(AuthGuard,PermissionGuard)
export class ReportsController {
  constructor(private reports:ReportsService){}
  @Get() @RequirePermissions('reports.view') summary(@Query()q:ReportQuery){return this.reports.summary(q);}
}
@Controller('operations') @UseGuards(AuthGuard)
export class RemindersController {
  constructor(private finance:FinanceService,private calendar:CalendarService){}
  @Get('reminders') async reminders(@CurrentUser()u:AuthUser){
    const result:any={};
    if(u.permissions.includes('calendar.view')){
      const data=await this.calendar.list({assignedToId:u.sub});
      result.followUps={overdue:data.overdue.length,today:data.events.filter(x=>new Date(x.nextFollowUpAt!.getTime()+21600000).toISOString().slice(0,10)===todayDhaka()).length};
    }
    if(u.permissions.includes('installments.view')) {
      const rows=(await this.finance.list()).filter(b=>b.status!=='CANCELLED');
      result.installments={overdue:sums(rows,'overdue'),dueToday:sums(rows,'dueToday')};
    }
    return result;
  }
}
