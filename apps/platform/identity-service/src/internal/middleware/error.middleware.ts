import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

export function centralErrorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    // pino-http adds a logger to the request object
    const log = req.log || logger;

    let errorDetails: unknown = err;
    const errorMessage = 'An internal server error occurred.';
    let statusCode = 500;

    if (err instanceof Error) {
      errorDetails = { message: err.message, stack: err.stack };
      // You can create custom error classes that have a statusCode property
      if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
        statusCode = (err as any).statusCode;
      }
    }

    log.error({ err: errorDetails, reqId: req.id }, 'Unhandled error caught by central handler');

    // In a production environment, send a generic response.
    // In development, you might want to send more details.
    if (process.env.NODE_ENV === 'production') {
      res.status(statusCode).json({ error: errorMessage });
    } else {
      res.status(statusCode).json({ error: errorMessage, details: errorDetails });
    }
  };
}
