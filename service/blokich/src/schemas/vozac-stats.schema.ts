// vozac-stats.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class Statistika {
  @Prop() ukupni_sati: string;
  @Prop() efektivni_sati: string;
  @Prop() broj_druga_smjena: number;
  @Prop() broj_nocni_rad: number;
  @Prop() broj_dana_rada: number;

  @Prop({ type: Map, of: Number })
  oznaka_count: Map<string, number>;

  @Prop({ type: Map, of: Number })
  broj_linija: Map<string, number>;

  @Prop({ type: Map, of: Number })
  polazista_count: Map<string, number>;

  @Prop({ type: Map, of: Number })
  zavrsna_count: Map<string, number>;
}
export const StatistikaSchema = SchemaFactory.createForClass(Statistika);

@Schema()
export class VozacStats extends Document {
  @Prop() sluz_broj: string;
  @Prop() mjesec: number;
  @Prop() godina: number;

  @Prop({ type: StatistikaSchema })
  statistika: Statistika;
}
export const VozacStatsSchema = SchemaFactory.createForClass(VozacStats);
