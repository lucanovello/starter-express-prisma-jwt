import pino, { type DestinationStream } from "pino";
import { Writable } from "node:stream";
import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("log redaction", () => {
  test("censors sensitive headers and body fields", async () => {
    vi.resetModules();
    const { LOG_REDACTION_PATHS } = await import("../src/app.js");

    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    const logger = pino(
      {
        level: "info",
        redact: { paths: [...LOG_REDACTION_PATHS], censor: "[REDACTED]" },
      },
      stream as unknown as DestinationStream,
    );

    logger.info({
      req: {
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=secret",
          "set-cookie": "session=secret",
          "x-metrics-secret": "metrics-secret",
        },
        body: {
          password: "hunter2",
          passwordConfirmation: "hunter2",
          refreshToken: "refresh-secret",
          clientSecret: "oauth-secret",
        },
      },
      res: {
        headers: {
          "set-cookie": "session=secret",
        },
      },
    });

    const output = chunks.join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("secret-token");
    expect(output).not.toContain("session=secret");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("oauth-secret");
    const parsed = JSON.parse(chunks[0]!);
    expect(parsed.req.headers["x-metrics-secret"]).toBe("[REDACTED]");
  });
});
