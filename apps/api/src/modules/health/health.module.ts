import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RootController } from './root.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController, RootController],
  providers: [HealthService],
})
export class HealthModule {}
