import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RucniUvoz } from '../../schemas/rucni-uvoz.schema';

export interface RucniUvozZapis {
  dokument: 'sluzba' | 'disponent';
  oznaka: string;
  original_filename: string;
  sha256: string;
  izvorni_sha256?: string;
}

const LIMIT = 50;

@Injectable()
export class RucniUvozService {
  private readonly logger = new Logger(RucniUvozService.name);

  constructor(
    @InjectModel(RucniUvoz.name)
    private readonly rucniUvozModel: Model<RucniUvoz>,
  ) {}

  /** Podaci su već spremljeni, pa greška zapisa ne smije srušiti upload. */
  async zabiljezi(zapis: RucniUvozZapis): Promise<void> {
    try {
      await this.rucniUvozModel.create({ ...zapis, datum_unosa: new Date() });
    } catch (err) {
      this.logger.error('Ručni uvoz nije zabilježen u povijest', err);
    }
  }

  async povijest() {
    return this.rucniUvozModel
      .find()
      .sort({ datum_unosa: -1 })
      .limit(LIMIT)
      .lean();
  }
}
