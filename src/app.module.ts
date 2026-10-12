import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { BootstrapModule } from './bootstrap/bootstrap.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { configuration } from './config/configuration.js';
import { buildDataSourceOptions } from './config/typeorm.config.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ProfessorsModule } from './professors/professors.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { SectionsModule } from './sections/sections.module.js';
import { SemestersModule } from './semesters/semesters.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UsersModule } from './users/users.module.js';

// Observe telemetry is only enabled when real credentials are configured; the
// scaffold's placeholder keys are ignored so local runs stay quiet.
const { ObserveModule, ObserveInstrument } = createObserveModule();
const observeAppKey = process.env.OBSERVE_APP_KEY;
const observeAppSecret = process.env.OBSERVE_APP_SECRET;
const observeEnabled =
  !!observeAppKey && observeAppKey !== 'YOUR_APP_KEY' && !!observeAppSecret && observeAppSecret !== 'YOUR_APP_SECRET';

export const appInstrument = observeEnabled ? ObserveInstrument : undefined;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDataSourceOptions(),
    }),
    ...(observeEnabled
      ? [
          ObserveModule.forRoot({
            appKey: observeAppKey,
            appSecret: observeAppSecret,
            serviceId: process.env.OBSERVE_SERVICE_ID ?? 'study-go-api',
          }),
        ]
      : []),
    AuthModule,
    UsersModule,
    BootstrapModule,
    ProgramsModule,
    SemestersModule,
    SubjectsModule,
    ProfessorsModule,
    SectionsModule,
    EnrollmentsModule,
    TeamsModule,
    TasksModule,
    EventsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
