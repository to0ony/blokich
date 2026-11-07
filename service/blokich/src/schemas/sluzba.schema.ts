import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class SluzbaItem {
  @Prop() br_sl: string;
  @Prop() linija: string;
  @Prop() varijanta: string;
  @Prop() nastup_sluzbe: string;
  @Prop() od: string;
  @Prop() do: string;
  @Prop() zavrsna_sluzba: string;
  @Prop() nocni_rad: string;
  @Prop() druga_smjena: string;
  @Prop() efektivni_sati: string;
  @Prop() ukupni_sati: string;
  /** RADNI_DAN / SUBOTA / NEDJELJA – iz boja u PDF-u. */
  @Prop({ type: [String], default: undefined }) dani?: string[];
  /** Datum važenja sa zaglavlja stranice (YYYY-MM-DD). */
  @Prop() vazi_od?: string;
  @Prop() vazi_do?: string;
  /** Naslov sekcije u PDF-u, npr. "PRIČUVE", "ŠKOLSKI PRIJEVOZ BEZ TURNUSA". */
  @Prop() sekcija?: string;
  /** jednodijelna / s_pauzom / dvokratna */
  @Prop() vrsta?: string;
}

export const SluzbaItemSchema = SchemaFactory.createForClass(SluzbaItem);

@Schema({ timestamps: true })
export class Sluzba extends Document {
  @Prop({ required: true }) verzija: string;
  @Prop({ type: [SluzbaItemSchema] }) sluzbe: SluzbaItem[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const SluzbaSchema = SchemaFactory.createForClass(Sluzba);
