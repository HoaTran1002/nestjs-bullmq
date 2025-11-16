import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRepository } from './repository/user-repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
  async create(createDto: CreateUserDto) {
    try {
      return await this.userRepository.create(createDto);
    } catch (error) {
      throw new InternalServerErrorException(
        error?.message || 'Unexpected error',
      );
    }
  }
}
