import { Module } from '@nestjs/common';
import { CalendarController, FinanceController, RemindersController, ReportsController, StatementsController } from './operations.controller';
import { FinanceService } from './finance.service';
import { CalendarService } from './calendar.service';
import { ReportsService } from './reports.service';
@Module({controllers:[FinanceController,StatementsController,CalendarController,ReportsController,RemindersController],providers:[FinanceService,CalendarService,ReportsService]})
export class OperationsModule {}
