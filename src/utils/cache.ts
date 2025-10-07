import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
export const redis = new Redis(redisUrl);

export const cache = {
  async get(key: string) {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  async set(key: string, value: any, ttl = 3600) {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  },
  async del(key: string) {
    await redis.del(key);
  },
};
