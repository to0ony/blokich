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
