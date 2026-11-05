import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RucniUvoz, RucniUvozSchema } from '../../schemas/rucni-uvoz.schema';
import { RucniUvozController } from '../../controllers/rucni-uvoz/rucni-uvoz.controller';
import { RucniUvozService } from '../../services/rucni-uvoz/rucni-uvoz.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RucniUvoz.name, schema: RucniUvozSchema },
    ]),
  ],
  controllers: [RucniUvozController],
  providers: [RucniUvozService],
  exports: [RucniUvozService],
})
export class RucniUvozModule {}
