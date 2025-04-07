import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin, AdminDocument } from 'src/schemas/admin.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
  ) {}

  async findByUsername(username: string): Promise<Admin | null> {
    try {
      return this.adminModel.findOne({ username }).exec();
    } catch (error) {
      this.logger.error(`Error finding admin by username: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<Admin | null> {
    try {
      return this.adminModel.findById(id).exec();
    } catch (error) {
      this.logger.error(`Error finding admin by id: ${error.message}`);
      throw error;
    }
  }

  async create(data: {
    username: string;
    password: string;
    email?: string;
    isActive?: boolean;
    isAdmin?: boolean;
    lastPasswordChangeAt?: Date;
  }): Promise<Admin> {
    try {
      // Check if username already exists
      const existing = await this.findByUsername(data.username);
      if (existing) {
        throw new ConflictException('Username already exists');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const newAdmin = new this.adminModel({
        ...data,
        password: hashedPassword,
        isActive: data.isActive ?? true,
        isAdmin: data.isAdmin ?? false,
        lastPasswordChangeAt: data.lastPasswordChangeAt ?? new Date(),
      });

      return newAdmin.save();
    } catch (error) {
      this.logger.error(`Error creating admin: ${error.message}`);
      throw error;
    }
  }
}
