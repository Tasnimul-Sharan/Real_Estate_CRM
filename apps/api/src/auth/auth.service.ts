import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      user.status !== "ACTIVE" ||
      !(await bcrypt.compare(password, user.passwordHash))
    )
      throw new UnauthorizedException("Invalid email or password");
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
