import { Schema, Document } from 'mongoose';

export interface Vozac extends Document {
  sluzbeniBroj: string;
  ime_prezime: string;
}

export const VozacSchema = new Schema({
  sluzbeniBroj: { type: String, required: true, unique: true },
  ime_prezime: { type: String, required: true },
});
