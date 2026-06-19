import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// 100 requests per 15-minute window, keyed on API key
export const apiKeyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req.headers['x-api-key'] as string) ?? ipKeyGenerator(req.ip ?? '127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
})
