import type { ApiResponse, ApiError, PaginatedResponse } from '../types/index.js'

export function apiSuccess<T>(data: T, requestId: string): ApiResponse<T> {
  return {
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: '1',
    },
  }
}

export function apiError(code: string, message: string, requestId: string, details?: unknown): ApiError {
  return {
    error: { code, message, details },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: '1',
    },
  }
}

export function paginatedSuccess<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  requestId: string
): PaginatedResponse<T> {
  return {
    data,
    pagination: { page, limit, total, hasMore: page * limit < total },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: '1',
    },
  }
}
