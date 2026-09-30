import type { ErrorRequestHandler, NextFunction, RequestHandler } from "express";
import { randomUUID } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const requestId: RequestHandler = (request, _response, next) => {
  request.requestId = request.header("x-request-id") ?? randomUUID();
  next();
};

export const asyncRoute = (handler: RequestHandler): RequestHandler =>
  (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const normalized = error instanceof HttpError
    ? error
    : new HttpError(500, "INTERNAL_ERROR", "An unexpected error occurred.");

  if (!(error instanceof HttpError)) {
    console.error(error);
  }

  response.status(normalized.status).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { details: error.message } : {}),
      ...(normalized.fields ? { fields: normalized.fields } : {}),
      requestId: request.requestId,
    },
  });
};

export const notFound = (_request: Express.Request, _response: Express.Response, next: NextFunction) => {
  next(new HttpError(404, "NOT_FOUND", "Route not found."));
};

export const parsePage = (value: unknown, fallback: number, maximum: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

export const collection = <T>(data: T[], page: number, pageSize: number, total: number) => ({
  data,
  pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
});

export const requireBody = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(422, "VALIDATION_ERROR", "Request body must be an object.");
  }
  return value as Record<string, unknown>;
};

export const stringValue = (value: unknown, field: string, required = true) => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && !value.trim())) {
    throw new HttpError(422, "VALIDATION_ERROR", "One or more fields are invalid.", { [field]: "Enter a valid value." });
  }
  return value.trim();
};

export const integerValue = (value: unknown, field: string, minimum = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new HttpError(422, "VALIDATION_ERROR", "One or more fields are invalid.", { [field]: `Enter an integer greater than or equal to ${minimum}.` });
  }
  return parsed;
};