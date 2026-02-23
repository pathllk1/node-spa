/**
 * Security Middleware — Mongoose version
 *
 * No DB dependency — identical logic to the SQLite version.
 * Sets HTTP security headers on every response.
 */

export const securityMiddleware = (req, res, next) => {
  // ── Content Security Policy ───────────────────────────────────────
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  );

  // ── XSS Protection (legacy browsers) ─────────────────────────────
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // ── Prevent MIME type sniffing ────────────────────────────────────
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // ── Clickjacking protection ───────────────────────────────────────
  res.setHeader('X-Frame-Options', 'DENY');

  // ── HSTS — uncomment once HTTPS is confirmed in production ────────
  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // ── Referrer Policy ───────────────────────────────────────────────
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};
