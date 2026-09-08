import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { ActivityType } from "@prisma/client";
export class CreateActivityDto {
  @IsString() leadId!: string;
  @IsEnum(ActivityType) type!: ActivityType;
  @IsString() note!: string;
  @IsOptional() @IsDateString() nextFollowUpAt?: string;
}
