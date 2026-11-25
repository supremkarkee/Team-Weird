# Contributing: conventions for the Vehicle Service Management app

These rules apply to **everyone and every tool**: code written by hand, by Claude, by Copilot, or by any other AI. If an AI tool is used, give it this file and the story IDs you are implementing.

## 0. Sources of truth

When two things disagree, the higher one wins:

1. **The spec doc**: Booking spec, Flowcharts, ERD, Application user stories, Wireframe checklist.
2. **This file.**
3. **The reference feature** (`docs/reference-feature-vehicles.md`) and existing code.

Never invent a field, table, rule, status, route or screen that the spec does not contain. If the spec is silent, **stop and ask in the team chat**, then add the finding to the Discovery log in the spec. Do not "fill the gap" in code.

## 1. Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js, current LTS, ES modules (`"type": "module"`) |
| Language | JavaScript (no TypeScript), with JSDoc on exported functions |
| Web framework | Express 5 (errors thrown in async routes reach the shared error handler automatically) |
| Pages | Server-rendered with **Nunjucks**, `autoescape: true` (proposed) |
| Database | PostgreSQL, accessed with `pg` and hand-written parameterised SQL (no ORM) |
| Migrations | `node-pg-migrate` (proposed) |
| Validation | `zod` (proposed) |
| Sessions | `express-session` with `connect-pg-simple` |
| Security middleware | `helmet` (headers), `csrf-sync` (synchroniser CSRF tokens, AD-11), `express-rate-limit` |
| Passwords | `argon2` (Argon2id, AD-11) |
| Email | `nodemailer`; a local mail catcher (e.g. Mailpit) in development |
| Tests | `node:test` or Jest, plus `supertest` for HTTP tests (pick one, proposed) |
| Style | ESLint + Prettier, enforced in CI |
| Payment gateway | The team's Node mock gateway, a separate process in `/gateway` |

Do not add a new dependency without a one-line justification in the PR description.

## 2. Repository layout

```
/src
  app.js                 Express setup and middleware order (one place only)
  server.js              Starts the HTTP server
  config/                Reads environment variables; no secrets in code
  shared/                Building blocks every module must use (see §4)
  modules/
    identity/            Pair 1: sign-in, sessions, email codes, reset, verification
    accounts/            Pair 1: profile, account deletion
    vehicles/            Pair 1: the reference feature
    staff/               Pair 1: staff admin, break-glass, log viewer
    bookings/            Pair 2: availability, holds, allocation, booking states
    payments/            Pair 2: transactions, invoices, gateway client, reconciliation
    garage/              Pair 3: settings, services, bays, closures, unavailability
    operations/          Pair 3: admin dashboards, search, schedule, admin actions
  views/
    layouts/             customer.njk, staff.njk, public.njk
    partials/            form fields, flash messages, tables, pagination, errors
    errors/              403, 404, session-expired, generic error
  public/                CSS and the small shared JS file
  jobs/                  Scheduled jobs (hold sweep, reconciliation)
/migrations              One folder for the whole app
/seeds                   Development data only
/tests                   Cross-module integration tests
/gateway                 Mock payment gateway (separate process)
/docs                    Reference feature and how-tos
```

Every module has the same internal layout:

```
modules/<name>/
  routes.js        URLs, role checks, CSRF, calling validate() and the service
  validation.js    zod schemas for every form and query string
  service.js       Business rules, ownership checks, transactions, audit calls
  repository.js    SQL only
  views/           Nunjucks templates for this module's screens
  tests/           One test file per story group
  index.js         The module's public functions for other modules
```

## 3. Layer rules

- **Route → validate → service → repository.** Each layer only calls the one below it.
- **Routes** never contain business rules or SQL.
- **Templates** never query the database and never make decisions beyond showing or hiding parts that the service already decided.
- **Services** own business rules (cite the BR in a comment), ownership checks and transactions.
- **Repositories** contain SQL only and return plain objects with camelCase keys.
- **Modules talk to each other only through `index.js`**, never by importing another module's repository or service file directly.
- **Booking and payment state changes happen only inside `bookings` and `payments`** (Pair 2). Other modules call their exported functions, such as `bookings.cancelAsAdmin(...)`.

## 4. Shared building blocks (`src/shared`)

Use these; never write your own version.

| File | What it gives you |
| --- | --- |
| `db.js` | The connection pool, `query()`, `withTransaction(fn)` |
| `auth.js` | `requireRole(...roles)`, `req.user` (id, role); `requireCustomer`, `requireStaff` |
| `csrf.js` | The CSRF middleware; `csrfToken` is available in every template |
| `validate.js` | `validate(schema, data)`: returns clean data or throws `ValidationError`; `optional()` turns empty form strings into `undefined` |
| `errors.js` | `ValidationError` (400), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409) |
| `errorHandler.js` | Renders error pages, logs 403s as security events, never shows stack traces |
| `audit.js` | `audit.record({...})` for AUDIT_EVENT (ERD §7) |
| `securityLog.js` | `securityLog.record({...})` for SECURITY_EVENT (ERD §7) |
| `flash.js` | One-time messages after a redirect |
| `rateLimit.js` | Pre-configured limiters with the AD-10 values |
| `mail.js` | Sends security emails (verification, codes, reset, activation) |
| `money.js` | Pence helpers and £ formatting; never use floats for money |

