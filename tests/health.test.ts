import request from "supertest";
import app from "../src/app.js";
import { test, expect } from "vitest";

test("GET /health -> 200 with {status:'ok'}", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
});
