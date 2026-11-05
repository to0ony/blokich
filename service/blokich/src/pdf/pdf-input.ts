import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Minimalni oblik PDF-a koji treba za obradu.
 * Express.Multer.File ga zadovoljava, pa se mogu slati i ručno uploadani
 * i automatski dohvaćeni (ZET) PDF-ovi.
 */
export interface PdfInput {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
}

export type PdfIzvor = 'rucno' | 'zet';

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Hash ZET-ovog PDF-a poslan uz ručni upload ispravljene verzije. */
export function izvorniHash(vrijednost?: string): string | undefined {
  if (!vrijednost) return undefined;
  if (!/^[a-f0-9]{64}$/.test(vrijednost)) {
    throw new BadRequestException('Neispravan hash izvornog PDF-a.');
  }
  return vrijednost;
}
