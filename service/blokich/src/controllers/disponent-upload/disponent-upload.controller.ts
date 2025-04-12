import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { DisponentUploadService } from '../../services/disponent-upload/disponent-upload.service';
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { Admin } from 'src/schemas/admin.schema';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';

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
      storage: diskStorage({
        destination: './uploads/disponenti',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
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
  async uploadDisponent(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF datoteka nije poslana.');
    }

    return this.disponentUploadService.processPdf(file);
  }

  @Get('last-upload')
  async getLastUpload() {
    return this.disponentUploadService.getLastUploadInfo();
  }
}
