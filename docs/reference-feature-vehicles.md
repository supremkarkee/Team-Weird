# Reference feature: customer vehicles

This is the pattern every feature copies. It implements **US-VEH-01 to US-VEH-03** (Application user stories tab) against **ERD §2**, through every layer: migration → validation → repository → service → routes → templates → tests.

Build this first, inside the walking skeleton. When someone (or an AI tool) builds a new feature, point them here: "do it the way vehicles does it".

The code below shows the **shape** each file must have. It is a starting point to finish and test, not copy-paste-and-forget.

## Files

```
migrations/<timestamp>_vehicle.sql
src/modules/vehicles/
  validation.js
  repository.js
  service.js
  routes.js
  index.js
  views/list.njk        W-08 My vehicles
  views/form.njk        W-09 Add or edit vehicle
  tests/vehicles.test.js
```

## Routes

| Method | URL | Screen | Story |
| --- | --- | --- | --- |
| GET | `/vehicles` | W-08 list | US-VEH-02 |
| GET | `/vehicles/new` | W-09 empty form | US-VEH-01 |
| POST | `/vehicles` | Create, then redirect to `/vehicles` | US-VEH-01 |
| GET | `/vehicles/:id/edit` | W-09 filled form | US-VEH-02 |
| POST | `/vehicles/:id` | Update, then redirect | US-VEH-02 |
| POST | `/vehicles/:id/archive` | Archive (W-10 dialog posts here), then redirect | US-VEH-03 |

All routes: customers only, CSRF on every POST.

## 1. Migration (ERD §2)

```sql
-- ERD §2 Customers and vehicles
CREATE TABLE vehicle (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid NOT NULL REFERENCES customer_profile (user_id),
  registration_number text,
  make                text NOT NULL,
  model               text NOT NULL,
  manufacture_year    int  NOT NULL CHECK (manufacture_year BETWEEN 1900 AND 2100),
  fuel_type           text NOT NULL CHECK (fuel_type IN ('PETROL','DIESEL','HYBRID','ELECTRIC')),
  transmission        text CHECK (transmission IN ('MANUAL','AUTOMATIC')),
  last_known_mileage  int  CHECK (last_known_mileage >= 0),
  vin                 text CHECK (vin IS NULL OR length(vin) = 17),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  archived_at         timestamptz,
  -- Registration may only be empty once archived (it is cleared on account deletion, ERD §2)
  CONSTRAINT vehicle_registration_required_ck
    CHECK (registration_number IS NOT NULL OR archived_at IS NOT NULL),
  -- Needed by the booking's composite foreign key (ERD §4)
  CONSTRAINT vehicle_id_owner_uq UNIQUE (id, owner_id)
);

-- One active copy of a plate per customer; other customers may hold the same plate (D-07)
CREATE UNIQUE INDEX vehicle_owner_registration_active_uq
  ON vehicle (owner_id, registration_number)
  WHERE archived_at IS NULL;
```

Notes:

- The year check in the database is a wide safety net. The exact rule, "no later than next year", is checked in validation, because a database check should not depend on the current date.
- Tables are `snake_case` and singular, matching the ERD.

## 2. Validation (`validation.js`)

```js
import { z } from 'zod';
import { optional } from '../../shared/validate.js'; // turns '' from forms into undefined

const thisYear = new Date().getFullYear();

export const vehicleSchema = z.object({
  // Normalise before checking: "ab12 cde" and "AB12CDE" are the same plate (ERD §2)
  registrationNumber: z.string().trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ''))
    .pipe(z.string().regex(/^[A-Z0-9]{2,8}$/, 'Enter a valid UK registration')),
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  manufactureYear: z.coerce.number().int().min(1900).max(thisYear + 1),
  fuelType: z.enum(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC']),
  transmission: optional(z.enum(['MANUAL', 'AUTOMATIC'])),
  mileage: optional(z.coerce.number().int().min(0)),
  vin: optional(z.string().trim().toUpperCase().length(17)),
});
// Unknown fields (e.g. ownerId, _csrf) are dropped by zod's default behaviour:
// the schema is the allowlist (mass assignment, NFR-SEC-02).
```

The registration regex is deliberately simple. Tighten it as a team if needed, and update it here.

