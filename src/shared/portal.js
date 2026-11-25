import { config } from '../config/index.js';

// Maps the exact Host header (including port) to a portal.
// The hosts come from configuration, never from the request itself.
const portalsByHost = new Map([
  [config.appBaseUrl.host, 'APP'],
  [config.staffBaseUrl.host, 'STAFF'],
]);

/** Sets req.portal to 'APP' or 'STAFF'. Requests for any other host are refused. */
export function resolvePortal(req, res, next) {
  const portal = portalsByHost.get(req.headers.host);
  if (!portal) {
    return res.status(400).type('text').send('Unknown host');
  }
  req.portal = portal;
  return next();
}

/** Only lets a request through on the named portal; elsewhere it looks like a missing page. */
export function requirePortal(portal) {
  return (req, res, next) => {
    if (req.portal !== portal) {
      return res.status(404).render('errors/404.njk');
    }
    return next();
  };
}
