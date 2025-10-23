import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import app from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

describe("/version", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("returns version metadata", async () => {
    const res = await request(app).get("/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        gitSha: expect.any(String),
        buildTime: expect.any(String),
      })
    );
  });
});
