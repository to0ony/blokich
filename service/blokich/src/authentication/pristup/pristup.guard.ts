import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PRISTUP_HEADER, PristupService } from './pristup.service';

/**
 * Globalni guard: svaki endpoint osim onih s @Public() traži
 * pristupni token vozača (header X-Pristup-Token) ili admin JWT.
 */
@Injectable()
export class PristupGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly pristup: PristupService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || !this.pristup.ukljucen) return true;

    const req = context.switchToHttp().getRequest();
    if (
      this.pristup.provjeriToken(req.headers[PRISTUP_HEADER]) ||
      this.pristup.provjeriAdminToken(req.headers['authorization'])
    ) {
      return true;
    }

    throw new UnauthorizedException({
      statusCode: 401,
      code: 'PRISTUP',
      message: 'Potrebna je lozinka za pristup.',
    });
  }
}
