import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
      storage: diskStorage({
        destination: './uploads/sluzbe', // ⬅️ mapa gdje se spremaju sluzba PDF-ovi
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
  async uploadSluzba(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF datoteka nije poslana.');
    }

    return this.sluzbaUploadService.processPdf(file);
  }

  @Get('last-upload')
  async getLastUpload() {
    return this.sluzbaUploadService.getLastUploadInfo();
  }
}
