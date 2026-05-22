import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealthStatus() {
    return {
      status: 'ok',
      service: 'udemm-global-backend',
      timestamp: new Date().toISOString(),
      version: '0.1.0'
    };
  }

  getApiInfo() {
    return {
      message: 'UDEMM Global Backend API',
      description: 'Plataforma institucional académica para procesos de acreditación CONEAU',
      version: '0.1.0',
      status: 'running'
    };
  }
}
