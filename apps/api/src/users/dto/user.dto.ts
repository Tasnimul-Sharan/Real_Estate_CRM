import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'; import { Role, UserStatus } from '@prisma/client';
export class CreateUserDto { @IsString() name!:string; @IsEmail() email!:string; @IsString() @MinLength(8) password!:string; @IsOptional() @IsString() phone?:string; @IsEnum(Role) role!:Role; }
export class UpdateUserDto { @IsOptional() @IsString() name?:string; @IsOptional() @IsString() phone?:string; @IsOptional() @IsEnum(Role) role?:Role; @IsOptional() @IsEnum(UserStatus) status?:UserStatus; }
