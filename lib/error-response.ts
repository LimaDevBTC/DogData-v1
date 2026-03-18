import { NextResponse } from 'next/server';

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export function errorResponse(
  code: ErrorCode,
  message: string,
  options?: { retryAfter?: number }
) {
  const status = STATUS_MAP[code];
  const body = {
    error: {
      code,
      message,
      status,
      ...(options?.retryAfter && { retry_after: options.retryAfter }),
      docs_url: "https://www.dogdata.xyz/docs",
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (options?.retryAfter) {
    headers['Retry-After'] = String(options.retryAfter);
  }

  return NextResponse.json(body, { status, headers });
}