## 3. Repository (`repository.js`)

SQL only. Every function accepts an optional `db` so a service can run it inside a transaction.

```js
import { pool } from '../../shared/db.js';

const toVehicle = (r) => r && ({
  id: r.id, ownerId: r.owner_id, registrationNumber: r.registration_number,
  make: r.make, model: r.model, manufactureYear: r.manufacture_year,
  fuelType: r.fuel_type, transmission: r.transmission,
  mileage: r.last_known_mileage, vin: r.vin, archivedAt: r.archived_at,
});

export async function listActiveByOwner(ownerId, db = pool) {
  const { rows } = await db.query(
    `SELECT * FROM vehicle WHERE owner_id = $1 AND archived_at IS NULL
     ORDER BY created_at DESC`,
    [ownerId],
  );
  return rows.map(toVehicle);
}

export async function findByIdForUpdate(id, db) {
  const { rows } = await db.query(`SELECT * FROM vehicle WHERE id = $1 FOR UPDATE`, [id]);
  return toVehicle(rows[0]);
}

export async function insert(v, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO vehicle (owner_id, registration_number, make, model, manufacture_year,
                          fuel_type, transmission, last_known_mileage, vin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [v.ownerId, v.registrationNumber, v.make, v.model, v.manufactureYear,
     v.fuelType, v.transmission ?? null, v.mileage ?? null, v.vin ?? null],
  );
  return toVehicle(rows[0]);
}

export async function archive(id, db = pool) {
  await db.query(`UPDATE vehicle SET archived_at = now(), updated_at = now() WHERE id = $1`, [id]);
}
```

`findById` and `update` follow the same pattern.

## 4. Service (`service.js`)

Business rules, ownership and transactions live here. Note what is **not** here: no audit event, because ERD §7 does not list vehicle changes. Do not add events the spec does not ask for.

```js
import * as repo from './repository.js';
import { withTransaction } from '../../shared/db.js';
import { ForbiddenError, ConflictError, ValidationError, isUniqueViolation } from '../../shared/errors.js';
import * as bookings from '../bookings/index.js'; // other modules only through index.js

/** US-VEH-02 AC1: only my own, non-archived vehicles. */
export async function listMyVehicles(ownerId) {
  return repo.listActiveByOwner(ownerId);
}

/** US-VEH-01: the owner always comes from the session, never from the form (AC3). */
export async function addVehicle(ownerId, input) {
  try {
    return await repo.insert({ ...input, ownerId });
  } catch (err) {
    if (isUniqueViolation(err, 'vehicle_owner_registration_active_uq')) {
      throw new ValidationError({ registrationNumber: 'This vehicle is already on your account.' });
    }
    throw err;
  }
}

/**
 * US-VEH-02 AC3: another customer's vehicle, an archived one, or a missing one
 * all get the same 403, so the response never reveals which IDs exist.
 */
export async function getOwnedVehicle(ownerId, vehicleId, db) {
  const vehicle = db ? await repo.findByIdForUpdate(vehicleId, db) : await repo.findById(vehicleId);
  if (!vehicle || vehicle.ownerId !== ownerId || vehicle.archivedAt) throw new ForbiddenError();
  return vehicle;
}

/** US-VEH-03, BR-43: cannot archive a vehicle with an active booking. */
export async function archiveVehicle(ownerId, vehicleId) {
  await withTransaction(async (db) => {
    const vehicle = await getOwnedVehicle(ownerId, vehicleId, db); // locks the vehicle row
    if (await bookings.hasActiveBookingForVehicle(vehicle.id, db)) {
      throw new ConflictError('Cancel or complete this vehicle’s booking first.');
    }
    await repo.archive(vehicle.id, db);
  });
}
```

**Cross-pair agreement this creates:** archiving locks the vehicle row while it checks for bookings. Pair 2's booking creation must also check the vehicle under a lock (`SELECT ... FOR SHARE` on the vehicle, refusing archived ones), so a booking cannot be created at the same moment the vehicle is archived. Agree this with Pair 2 before merging.

## 5. Routes (`routes.js`)

Thin: who may call it, validate, call the service, redirect.

