import { Injectable } from '@nestjs/common';
import { Clock } from '../../infrastructure/clock/clock';
import { DatabaseHealthIndicator } from '../../infrastructure/database/database-health.indicator';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  time: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly database: DatabaseHealthIndicator,
    private readonly clock: Clock,
  ) {}

  async check(): Promise<HealthStatus> {
    const isDatabaseUp = await this.database.isHealthy();
    return {
      status: isDatabaseUp ? 'ok' : 'degraded',
      database: isDatabaseUp ? 'up' : 'down',
      time: this.clock.now().toISOString(),
    };
  }
}
