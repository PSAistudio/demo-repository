export interface AppError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class NotFoundError extends Error implements AppError {
  code = "NOT_FOUND";
  statusCode = 404;
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "NotFoundError";
    this.details = details;
  }
}

export class ValidationError extends Error implements AppError {
  code = "VALIDATION_ERROR";
  statusCode = 400;
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class UnauthorizedError extends Error implements AppError {
  code = "UNAUTHORIZED";
  statusCode = 401;
  details?: Record<string, unknown>;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error implements AppError {
  code = "FORBIDDEN";
  statusCode = 403;
  details?: Record<string, unknown>;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends Error implements AppError {
  code = "CONFLICT";
  statusCode = 409;
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ConflictError";
    this.details = details;
  }
}

export class InternalError extends Error implements AppError {
  code = "INTERNAL_ERROR";
  statusCode = 500;
  details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "InternalError";
    this.details = details;
  }
}

export function handleApiError(err: unknown): Response {
  console.error("API Error:", err);

  if (isAppError(err)) {
    return Response.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      { status: err.statusCode }
    );
  }

  if (err instanceof Error) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err.message,
        },
      },
      { status: 500 }
    );
  }

  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
}

function isAppError(err: unknown): err is AppError {
  return (
    err instanceof Error &&
    "code" in err &&
    "statusCode" in err &&
    typeof (err as AppError).code === "string" &&
    typeof (err as AppError).statusCode === "number"
  );
}

export function createErrorHandler(): (
  err: unknown,
  request: Request
) => Response {
  return (err: unknown, _request: Request) => {
    return handleApiError(err);
  };
}
