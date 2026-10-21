import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

// Jedan dokument = statistika jednog vozača za jedan tjedan ili mjesec.
// Oblik polja odgovara VozacStatsPeriod iz stats/vozac-stats.calculator.ts
@Schema({ collection: 'vozacstats', minimize: false })
export class VozacStats extends Document {
  @Prop({ required: true }) radnik: string;
  @Prop({ required: true, enum: ['tjedan', 'mjesec'] }) tip: string;
  @Prop({ required: true }) godina: number;
  @Prop({ required: true }) period: number;
  @Prop() od: string;
  @Prop() do: string;
  @Prop() potpun: boolean;

  @Prop() daniSaPodacima: number;
  @Prop() radniDani: number;
  @Prop() nepoznateSluzbe: number;
  @Prop() slobodniDani: number;
  @Prop({ type: SchemaTypes.Mixed }) odsustva: Record<string, number>;
  @Prop({ type: SchemaTypes.Mixed }) smjene: Record<string, number>;

  @Prop() ukupniSati: number;
  @Prop() efektivniSati: number;
  @Prop() nocniSati: number;
  @Prop() prosjekSatiPoSmjeni: number;

  @Prop({ type: SchemaTypes.Mixed }) najranijiNastup: any;
  @Prop({ type: SchemaTypes.Mixed }) najkasnijiKraj: any;
  @Prop({ type: SchemaTypes.Mixed }) najkraciOdmor: any;
  @Prop() odmoriIspod12h: number;

  @Prop() radniVikendDani: number;
  @Prop() radneNedjelje: number;
  @Prop() najduziNiz: number;

  @Prop() brojLinija: number;
  @Prop({ type: SchemaTypes.Mixed }) linije: any[];
  @Prop({ type: SchemaTypes.Mixed }) kolege: any[];
  @Prop({ type: SchemaTypes.Mixed }) rang: any;

  @Prop({ default: Date.now }) izracunato: Date;
}

export const VozacStatsSchema = SchemaFactory.createForClass(VozacStats);

VozacStatsSchema.index(
  { radnik: 1, tip: 1, godina: 1, period: 1 },
  { unique: true },
);
