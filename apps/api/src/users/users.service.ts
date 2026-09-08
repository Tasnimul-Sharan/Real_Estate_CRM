import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user.dto";
import { AuthUser } from "../common/auth-user.interface";
const visible = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
} as const;
@Injectable()
export class UsersService {
  constructor(private p: PrismaService) {}
  list() {
    return this.p.user.findMany({
      select: visible,
      orderBy: { createdAt: "desc" },
    });
  }
  async create(d: CreateUserDto, actor: AuthUser) {
    if (actor.role !== Role.SUPER_ADMIN && d.role === Role.SUPER_ADMIN)
      throw new ForbiddenException(
        "Only a super admin can create another super admin",
      );
    if (await this.p.user.findUnique({ where: { email: d.email } }))
      throw new ConflictException("Email already exists");
    const { password, ...rest } = d;
    const passwordHash = await bcrypt.hash(password, 12);
    return this.p.user.create({
      data: { ...rest, passwordHash },
      select: visible,
    });
  }
  async update(id: string, d: UpdateUserDto, actor: AuthUser) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(824617)::text`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException("User not found");
      if (
        actor.role !== Role.SUPER_ADMIN &&
        (user.role === Role.SUPER_ADMIN || d.role === Role.SUPER_ADMIN)
      )
        throw new ForbiddenException(
          "Only a super admin can manage super admins",
        );
      if (
        user.role === Role.SUPER_ADMIN &&
        user.status === "ACTIVE" &&
        ((d.role && d.role !== Role.SUPER_ADMIN) || d.status === "INACTIVE")
      ) {
        if (
          (await tx.user.count({
            where: { role: Role.SUPER_ADMIN, status: "ACTIVE" },
          })) <= 1
        )
          throw new ConflictException("Keep at least one active super admin");
      }
      return tx.user.update({ where: { id }, data: d, select: visible });
    });
  }
}