```js
import { Router } from 'express';
import { requireRole } from '../../shared/auth.js';
import { csrfProtection } from '../../shared/csrf.js';
import { validate } from '../../shared/validate.js';
import { setFlash } from '../../shared/flash.js';
import { ValidationError } from '../../shared/errors.js';
import { vehicleSchema } from './validation.js';
import * as service from './service.js';

export const router = Router();
router.use('/vehicles', requireRole('CUSTOMER'));

router.get('/vehicles', async (req, res) => {
  const vehicles = await service.listMyVehicles(req.user.id);
  res.render('vehicles/list.njk', { vehicles });
});

router.post('/vehicles', csrfProtection, async (req, res) => {
  try {
    const input = validate(vehicleSchema, req.body);
    await service.addVehicle(req.user.id, input);
    setFlash(req, 'success', 'Vehicle added.');
    res.redirect('/vehicles'); // Post/Redirect/Get
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).render('vehicles/form.njk', { values: req.body, errors: err.fields });
    }
    throw err; // the shared error handler deals with 403, 409 and anything unexpected
  }
});

router.post('/vehicles/:id/archive', csrfProtection, async (req, res) => {
  await service.archiveVehicle(req.user.id, req.params.id);
  setFlash(req, 'success', 'Vehicle removed.');
  res.redirect('/vehicles');
});
```

The validation-error handling above is repeated on every form, so it is a good candidate for a small shared helper once two or three features use it.

## 6. Templates

```njk
{# W-09 Add or edit vehicle #}
{% extends "layouts/customer.njk" %}
{% from "partials/form.njk" import textField, selectField %}

{% block content %}
<h1>{{ "Edit vehicle" if vehicle else "Add a vehicle" }}</h1>
<form method="post" action="{{ '/vehicles/' + vehicle.id if vehicle else '/vehicles' }}">
  <input type="hidden" name="_csrf" value="{{ csrfToken }}">
  {{ textField('registrationNumber', 'Registration', values, errors) }}
  {{ textField('make', 'Make', values, errors) }}
  {{ textField('model', 'Model', values, errors) }}
  {{ textField('manufactureYear', 'Year of manufacture', values, errors) }}
  {{ selectField('fuelType', 'Fuel type', ['PETROL','DIESEL','HYBRID','ELECTRIC'], values, errors) }}
  {{ selectField('transmission', 'Transmission (optional)', ['', 'MANUAL','AUTOMATIC'], values, errors) }}
  {{ textField('mileage', 'Mileage (optional)', values, errors) }}
  {{ textField('vin', 'VIN (optional)', values, errors) }}
  <button type="submit" data-disable-on-submit>Save vehicle</button>
</form>
{% endblock %}
```

Rules shown here: the shared field partials, the CSRF token, the wireframe number comment, and no `| safe` anywhere. Autoescaping makes a vehicle model like `<script>` show as text (NFR-SEC-03).

## 7. Tests

One test per acceptance criterion, named after it:

| Test | Checks |
| --- | --- |
| `US-VEH-01 AC1` | A valid vehicle appears in the list |
| `US-VEH-01 AC2` | "ab12 cde" after "AB12CDE" on the same account → error; on another account → allowed |
| `US-VEH-01 AC3 [Sec]` | Posting `ownerId` of another customer still creates the vehicle for me |
| `US-VEH-02 AC1` | The list shows only my non-archived vehicles |
| `US-VEH-02 AC3 [Sec]` | Another customer's vehicle ID → 403, and a security event is recorded |
| `US-VEH-03 AC1` | A vehicle with an active booking → 409 with the message |
| `US-VEH-03 AC2` | Archived vehicle disappears from the list |
| `US-VEH-03 AC3` | Re-adding the same plate after archiving succeeds |
| `NFR-SEC-08 [Sec]` | POST without the CSRF token → rejected |
| `NFR-SEC-03 [Sec]` | A model named `<script>` renders as text |

## Checklist for every new feature

- [ ] Migration reviewed against the ERD section it cites
- [ ] Schema lists every allowed field and nothing else
- [ ] Owner or role from the session, checked in the service
- [ ] Guarded status updates and BR-12 lock order where relevant
- [ ] Generic 403 for anything the user may not see
- [ ] Templates use partials, CSRF token and the wireframe number comment
- [ ] One test per acceptance criterion, every [Sec] one included