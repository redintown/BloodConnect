/**
 * Central typed-error hierarchy. Services throw these instead of raw
 * strings/Error so route handlers and Server Actions can map them to the
 * right HTTP status / user-facing message without ever leaking internals
 * (stack traces, SQL errors, etc.) to the client.
 */
export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

const DEFAULT_STATUS: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Safe to show to the end user. Do not put internal detail here. */
  readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.userMessage = userMessage;
    if (cause !== undefined) this.cause = cause;
  }

  static validation(message = "The provided data is invalid.") {
    return new AppError("VALIDATION_ERROR", message);
  }

  static unauthenticated(message = "You need to be signed in to do that.") {
    return new AppError("AUTHENTICATION_ERROR", message);
  }

  static unauthorized(message = "You don't have permission to do that.") {
    return new AppError("AUTHORIZATION_ERROR", message);
  }

  static notFound(message = "The requested resource was not found.") {
    return new AppError("NOT_FOUND", message);
  }

  static conflict(message = "This conflicts with existing data.") {
    return new AppError("CONFLICT", message);
  }

  static rateLimited(message = "Too many requests. Please try again shortly.") {
    return new AppError("RATE_LIMITED", message);
  }

  static server(cause?: unknown) {
    // Intentionally generic — the real cause is logged server-side, never
    // sent to the client.
    return new AppError("SERVER_ERROR", "Something went wrong. Please try again.", cause);
  }
}

/** Thrown by service methods that are intentionally not implemented yet. */
export class NotImplementedError extends AppError {
  constructor(serviceMethod: string) {
    super("SERVER_ERROR", "This feature isn't available yet.");
    this.name = "NotImplementedError";
    this.message = `${serviceMethod} is not implemented yet (see project phase plan).`;
  }
}
