import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // bodyParser: false — se configuran límites explícitos a continuación
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const configService = app.get(ConfigService);
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const frontendUrl = configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

  // ── Límites de payload ────────────────────────────────────────────────────
  // Las subidas de archivos usan multer (configurado en cada controlador) y
  // no pasan por estos límites.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use(cookieParser());

  // ── Helmet — cabeceras de seguridad HTTP ──────────────────────────────────
  app.use(
    helmet({
      // COEP desactivado: el frontend (origen distinto en dev) accede al API
      // con CORS; activar COEP requeriría que todos los recursos declaren
      // Cross-Origin-Resource-Policy compatible.
      crossOriginEmbedderPolicy: false,
      // HSTS solo en producción (en dev el backend corre en HTTP)
      hsts: isProd
        ? { maxAge: 63_072_000, includeSubDomains: true }
        : false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86_400, // cache de preflight: 24 h
  });

  // ── Pipes globales ────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Filtro global de excepciones ──────────────────────────────────────────
  // Sanitiza errores en producción: nunca expone stack traces ni mensajes
  // internos de Prisma al cliente.
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Trust proxy (nota de configuración para producción) ───────────────────
  // Detrás de nginx u otro reverse proxy, activar para que req.ip refleje
  // la IP real del cliente desde X-Forwarded-For:
  //   app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // No activar sin verificar que el proxy sea de confianza; de lo contrario,
  // un cliente puede falsificar su IP y eludir el rate limiting por IP.

  const port = configService.get<number>('BACKEND_PORT') ?? 5000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
