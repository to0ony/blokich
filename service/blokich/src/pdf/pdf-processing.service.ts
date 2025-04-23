import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

@Injectable()
export class PdfProcessingService {
  constructor(private readonly http: HttpService) {}

  async extractGodisnji(file: Express.Multer.File): Promise<any> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.http.post(
        'https://blokich-python.onrender.com/extract-godisnji',
        form,
        {
          headers: form.getHeaders(),
        },
      ),
    );

    return response.data;
  }

  async extractDisponent(file: Express.Multer.File): Promise<any> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.http.post(
        'https://blokich-python.onrender.com/extract-disponent',
        form,
        {
          headers: form.getHeaders(),
        },
      ),
    );

    return response.data;
  }

  async extractSluzba(file: Express.Multer.File): Promise<any> {
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.http.post(
        'https://blokich-python.onrender.com/extract-sluzba',
        form,
        {
          headers: form.getHeaders(),
        },
      ),
    );

    return response.data;
  }
}
