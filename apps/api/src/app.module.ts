import { validateEnvironment } from './config/environment';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { PlotsModule } from './plots/plots.module';
import { CustomersModule } from './customers/customers.module';
import { LeadsModule } from './leads/leads.module';
import { ActivitiesModule } from './activities/activities.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as any },
      }),
    }),
    PrismaModule, AuthModule, UsersModule, ProjectsModule, PlotsModule, CustomersModule, LeadsModule, ActivitiesModule, BookingsModule, PaymentsModule, DashboardModule,
  ],
})
export class AppModule {}
