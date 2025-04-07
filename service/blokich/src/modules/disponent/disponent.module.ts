import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DisponentService } from '../../services/disponent/disponent.service';
import { DisponentController } from '../../controllers/disponent/disponent.controller';
import { Disponent, DisponentSchema } from 'src/schemas/disponent.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Disponent.name,
        schema: DisponentSchema,
        collection: 'disponent',
      },
    ]),
  ],
  controllers: [DisponentController],
  providers: [DisponentService],
})
export class DisponentModule {}
