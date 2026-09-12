import { Controller, Get } from '@nestjs/common';

type HealthStatus = {
  status: 'ok';
  uptimeSeconds: number;
};

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
