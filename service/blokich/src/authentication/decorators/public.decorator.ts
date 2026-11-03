import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Endpoint dostupan bez lozinke za pristup (vidi PristupGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
