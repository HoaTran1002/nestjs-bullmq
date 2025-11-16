import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreConfigModule } from '@/core/config/config.module';
import { LoggerModule } from './core/logging/logger.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [CoreConfigModule, LoggerModule, UserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
