import type { NextFunction, Request, RequestHandler, Response } from "express";

// Forwards errors from async route handlers to the central error handler.
export function asyncHandler(fn: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function parseId(value: string): number | null {
  return /^\d{1,9}$/.test(value) ? Number(value) : null;
}
