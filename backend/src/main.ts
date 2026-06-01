import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('BACKEND_PORT') || 5000;

  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
