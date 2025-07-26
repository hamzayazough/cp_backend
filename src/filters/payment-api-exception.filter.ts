import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class PaymentApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const responseObj = exceptionResponse as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        message = responseObj.message || exception.message;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        error = responseObj.error || responseObj.message || exception.message;
      }
    } else if (exception instanceof Error) {
      error = exception.message;

      // Handle Stripe-specific errors
      if (exception.message.includes('Stripe')) {
        message = 'Payment processing error';
        error = `Stripe API error: ${exception.message}`;
      }
    }

    // Map HTTP status to appropriate error messages
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        message = 'Invalid request parameters';
        break;
      case HttpStatus.UNAUTHORIZED:
        message = 'Authentication required';
        error = 'Invalid or missing JWT token';
        break;
      case HttpStatus.FORBIDDEN:
        message = 'Access denied';
        error = 'User does not have permission to access this resource';
        break;
      case HttpStatus.NOT_FOUND:
        message = 'Resource not found';
        break;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        message = 'Internal server error';
        break;
    }

    response.status(status).json({
      success: false,
      message,
      error,
    });
  }
}
