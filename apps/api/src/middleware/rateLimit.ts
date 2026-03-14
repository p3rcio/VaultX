// rate limiters for auth and share endpoints — slows down brute force attempts
import rateLimit from "express-rate-limit";

// 20 requests per minute is fine for normal use but stops scripted login attacks
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,  // sends RateLimit headers so clients know how many requests are left
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// share token lookups also get rate limited — slightly higher cap since they're less sensitive than login
export const shareLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
