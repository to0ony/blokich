import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class Dan {
  @Prop({ required: true })
  radnik: string;

  @Prop() pon: string;
  @Prop() uto: string;
  @Prop() sri: string;
  @Prop() cet: string;
  @Prop() pet: string;
  @Prop() sub: string;
  @Prop() ned: string;
}

const DanSchema = SchemaFactory.createForClass(Dan);

@Schema()
export class Disponent extends Document {
  @Prop({ required: true })
  godina: number;

  @Prop({ required: true })
  brojTjedna: number;

  @Prop({ type: [DanSchema], required: true })
  radnici: Dan[];

  @Prop({ default: Date.now })
  datum_unosa: Date;

  @Prop()
  verzija_sluzbe: string;
}

export const DisponentSchema = SchemaFactory.createForClass(Disponent);

DisponentSchema.index({ godina: 1, brojTjedna: 1 }, { unique: true });
