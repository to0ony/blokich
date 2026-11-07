import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { izvorniHash, zastavica } from 'src/pdf/pdf-input';
import { DisponentUploadService } from '../../services/disponent-upload/disponent-upload.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import { Public } from 'src/authentication/decorators/public.decorator';

@Controller('disponent-upload')
export class DisponentUploadController {
  constructor(
    private readonly disponentUploadService: DisponentUploadService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('pdf', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.pdf$/)) {
          return cb(
            new BadRequestException('Samo PDF datoteke su dozvoljene!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadDisponent(
    @UploadedFile() file: Express.Multer.File,
    @Body('izvorni_sha256') izvorni?: string,
    @Body('prepisi') prepisi?: string,
  ) {
    if (!file) {
      throw new BadRequestException('PDF datoteka nije poslana.');
    }

    return this.disponentUploadService.processPdf(
      file,
      'rucno',
      izvorniHash(izvorni),
      {
        prepisi: zastavica(prepisi),
      },
    );
  }

  // Login stranica prikazuje je li objavljen naredni tjedan.
  @Public()
  @Get('last-upload')
  async getLastUpload() {
    return this.disponentUploadService.getLastUploadInfo();
  }

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('povijest')
  async getPovijest() {
    return this.disponentUploadService.getPovijest();
  }
}
