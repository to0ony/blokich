import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Godisnji } from '../../schemas/godisnji.schema';

@Injectable()
export class GodisnjiService {
  constructor(@InjectModel(Godisnji.name) private model: Model<Godisnji>) {}

  async getBySluzBroj(sluz_broj: string): Promise<any> {
    const dokument = await this.model.findOne(
      { 'vozaci.sluz_broj': sluz_broj },
      { vozaci: { $elemMatch: { sluz_broj } } },
    );

    if (!dokument || !dokument.vozaci || dokument.vozaci.length === 0) {
      throw new NotFoundException(
        `Vozač s brojem "${sluz_broj}" nije pronađen.`,
      );
    }

    return dokument.vozaci[0];
  }
}