## 5. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| JS variables and functions | camelCase | `archiveVehicle` |
| Files | kebab-case or single word | `rate-limit.js`, `service.js` |
| Database tables and columns | snake_case, singular, matching the ERD | `vehicle`, `owner_id` |
| The users table | `app_user`, because `user` is a reserved word in PostgreSQL | |
| Enum values | UPPER_SNAKE, exactly as in the ERD | `REASSIGNMENT_REQUIRED` |
| URLs | lowercase, hyphens, UUIDs for IDs | `/bookings/:id/cancel` |
| Form fields | camelCase, same as the validation schema | `registrationNumber` |

## 6. Database

- **All changes go through migrations.** Never change the database by hand.
- **One migration owner** reviews every migration against the ERD. Put the ERD section in a comment at the top of the migration.
- **UUID primary keys** with `gen_random_uuid()`; **`timestamptz`** for every timestamp, stored in UTC; **integer pence** for money.
- **Parameterised queries only** (`$1, $2`). Never build SQL by joining strings, not even for `ORDER BY`: use an allowlist.
- **Transactions** through `withTransaction`. When locking, always follow BR-12's order: `calendar_day` rows by ascending date, then `bay` rows by ascending number.
- **Status changes are guarded**: `UPDATE ... WHERE id = $1 AND status = $2`. If no row changes, throw `ConflictError` (409).
- **Name constraints and indexes** so code can recognise them (e.g. `vehicle_owner_registration_active_uq`).

## 7. Security rules (every pull request)

These come from NFR-SEC-01 to NFR-SEC-16. A reviewer rejects any PR that breaks one.

1. **Every route declares who may use it** with `requireRole(...)`. Public routes are listed in `app.js`, nowhere else.
2. **Ownership is checked in the service**, using `req.user.id` from the session, never an ID from the form.
3. **Every input is validated** with a zod schema. Schemas list allowed fields only, so extra fields (like `role`) are dropped.
4. **No SQL built from strings.**
5. **Never mark user content as safe in templates** (`| safe` is only for our own static HTML).
6. **Every form has the CSRF token**: `<input type="hidden" name="_csrf" value="{{ csrfToken }}">`.
7. **Sign-in, registration and reset messages are generic.** Never reveal whether an email exists.
8. **Never log, render or return** passwords, session tokens, email codes or links, gateway tokens, card data or recovery codes.
9. **Secrets come from environment variables** (`.env` is in `.gitignore`; `.env.example` lists the names with no values).
10. **Errors show generic pages**; details go to the server log only.
11. **Rate-limited routes** use the limiters in `shared/rateLimit.js`.
12. **Money buttons** carry `data-disable-on-submit` so they cannot be double-clicked.

## 8. Pages and forms

- **Post/Redirect/Get**: a successful POST redirects and shows a flash message; a failed POST re-renders the form with the user's values and field errors.
- HTML forms use only GET and POST. Actions are POST routes such as `/vehicles/:id/archive`.
- Use the shared partials for fields, errors, flash messages and tables, so every screen looks the same.
- Each screen notes its wireframe number in a template comment: `{# W-08 My vehicles #}`.

## 9. Logging

- Call `audit.record` for every event ERD §7 lists (booking, allocation, payment, admin, config and staff changes), with the actor, the from and to states, and the reason.
- Call `securityLog.record` for sign-in outcomes, lockouts, code failures, password and email changes, revoked sessions and 403s.
- Do not add audit events that ERD §7 does not list.

## 10. Tests

- Every acceptance criterion becomes at least one test. **Every [Sec] criterion must have a test.**
- Name tests after the criterion: `US-VEH-02 AC3: another customer's vehicle returns 403`.
- Tests run against a separate test database that is reset before each run.

## 11. Git and pull requests

- Branch from `main`: `feature/US-BK-04-self-cancel`, `fix/BR-23-window-boundary`.
- Keep PRs small: one story, or a few related ones.
- The PR template asks for: stories and rules implemented, wireframes touched (W-xx), migrations (yes or no), tests added, and the statement **"I can explain every line of this change."**
- **At least one reviewer from another pair.** CI (lint, tests, `npm audit`, secret scan) must pass before merge.
- Never commit `.env`, real customer data or real card numbers.

## 12. Using AI tools

- Give the tool this file, the reference feature doc, and the exact story and rule IDs you are implementing.
- **The tool must not invent** fields, rules, statuses, routes or screens. If its output contains something not in the spec, remove it or raise it with the team.
- Never paste secrets, `.env` contents or real personal data into an AI tool.
- **If you cannot explain the code in review, it does not merge**, whoever or whatever wrote it.

## 13. Definition of done

A story is done when:

- [ ] All its acceptance criteria have passing tests, including every [Sec] one.
- [ ] It follows the layer, security and naming rules above.
- [ ] Its screens match the wireframe checklist, including the listed states.
- [ ] Audit and security events are recorded where ERD §7 requires them.
- [ ] A reviewer from another pair has approved it, and CI is green.