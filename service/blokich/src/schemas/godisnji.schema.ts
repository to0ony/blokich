import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

interface Timestamps {
  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ _id: false }) // Godišnji dio unutar jednog vozača
export class GodisnjiDio {
  @Prop() dio: string;

  @Prop() od: string;

  @Prop() do: string;

  @Prop() dana: string;
}

@Schema({ _id: false }) // Vozač unutar glavnog dokumenta
export class VozacGodisnji {
  @Prop() sluz_broj: string;

  @Prop() ime_prezime: string;

  @Prop({ type: [GodisnjiDio] })
  godisnji: GodisnjiDio[];

  @Prop() ukupno_dana: string;

  //dodani kontakt brojevi vozaca
  @Prop() kontakt_broj: string;
  @Prop() kontakt_broj_info: string;
}

@Schema({ timestamps: true, collection: 'godisnji' })
export class Godisnji extends Document {
  @Prop({ type: [VozacGodisnji] })
  vozaci: VozacGodisnji[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const GodisnjiSchema = SchemaFactory.createForClass(Godisnji);
