export type RateLimitRedisHealth =
  | { status: "unknown" }
  | { status: "ready" }
  | { status: "unhealthy"; reason?: string };

let redisHealth: RateLimitRedisHealth = { status: "unknown" };

export const markRateLimitRedisHealthy = (): void => {
  redisHealth = { status: "ready" };
};

export const markRateLimitRedisUnhealthy = (reason?: string): void => {
  redisHealth = reason ? { status: "unhealthy", reason } : { status: "unhealthy" };
};

export const getRateLimitRedisHealth = (): RateLimitRedisHealth => redisHealth;
