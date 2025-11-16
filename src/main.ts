import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from './core/logging/logger.service';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      disableErrorMessages: false, // dev mode
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
