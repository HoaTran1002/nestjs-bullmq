import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class LoggingTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    console.log('➡️ Before handler');

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        console.log(
          '⬅️ After handler',
          `[${request.method}] ${request.url} - ${duration}ms`,
        );
      }),
    );
  }
}
