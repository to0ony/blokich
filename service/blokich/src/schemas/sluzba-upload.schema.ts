import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class SluzbaUpload extends Document {
  @Prop({ required: true })
  datum_unosa: Date;

  @Prop({ required: true })
  broj_ubacenih: number;

  @Prop()
  filename: string;

  @Prop()
  original_filename: string;

  @Prop()
  verzija: string;
}

export const SluzbaUploadSchema = SchemaFactory.createForClass(SluzbaUpload);
