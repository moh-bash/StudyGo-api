import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { AdminBootstrapService } from './admin-bootstrap.service.js';

/**
 * One-time initial System Admin bootstrap. Runs at application startup only;
 * there is no HTTP endpoint, so it cannot be invoked by arbitrary callers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AdminBootstrapService],
})
export class BootstrapModule {}