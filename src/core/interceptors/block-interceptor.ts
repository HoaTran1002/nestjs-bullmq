import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class BlockInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();

    // 🧠 Chặn method PATCH trong giờ cấm (ví dụ)
    const hour = new Date().getHours();
    if (req.method === 'PATCH' && (hour < 8 || hour > 18)) {
      return of({
        message: 'PATCH requests are not allowed outside business hours',
      });
    }

    console.log('Continue to handler...');
    return next.handle();
  }
}
