import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

@Injectable()
export class PdfProcessingService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('PYTHON_API_BASE_URL') ||
      'http://127.0.0.1:8000';
  }

  async extractGodisnji(file: Express.Multer.File): Promise<any> {
    return this.postFile('/extract-godisnji', file);
  }

  async extractDisponent(file: Express.Multer.File): Promise<any> {
    return this.postFile('/extract-disponent', file);
  }

  async extractSluzba(file: Express.Multer.File): Promise<any> {
    return this.postFile('/extract-sluzba', file);
  }

  private async postFile(
    endpoint: string,
    file: Express.Multer.File,
  ): Promise<any> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.http.post(`${this.baseUrl}${endpoint}`, form, {
        headers: form.getHeaders(),
      }),
    );

    return response.data;
  }
}
