// In-memory rate limiter: 100 requests per hour per IP.
// NOTE: This state is ephemeral and resets on every process restart or redeploy.
// For durable rate limiting in production, consider a Redis-backed store.

const windowMs = 60 * 60 * 1000; // 1 hour
const maxRequests = 100;

const hits = new Map();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now - entry.resetTime > windowMs) {
      hits.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

export function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  let entry = hits.get(ip);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
    hits.set(ip, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  next();
}
