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
    const user = await this.userRepository.findByEmail(createDto.email);
    if (user) {
      throw new NotFoundException('User already exists');
    }
    return await this.userRepository.create(createDto);
  }
}
