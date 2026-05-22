import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getRoot() {
    return this.healthService.getApiInfo();
  }

  @Get('health')
  getHealthStatus() {
    return this.healthService.getHealthStatus();
  }
}
