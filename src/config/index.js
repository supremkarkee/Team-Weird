// Reads configuration from environment variables once, at start-up.
// Secrets never live in code (NFR-SEC-11). Missing values stop the app immediately.

const required = ['APP_BASE_URL', 'STAFF_BASE_URL', 'DATABASE_URL', 'SESSION_SECRET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env.`);
}

export const config = Object.freeze({
  isDev: process.env.NODE_ENV !== 'production',
  port: Number(process.env.PORT ?? 3000),
  appBaseUrl: new URL(process.env.APP_BASE_URL),
  staffBaseUrl: new URL(process.env.STAFF_BASE_URL),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  gatewayUrl: process.env.GATEWAY_URL,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 1025),
    from: process.env.MAIL_FROM,
  },
});
