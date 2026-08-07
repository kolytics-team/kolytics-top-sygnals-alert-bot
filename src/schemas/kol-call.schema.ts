import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'kol_calls',
  timestamps: { createdAt: true, updatedAt: false },
})
export class KolCall {
  @Prop({ required: true, index: true })
  kol: string;

  @Prop({ required: true, type: Number })
  x: number;

  @Prop({ required: true })
  raw: string;
}

export type KolCallDocument = KolCall & Document;
export const KolCallSchema = SchemaFactory.createForClass(KolCall);
