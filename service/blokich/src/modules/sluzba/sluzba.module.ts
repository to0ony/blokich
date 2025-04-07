import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Sluzba, SluzbaSchema } from '../../schemas/sluzba.schema';
import { SluzbaService } from '../../services/sluzba/sluzba.service';
import { SluzbaController } from '../../controllers/sluzba/sluzba.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Sluzba.name, schema: SluzbaSchema, collection: 'sluzba' },
    ]),
  ],
  controllers: [SluzbaController],
  providers: [SluzbaService],
  exports: [SluzbaService],
})
export class SluzbaModule {}
