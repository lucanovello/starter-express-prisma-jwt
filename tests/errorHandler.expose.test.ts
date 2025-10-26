import { describe, expect, test, vi } from "vitest";

import { AppError } from "../src/lib/errors.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

function createMockRes() {
  const json = vi.fn();
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json,
  };
  return { res, json };
}

describe("errorHandler AppError exposure", () => {
  test("hides message and code when expose is false", () => {
    const { res, json } = createMockRes();
    const err = new AppError("Sensitive failure", 500, {
      code: "SECRET",
      expose: false,
    });

    errorHandler(err, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: { message: "Internal Server Error" },
    });
  });

  test("retains message and code by default", () => {
    const { res, json } = createMockRes();
    const err = new AppError("Bad input", 400, { code: "BAD_INPUT" });

    errorHandler(err, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { message: "Bad input", code: "BAD_INPUT" },
    });
  });

  test("returns deterministic forbidden payload for blocked origin", () => {
    const { res, json } = createMockRes();
    const err = new AppError("Forbidden", 403, {
      code: "CORS_ORIGIN_FORBIDDEN",
    });

    errorHandler(err, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: { message: "Forbidden", code: "CORS_ORIGIN_FORBIDDEN" },
    });
  });
});
