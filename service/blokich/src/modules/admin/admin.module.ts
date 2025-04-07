import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from 'src/schemas/admin.schema';
import { AdminService } from 'src/services/admin/admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Admin', schema: AdminSchema }]),
  ],
  providers: [AdminService],
  exports: [AdminService, MongooseModule],
})
export class AdminModule {}
