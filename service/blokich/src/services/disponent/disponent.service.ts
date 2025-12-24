import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Disponent } from '../../schemas/disponent.schema';

@Injectable()
export class DisponentService {
  constructor(@InjectModel(Disponent.name) private model: Model<Disponent>) {}

  async getByRadnik(radnik: string): Promise<any> {
    try {
      const today = new Date();

      // Izračunaj broj tjedna (ISO standard)
      const prviCetvrtak = new Date(today.getFullYear(), 0, 4);
      const cetvrtakDan = prviCetvrtak.getDay() || 7;
      const prviTjedan = new Date(
        prviCetvrtak.getTime() - (cetvrtakDan - 1) * 86400000,
      );
      const brojTjedna = Math.ceil(
        ((today.getTime() - prviTjedan.getTime()) / 86400000 + 1) / 7,
      );

      // Izračunaj ISO godinu na temelju četvrtka trenutnog tjedna
      const mondayOfCurrentWeek = new Date(
        prviTjedan.getTime() + (brojTjedna - 1) * 7 * 86400000,
      );
      const thursdayOfCurrentWeek = new Date(
        mondayOfCurrentWeek.getTime() + 3 * 86400000,
      );
      const godina = thursdayOfCurrentWeek.getFullYear();

      const dokument = await this.model.findOne(
        {
          godina,
          brojTjedna,
          'radnici.radnik': radnik,
        },
        {
          radnici: {
            $elemMatch: { radnik },
          },
        },
      );

      if (!dokument || !dokument.radnici || dokument.radnici.length === 0) {
        throw new NotFoundException(
          `Radnik s ID-jem "${radnik}" nije pronađen za tjedan ${brojTjedna}, ${godina}.`,
        );
      }

      return dokument.radnici[0];
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Error fetching data for radnik:', radnik, error);

      throw new InternalServerErrorException(
        'Došlo je do greške prilikom dohvaćanja podataka. Pokušajte ponovno kasnije.',
      );
    }
  }
}
