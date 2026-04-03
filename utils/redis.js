// Redis has been disabled — Upstash free tier exhausted.
// All cache functions return null/false so the app falls back to MongoDB seamlessly.
// Re-enable by replacing these stubs with actual ioredis logic once quota resets.

const redisClient = null;

const getCache = async () => null;
const setCache = async () => false;
const delCache = async () => false;

module.exports = { redisClient, getCache, setCache, delCache };
