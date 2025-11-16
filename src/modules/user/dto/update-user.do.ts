import { PartialType } from 'import { PartialType } from '@nestjs/swagger'; // or '@nestjs/mapped-types'
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}'; // or '@nestjs/mapped-types'
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
