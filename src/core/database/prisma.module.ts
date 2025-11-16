import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CoreConfigModule } from '../config/config.module';

@Global() // Make PrismaService available globally without importing PrismaModule everywhere
@Module({
  imports: [CoreConfigModule],
  providers: [PrismaService],
  exports: [PrismaService], // Export PrismaService so other modules can inject it
})
export class PrismaModule {}
