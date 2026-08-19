import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data: T) => {
        const result = data as ApiResponse<T>;

        return {
          success: true,
          statusCode,
          message: result.message ?? 'Successful',
          data: result.data ?? data,
        };
      }),
    );
  }
}
