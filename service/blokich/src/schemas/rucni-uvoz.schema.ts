import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/** Trajni zapis ručnih uvoza – ostaje i kad se disponent tjedna zamijeni. */
@Schema({ collection: 'rucni_uvoz' })
export class RucniUvoz extends Document {
  @Prop({ required: true })
  dokument: string;

  /** Tjedan disponenta ili verzija službi. */
  @Prop({ required: true })
  oznaka: string;

  @Prop({ required: true })
  datum_unosa: Date;

  @Prop()
  original_filename: string;

  @Prop({ required: true })
  sha256: string;

  /** Hash ZET-ovog PDF-a koji ovaj uvoz ispravlja. */
  @Prop()
  izvorni_sha256?: string;
}

export const RucniUvozSchema = SchemaFactory.createForClass(RucniUvoz);
