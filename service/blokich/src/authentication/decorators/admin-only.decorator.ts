import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

export function AdminOnly() {
  return applyDecorators(UseGuards(JwtAuthGuard, AdminGuard));
}
