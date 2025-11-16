import { Controller, Post } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Post('/create')
  async create(@Body() createDto: CreateUserDto) {
    return this.userService.create(createDto);
  }
}
