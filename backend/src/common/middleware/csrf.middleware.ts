import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Endpoints que no requieren verificación CSRF porque no dependen de
// una cookie de sesión para autorizar la operación.
const CSRF_SKIP_PATHS = [
  '/auth/login',
  '/auth/solicitar-recuperacion',
  '/auth/restablecer-contrasena',
];

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly frontendOrigin: string;

  constructor(private readonly configService: ConfigService) {
    this.frontendOrigin = (
      configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    if (CSRF_SKIP_PATHS.some(p => req.path === p || req.path.endsWith(p))) {
      next();
      return;
    }

    const origin = req.headers['origin'];

    if (!origin) {
      // Para operaciones autenticadas mutantes Origin es obligatorio.
      // No existe un caso de uso legítimo en UDEMM Global donde un cliente
      // no-browser realice operaciones con cookies de sesión sin Origin.
      throw new ForbiddenException('Origin requerido');
    }

    if (origin.replace(/\/$/, '') !== this.frontendOrigin) {
      throw new ForbiddenException('Origin no permitido');
    }

    // Verificar header personalizado como segunda capa de defensa.
    // apiFetch lo incluye en todas las solicitudes mutantes.
    const xRequestedWith = req.headers['x-requested-with'];
    if (xRequestedWith !== 'XMLHttpRequest') {
      throw new ForbiddenException('Header de seguridad requerido');
    }

    next();
  }
}
