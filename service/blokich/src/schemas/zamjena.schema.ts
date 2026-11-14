import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class StranaZamjene {
  /** Službeni broj kako piše u disponentu. */
  @Prop({ required: true }) radnik: string;
  /** Oznaka u disponentu u trenutku zamjene (broj službe ili O…). */
  @Prop({ required: true }) oznaka: string;
  @Prop() ime?: string;
}

const StranaZamjeneSchema = SchemaFactory.createForClass(StranaZamjene);

/**
 * Zamjena ili ukidanje službe jednog dana. Disponent se ne mijenja –
 * zamjene se primjenjuju pri čitanju (vidi zamjene/primijeni-zamjene.ts),
 * pa preživljavaju ponovni uvoz disponenta.
 */
@Schema({ collection: 'zamjene' })
export class Zamjena extends Document {
  @Prop({ required: true }) godina: number;
  @Prop({ required: true }) brojTjedna: number;
  /** pon … ned */
  @Prop({ required: true }) dan: string;
  /** Datum dana, YYYY-MM-DD. */
  @Prop({ required: true, index: true }) datum: string;
  @Prop({ required: true, enum: ['zamjena', 'ukidanje'] }) tip: string;

  /** Vozač koji je napravio zamjenu. */
  @Prop({ type: StranaZamjeneSchema, required: true }) a: StranaZamjene;
  /** Kolega (samo kod zamjene). */
  @Prop({ type: StranaZamjeneSchema }) b?: StranaZamjene;

  /** Brojevi oba vozača (bez vodećih nula) – za filtriranje. */
  @Prop({ type: [Number], index: true }) sudionici: number[];

  @Prop({ default: Date.now }) kreirano: Date;
  @Prop({ type: Date, default: null }) ponistena: Date | null;
}

export const ZamjenaSchema = SchemaFactory.createForClass(Zamjena);

ZamjenaSchema.index({ godina: 1, brojTjedna: 1 });
