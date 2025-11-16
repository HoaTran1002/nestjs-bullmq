import { Global, Module } from '@nestjs/common';
import { createLogger } from './logger.config';
import { LoggerService } from './logger.service';

@Global()
@Module({
  providers: [
    {
      provide: 'PINOLOGGER',
      useFactory: async (): Promise<import('pino').Logger> => {
        try {
          return await createLogger();
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
    },
    {
      provide: LoggerService,
      useFactory: (pinoLogger: import('pino').Logger) =>
        new LoggerService(pinoLogger),
      inject: ['PINOLOGGER'],
    },
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
