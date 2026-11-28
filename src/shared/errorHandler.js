// Turns errors into pages. The one place that logs 403s as security events.
// Users only ever see W-47 (403), the 404 page or W-48 (everything else).
// Details go to the server log only (NFR-SEC-13).

const ACCESS_DENIED = 'ACCESS_DENIED'; // SECURITY_EVENT.event_type, ERD §7

const VIEWS = { 403: 'errors/403.njk', 404: 'errors/404.njk' };
const GENERIC_VIEW = 'errors/500.njk'; // W-48: generic message, no technical detail

/** Only 400–599 counts as an error status. Anything else becomes 500. */
function statusOf(err) {
  const s = err?.status ?? err?.statusCode;
  return Number.isInteger(s) && s >= 400 && s <= 599 ? s : 500;
}

/** Render an error page. If the template itself fails, send plain text, never a stack trace. */
function renderSafely(res, status, view) {
  res.status(status).render(view, {}, (renderErr, html) => {
    if (renderErr) {
      console.error('error page render failed', { view, err: renderErr.message });
      return res.type('text/plain').send('Something went wrong');
    }
    return res.send(html);
  });
}

export function notFound(req, res) {
  renderSafely(res, 404, VIEWS[404]);
}

/**
 * @param {{ securityLog: { record: (event: object) => Promise<unknown> } }} deps
 */
export function createErrorHandler({ securityLog }) {
  async function logForbidden(req) {
    try {
      await securityLog.record({
        eventType: ACCESS_DENIED,
        userId: req.user?.id ?? null,
        attemptedIdentifierHash: null,
        portal: req.portal ?? null,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? null,
        requestId: req.id ?? null,
      });
    } catch (logErr) {
      // A logging failure must never turn a 403 into a 500.
      console.error('securityLog failed', { requestId: req.id, err: logErr.message });
    }
  }

  // Four arguments, so Express treats this as the error handler.
  return async function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    const status = statusOf(err);

    if (status >= 500) {
      console.error({ requestId: req.id, err });
      return renderSafely(res, 500, GENERIC_VIEW);
    }

    // NFR-SEC-01: every 403 (including CSRF failures) gets a security event.
    if (status === 403) await logForbidden(req);

    return renderSafely(res, status, VIEWS[status] ?? GENERIC_VIEW);
  };
}