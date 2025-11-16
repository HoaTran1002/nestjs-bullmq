import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: createDto,
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }
  async findByEmail(email: string) {
    try {
      return await this.prisma.user.findUnique({
        where: {
          email,
        },
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }
}
