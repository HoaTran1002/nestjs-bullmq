import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRepository } from './repository/user-repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}
  async create(createDto: CreateUserDto) {
    return this.userRepository.create(createDto);
  }
}
