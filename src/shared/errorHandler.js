// Minimal version for the skeleton. Pair 2 extends it in Sprint 0
// (ValidationError, ConflictError, logging 403s as security events).

export function notFound(req, res) {
  res.status(404).render('errors/404.njk');
}

// Express recognises an error handler by its four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error(err); // details go to the server log only (NFR-SEC-13)
  }

  if (status === 403) {
    return res.status(403).render('errors/403.njk');
  }
  if (status === 404) {
    return res.status(404).render('errors/404.njk');
  }
  return res.status(status >= 500 ? 500 : status).render('errors/500.njk');
}
