# CLAUDE.md

Vehicle Service Management: a server-rendered web app for one garage, built by a six-person university team for a Secure Software Development module. Customers book and pay for services; staff (technicians, garage admin, tech admin, break-glass super admin) run the garage.

## Read before writing code

1. `CONTRIBUTING.md`: the rules. They apply to AI-written code exactly as to people.
2. `docs/reference-feature-vehicles.md`: the pattern every feature copies.
3. `docs/spec/`: the specification, exported from the team's spec doc. It is the source of truth.
   - `booking-spec.md`: business rules (BR), configuration (CFG), states and transitions (TR), booking stories (US-BK), misuse stories (MS-BK), business policies (BP)
   - `flowcharts.md`: booking flows (F/C-x)
   - `erd.md`: the data model, ERD §1 to §7
   - `application-user-stories.md`: all other stories (US-PUB, US-AUTH, US-ACC, US-VEH, US-STF, US-GAD, US-SA), security requirements (NFR-SEC) and misuse stories (MS-APP)
   - `wireframe-checklist.md`: screens W-01 to W-48
   - Any other files within spec added by other team members

Every task names its story and rule IDs. Implement exactly those. If the spec does not cover something, **stop and say so**; do not invent fields, tables, statuses, rules, routes or screens.

## Stack

Node.js (ES modules, JavaScript), Express 5, Nunjucks (autoescape on), PostgreSQL via `pg` with hand-written parameterised SQL, `node-pg-migrate`, `zod`, `express-session`, `helmet`, `csrf-sync`, `express-rate-limit`, `argon2`, `nodemailer`. No ORM, no frontend framework.

## Commands

Everything runs in Docker. From the repository root:

| Task | Command |
| --- | --- |
| Start the stack | `docker compose up --build` |
| Run tests | `docker compose run --rm app npm test` |
| Lint | `docker compose run --rm app npm run lint` |
| Create a migration | `docker compose run --rm app npm run migrate:create -- <name>` |
| Run migrations | `docker compose run --rm app npm run migrate` |
| Seed data | `docker compose run --rm app npm run seed` |

Customer portal: http://app.localhost:3000. Staff portal: http://staff.localhost:3000. Emails: http://localhost:8025.

## Where code goes

- One module per area in `src/modules/<name>/`: `routes.js`, `validation.js`, `service.js`, `repository.js`, `index.js`, `views/`, `tests/`.
- Route → validate → service → repository. Business rules and ownership checks live in services; SQL lives only in repositories.
- Modules use each other only through `index.js`. Booking and payment status changes happen only inside `bookings` and `payments`.
- Reuse `src/shared/` (db and transactions, auth, CSRF, validation, errors, audit and security logs, flash, rate limits, mail, money). Never write a second version of any of them.
- Migrations live only in `/migrations`; cite the ERD section at the top of each one.

## Security rules you must never break

- Every route declares its portal and role guard, mounted **before** the router it protects.
- Owner and role come from `req.user` (the session), never from the request body, URL or hidden fields.
- Validate every input with a zod schema that lists allowed fields only.
- Parameterised SQL only. Never put request text into SQL, including `ORDER BY`.
- Never mark user content as safe in templates; never compile user data as a template.
- Every form includes `<input type="hidden" name="_csrf" value="{{ csrfToken }}">`; state changes only on POST.
- Prices, amounts and identities are always computed or looked up on the server.
- Never log, render or return passwords, session IDs, emailed codes or links, gateway tokens, card data or recovery codes.
- Build links and outgoing URLs from configuration, never from request headers. Do not enable `trust proxy`.
- Secrets come from environment variables only.

## Definition of done

Every acceptance criterion of the story has a test named after it (for example `US-VEH-02 AC3: ...`), every [Sec] criterion included; `npm test` and `npm run lint` pass; screens carry their wireframe number in a template comment (`{# W-08 My vehicles #}`).

## Never

- Commit `.env`, real personal data or real card numbers.
- Paste secrets or `.env` contents into a prompt or a file.
- Add a dependency without saying why in the pull request.
- Disable a security control "for now" or to make a test pass.