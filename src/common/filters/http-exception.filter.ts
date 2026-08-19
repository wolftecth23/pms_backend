import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  isAuthenticated?: boolean;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    // const request = ctx.getRequest<FastifyRequest>();

    const status: HttpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    let message = 'Internal server error';
    let errorType = 'Internal Error';

    let isAuthenticated = true;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else {
      const response = exceptionResponse as HttpExceptionResponse;

      if (Array.isArray(response.message)) {
        message = response.message.join(', ');
      } else if (response.message) {
        message = response.message;
      }

      if (response.error) {
        errorType = response.error;
      }

      if (response.isAuthenticated !== undefined) {
        isAuthenticated = response.isAuthenticated;
      }
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(exception);
    }

    response.status(status).send({
      success: false,
      statusCode: status,
      message,
      error: errorType,
      isAuthenticated,
      // timestamp: new Date().toISOString(),
      // path: request.url,
    });
  }
}

// else if (
//   typeof exceptionResponse === 'object' &&
//   exceptionResponse !== null
// ) {
//   message = (exceptionResponse as any).message || message;
//   errorType = (exceptionResponse as any).error || errorType;
// }
