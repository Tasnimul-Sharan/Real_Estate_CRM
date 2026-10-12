import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityType } from '@prisma/client';
export class PlanDto {
  @IsString() bookingId!: string;
  @Type(()=>Number) @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(1000000000000) totalPrice!: number;
  @Type(()=>Number) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(1000000000000) downPayment!: number;
  @Type(()=>Number) @IsInt() @Min(0) @Max(360) months!: number;
  @IsString() downPaymentDate!: string;
  @IsString() firstInstallmentDate!: string;
}
export class CalendarQuery {
  @IsOptional() @IsString() month?: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class FollowUpDto {
  @IsString() leadId!: string;
  @IsDateString() scheduledAt!: string;
  @IsDateString() expectedUpdatedAt!: string;
  @IsEnum(ActivityType) type!: ActivityType;
  @IsString() @MaxLength(2000) note!: string;
  @IsOptional() @IsString() assignedToId?: string;
}
export class CompleteFollowUpDto {
  @IsDateString() expectedUpdatedAt!: string;
  @IsString() @MaxLength(2000) note!: string;
}
export class ReportQuery {
  @IsString() from!: string;
  @IsString() to!: string;
  @IsOptional() @IsString() projectId?: string;
}
