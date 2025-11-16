import { PrismaService } from '@/core/database/prisma.service';
import { CreateUserDto } from '../dto/create-user.dto';

export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateUserDto) {
    return this.prisma.user.create({
      data: createDto,
    });
  }
}
