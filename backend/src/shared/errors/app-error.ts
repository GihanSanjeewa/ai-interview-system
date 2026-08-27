export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new AppError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new AppError(401, "unauthorized", message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, "forbidden", message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, "not_found", message);
  }
  static conflict(message = "Conflict") {
    return new AppError(409, "conflict", message);
  }
  static internal(message = "Internal server error") {
    return new AppError(500, "internal", message);
  }
  /** A dependency (the ML service) is down; the request may succeed on retry. */
  static serviceUnavailable(message = "Service temporarily unavailable") {
    return new AppError(503, "service_unavailable", message);
  }
}
