import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../common/public.decorator";
import { AuthGuard } from "../common/auth.guard";
import { CurrentUser } from "../common/current-user.decorator";
@ApiTags("auth")
@Controller("auth")
@UseGuards(AuthGuard)
export class AuthController {
  constructor(private auth: AuthService) {}
  @Public() @Post("login") login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
  @ApiBearerAuth() @Get("me") me(@CurrentUser() user: any) {
    return user;
  }
}
