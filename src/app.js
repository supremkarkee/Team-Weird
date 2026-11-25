import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import nunjucks from 'nunjucks';
import session from 'express-session';
import { csrfSync } from 'csrf-sync';
import { config } from './config/index.js';
import { resolvePortal, requirePortal } from './shared/portal.js';
import { notFound, errorHandler } from './shared/errorHandler.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  // 'trust proxy' stays OFF: the app is never behind a proxy, so client-supplied
  // X-Forwarded-* headers must never be believed.

  // 1. Security headers on every response (NFR-SEC-10)
  app.use(helmet());

  // 2. Templates with automatic escaping (NFR-SEC-03)
  nunjucks.configure(path.join(here, 'views'), {
    autoescape: true,
    express: app,
    noCache: config.isDev,
  });
  app.set('view engine', 'njk');

  // 3. Static files (CSS and the small shared script)
  app.use('/static', express.static(path.join(here, 'public')));

  // 4. Which portal is this request for? Unknown hosts are refused.
  app.use(resolvePortal);

  // 5. Form bodies: flat fields only, small size limit
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));

  // 6. Sessions. Host-only cookie (no Domain attribute), so app.localhost and
  //    staff.localhost each get their own (NFR-SEC-04).
  //    TODO Pair 1: replace the default memory store with a store over the ERD
  //    SESSION table that keeps only a hash of the session ID.
  app.use(
    session({
      name: 'sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: !config.isDev, // local development runs over plain HTTP
        maxAge: 30 * 60 * 1000, // TODO Pair 1: 30 min customers, 15 min staff (AD-04)
      },
    }),
  );

  // 7. CSRF: synchroniser token stored in the session, sent by forms as _csrf (NFR-SEC-08)
  const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => req.body?._csrf,
  });
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    res.locals.portal = req.portal;
    next();
  });
  app.use(csrfSynchronisedProtection);

  // 8. Routes. Every guard is applied BEFORE the router it protects is mounted.
  app.get('/', (req, res) => {
    res.render(req.portal === 'STAFF' ? 'staff-home.njk' : 'home.njk');
  });

  // As modules arrive, mount them like this, never before their guards:
  // app.use(requirePortal('APP'), requireRole('CUSTOMER'), vehiclesRouter);
  // app.use(requirePortal('STAFF'), requireStaff, operationsRouter);
  void requirePortal; // remove once the first router is mounted

  // 9. Not found, then errors (always last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
