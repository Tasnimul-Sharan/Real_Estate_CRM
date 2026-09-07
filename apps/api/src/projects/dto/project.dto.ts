import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'; import { ProjectStatus } from '@prisma/client'; import { Type } from 'class-transformer';
export class CreateProjectDto { @IsString() name!:string; @IsString() code!:string; @IsString() location!:string; @IsOptional() @IsString() description?:string; @IsOptional() @IsEnum(ProjectStatus) status?:ProjectStatus; @IsOptional() @Type(()=>Number) @IsNumber() totalArea?:number; }
export class UpdateProjectDto { @IsOptional() @IsString() name?:string; @IsOptional() @IsString() location?:string; @IsOptional() @IsString() description?:string; @IsOptional() @IsEnum(ProjectStatus) status?:ProjectStatus; @IsOptional() @Type(()=>Number) @IsNumber() totalArea?:number; }
export class CreateBlockDto { @IsString() name!:string; }
