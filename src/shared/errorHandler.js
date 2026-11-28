// Proposed value. Confirm once T-10 fixes the SECURITY_EVENT enum.
const ACCESS_DENIED = 'ACCESS_DENIED';

const VIEWS = { 403: 'errors/403.njk', 404: 'errors/404.njk' };
const GENERIC_VIEW = 'errors/500.njk'; // W-48: generic message, no technical detail

function statusOf(err) {
  const s = err?.status ?? err?.statusCode;
  return Number.isInteger(s) && s >= 400 && s <= 599 ? s : 500;
}

function renderSafely(res, status, view) {
  res.status(status).render(view, {}, (renderErr, html) => {
    if (renderErr) {
      console.error('error page render failed', { view, err: renderErr.message });
      return res.type('text/plain').send('Something went wrong');
    }
    res.send(html);
  });
}

export function notFound(req, res) {
  renderSafely(res, 404, VIEWS[404]);
}

export function createErrorHandler({ securityLog }) {
  async function logForbidden(req) {
    try {
      await securityLog.record({
        eventType: ACCESS_DENIED,
        userId: req.session?.userId ?? null,
        attemptedIdentifierHash: null,
        portal: req.portal ?? null,
        ip: req.ip,
        userAgent: req.get('user-agent') ?? null,
        requestId: req.id ?? null,
      });
    } catch (logErr) {
      console.error('securityLog failed', { requestId: req.id, err: logErr.message });
    }
  }

  // Four arguments, so Express treats this as the error handler.
  return async function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    const status = statusOf(err);
    if (status >= 500) {
      console.error({ requestId: req.id, err }); // server log only (NFR-SEC-13)
      return renderSafely(res, 500, GENERIC_VIEW);
    }
    if (status === 403) await logForbidden(req); // NFR-SEC-01: 403 + security event

    renderSafely(res, status, VIEWS[status] ?? GENERIC_VIEW);
  };
}