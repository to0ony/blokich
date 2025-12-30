import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Sluzba, SluzbaItem } from '../../schemas/sluzba.schema';

@Injectable()
export class SluzbaService {
  constructor(@InjectModel(Sluzba.name) private model: Model<Sluzba>) {}

  async findAll(): Promise<Sluzba | null> {
    return this.model.findOne().sort({ createdAt: -1 }).exec();
  }

  async findByVerzija(verzija: string): Promise<Sluzba | null> {
    return this.model.findOne({ verzija }).exec();
  }

  async findByBrSl(br_sl: string): Promise<SluzbaItem[]> {
    const latestDoc = await this.model
      .findOne()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!latestDoc) {
      return [];
    }

    const matchingSluzbe = (latestDoc.sluzbe || []).filter(
      (s) => s.br_sl === br_sl,
    );

    return matchingSluzbe;
  }

  async findAllByBrSl(br_sl: string): Promise<any[]> {
    const docs = await this.model.find().sort({ createdAt: -1 }).lean().exec();

    const result: any[] = [];
    for (const doc of docs) {
      const matchingSluzbe = (doc.sluzbe || []).filter(
        (s) => s.br_sl === br_sl,
      );

      for (const sluzba of matchingSluzbe) {
        result.push({
          ...sluzba,
          verzija: doc.verzija,
          datum_unosa: doc.createdAt,
        });
      }
    }

    return result;
  }
}
