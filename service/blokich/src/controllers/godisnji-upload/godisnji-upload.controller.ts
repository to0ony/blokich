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
import { extname } from 'path';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { AdminOnly } from 'src/authentication/decorators/admin-only.decorator';
import { GodisnjiUploadService } from '../../services/godisnji-upload/godisnji-upload.service';

@Controller('godisnji-upload')
export class GodisnjiUploadController {
  constructor(private readonly godisnjiUploadService: GodisnjiUploadService) {}

  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('pdf', {
      storage: diskStorage({
        destination: './uploads/godisnji',
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
  async uploadGodisnji(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF datoteka nije poslana.');
    }

    return this.godisnjiUploadService.processPdf(file);
  }

  @Get('last-upload')
  async getLastUpload() {
    return this.godisnjiUploadService.getLastUploadInfo();
  }
}
