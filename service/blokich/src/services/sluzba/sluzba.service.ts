import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sluzba } from '../../schemas/sluzba.schema';

@Injectable()
export class SluzbaService {
  constructor(@InjectModel(Sluzba.name) private model: Model<Sluzba>) {}

  async findAll(): Promise<Sluzba[]> {
    return this.model.find().exec();
  }

  async findByBrSl(br_sl: string): Promise<Sluzba[]> {
    return this.model.find({ br_sl }).exec();
  }
}
