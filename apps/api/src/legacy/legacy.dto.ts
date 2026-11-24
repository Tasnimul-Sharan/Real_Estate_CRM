import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class LegacyQuery {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  importId?: string;

  @IsOptional() @Matches(/^(?:none|[1-9]\d{0,9})$/)
  companyId?: string;

  @IsOptional() @IsIn(['daily', 'monthly', 'yearly'])
  period: 'daily' | 'monthly' | 'yearly' = 'monthly';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize: number = 50;
}
