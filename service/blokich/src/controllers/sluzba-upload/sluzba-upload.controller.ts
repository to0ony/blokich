import {
  Controller,
  Post,
  Body,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { izvorniHash } from 'src/pdf/pdf-input';
import { SluzbaUploadService } from '../../services/sluzba-upload/sluzba-upload.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';

@Controller('sluzba-upload')
export class SluzbaUploadController {
  constructor(private readonly sluzbaUploadService: SluzbaUploadService) {}

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
  async uploadSluzba(
    @UploadedFile() file: Express.Multer.File,
    @Body('izvorni_sha256') izvorni?: string,
  ) {
    if (!file) {
      throw new BadRequestException('PDF datoteka nije poslana.');
    }

    return this.sluzbaUploadService.processPdf(
      file,
      'rucno',
      izvorniHash(izvorni),
    );
  }

  @Get('last-upload')
  async getLastUpload() {
    return this.sluzbaUploadService.getLastUploadInfo();
  }
}
