import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'; import { PrismaService } from '../prisma/prisma.service'; import { CreateUserDto, UpdateUserDto } from './dto/user.dto'; import * as bcrypt from 'bcryptjs';
@Injectable() export class UsersService { constructor(private p:PrismaService){}
  list(){return this.p.user.findMany({select:{id:true,name:true,email:true,phone:true,role:true,status:true,createdAt:true},orderBy:{createdAt:'desc'}})}
  async create(d:CreateUserDto){ if(await this.p.user.findUnique({where:{email:d.email}})) throw new ConflictException('Email already exists'); const {password,...rest}=d; const passwordHash=await bcrypt.hash(password,12); return this.p.user.create({data:{...rest,passwordHash},select:{id:true,name:true,email:true,role:true,status:true}})}
  async update(id:string,d:UpdateUserDto){ if(!await this.p.user.findUnique({where:{id}})) throw new NotFoundException('User not found'); return this.p.user.update({where:{id},data:d,select:{id:true,name:true,email:true,phone:true,role:true,status:true}})}
}
