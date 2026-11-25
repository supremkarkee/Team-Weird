# Booking Ecosystem — Requirements Specification v0.2

Nov 14, 2026 · @tejas

## How this spec is organised

Every booking fact lives in exactly one place; everything else points to it by ID. This replaces the current draft, where the same rule appears in the features list, the stories and the flowcharts in slightly different words.

| Layer | ID | Holds | Never holds |
| --- | --- | --- | --- |
| Configuration | CFG-xx | Numbers the garage can change (hours, bays, hold time, percentages) | Logic |
| Business rules | BR-xx | One testable rule each, citing CFG values | User goals, UI wording |
| State model | ST-xx / TR-xx | Booking and payment states and the allowed transitions | Rules restated in full |
| User stories | US-BK-xx | One role, one goal, one value | Numbers, states, edge cases |
| Acceptance criteria | AC under each story | Given/When/Then that cite BR and TR IDs | New rules (add a BR first) |
| Misuse stories | MS-BK-xx | Attacker goal, mitigation, test | — |
| Flowcharts | F/C-x | The order rules run in; each decision diamond labelled with its BR ID | Rules not in the catalogue |
| Edge cases | EC-xx | Problems found, resolution, where it now lives | — |

**Traceability rule:** every flowchart diamond cites a BR; every BR appears in at least one AC and one flowchart; every AC is testable. If a diamond has no BR, the rule is missing from the catalogue.

**When you find a new edge case:** log it as an EC row in the Discovery log, decide its home (BR, AC, TR, MS or deferred), update that one place, then carry on drawing.

Compliance and legal references are deliberately left out of this version.

## Configuration (CFG)

All numbers live here once; rules and flowcharts cite the CFG ID, never the number. All values are confirmed by the team.

| ID | Parameter | Value | Note |
| --- | --- | --- | --- |
| CFG-01 | Garage time zone | Europe/London | All dates and "today" are evaluated in this zone; timestamps stored in UTC |
| CFG-02 | Operating days | Mon–Fri |  |
| CFG-03 | Closure dates | List (bank holidays, shutdowns) | Maintained by the garage admin; stored on CALENDAR\_DAY |
| CFG-04 | Opening time | 09:00 |  |
| CFG-05 | Hard end time | 17:00 | Grace window dropped (D-08): the latest possible end with on-the-hour starts |
| CFG-06 | Slot start granularity | 60 min, on the hour |  |
| CFG-07 | Booking horizon | Tomorrow to today + 60 days, inclusive |  |
| CFG-08 | Physical bays | 4 | Number of active bays in the BAY table |
| CFG-09 | Checkout hold (server) | 5 min 30 s |  |
| CFG-10 | Checkout timer (UI) | 5 min 00 s |  |
| CFG-11 | Deposit | 10% of booking price |  |
| CFG-12 | Self-cancel window | 2 h after confirmation | Starts when the booking becomes CONFIRMED, after the deposit (EC-07) |
| CFG-13 | Max active bookings per customer | 2 | See MS-BK-03; not applied to garage admin accounts |
| CFG-14 | Max checkout holds per customer | 1 | Customers and garage admins alike; see MS-BK-02 |
| CFG-15 | No-show grace | 30 min after start | See EC-04 |
| CFG-16 | Reconciliation threshold | 10 min | How long a payment may stay PENDING before F/C-8 checks it with the gateway |

Service types carry their own `price` and `duration_minutes` (60, 120 or 180). Both are copied onto the booking when it is created (BR-30).

## Business rules (BR)

46 rules cover the booking ecosystem (two since retired): 20 come from your draft (some tightened), 26 are new or changed by the review and team decisions. Origin: **Draft** = already in your docs, **New** / **Changed** = from the review (EC ID given).

### Scheduling and availability

| ID | Rule | Origin |
| --- | --- | --- |
| BR-01 | A booking date is an operating day (CFG-02), not a closure date (CFG-03), and inside the horizon (CFG-07), all evaluated in CFG-01. | Draft + New (EC-02, EC-03) |
| BR-02 | Start time is on the hour (CFG-06), at or after CFG-04, and start + duration is at or before CFG-05. | Draft |
| BR-03 | Intervals are half-open \[start, end). Two intervals conflict if and only if A.start < B.end and A.end > B.start. | Draft |
| BR-04 | A booking is *active* if it is CONFIRMED, REASSIGNMENT\_REQUIRED, or PENDING\_PAYMENT with expires\_at > now. Only active bookings hold a bay or a technician. | Draft |
| BR-05 | A slot is available if at least one bay and at least one technician are free for the whole interval. | Draft |
| BR-06 | A technician is free if their account is active with role TECHNICIAN, they have no conflicting active booking, and no unavailability window overlaps. | Draft |
| BR-07 | A vehicle cannot have two conflicting active bookings. | New (EC-11) |
| BR-08 | A customer may hold at most CFG-14 checkout holds and CFG-13 active bookings at once. Garage admin accounts (BR-46) keep the hold limit but have no active-booking cap. | New (MS-BK-02, MS-BK-03) |
| BR-09 | The availability response contains only dates and start times: no bay numbers, technician IDs or other customers' data. | Draft |

### Allocation

| ID | Rule | Origin |
| --- | --- | --- |
| BR-10 | Bay = the lowest-numbered free bay. | Draft |
| BR-11 | Technician = the free technician with the least workload on that date; ties broken at random through an injectable random source (seeded in tests). Workload measure: see D-01. | Draft + Changed (EC-12) |
| BR-12 | Availability re-check, allocation and insert run in one transaction that serialises all bookings for the same date. Lock order: the date's calendar\_day row first, then the chosen bay's row; retiring a bay or closing a day takes the same locks. When several rows are locked, calendar\_day rows go in ascending date order, then bay rows in ascending bay number. | Changed (EC-10) |
| BR-13 | Price, duration and deposit are computed on the server from service\_id. Any price sent by the client is ignored. | New (MS-BK-04) |

### Checkout and payment

| ID | Rule | Origin |
| --- | --- | --- |
| BR-14 | Starting checkout creates a PENDING\_PAYMENT booking with expires\_at = now + CFG-09. | Draft |
| BR-15 | The server checks that the hold is still valid before it asks the gateway to charge. | New (EC-08) |
| BR-16 | If a deposit succeeds after expires\_at: confirm the booking if a bay and a technician are still free (re-allocating if needed); otherwise refund the deposit in full and mark the booking EXPIRED. | New (EC-08) |
| BR-17 | Every gateway call carries an idempotency key = booking ID + transaction type. An accidentally duplicated call (double-click, network resend) never charges or refunds twice, and the key lets F/C-8 look up an unknown outcome. Failed calls are never retried. | New (EC-09) |
| BR-18 | No gateway call is made inside an open database transaction. Record a PENDING transaction, call the gateway, then commit the outcome in a new transaction. | Changed (EC-09) |
| BR-19 | Deposit = price × CFG-11, rounded half-up to the penny; balance = price − deposit, so the two always sum to the price. | New (EC-16) |
| BR-20 | Holds past expires\_at stop blocking at once (BR-04); a scheduled sweep sets their status to EXPIRED. | New (EC-08) |
| BR-21 | A customer can abandon checkout; the hold becomes EXPIRED immediately. | New (EC-08) |
| BR-22 | Raw card details never reach the application; only the gateway token and transaction references are stored. | Draft |

### Cancellation and refunds

| ID | Rule | Origin |
| --- | --- | --- |
| BR-23 | A customer may self-cancel a CONFIRMED or REASSIGNMENT\_REQUIRED booking within CFG-12 of confirmed\_at; the full deposit is refunded. | Changed (EC-07) |
| BR-24 | Retired: merged into BR-23. Flagged bookings follow the same window; after it, only a garage admin can cancel them (D-03). | New (EC-13), see D-03 |
| BR-25 | After the window, a customer cannot self-cancel; they contact the garage outside the system (BP-07), and the garage admin decides and cancels if appropriate (BR-26). | Draft + Changed (EC-05) |
| BR-26 | A garage admin may cancel a CONFIRMED or REASSIGNMENT\_REQUIRED booking at any time, with no cancellation window, and a refund of 0–100% of the deposit and a mandatory reason. | Draft |
| BR-27 | Goodwill refunds apply to COMPLETED, NO\_SHOW and UNRESOLVED bookings, need a reason, and never change the booking's status. Total refunds never exceed the amount collected through the gateway and go only to the original payment token; a refund larger than one charge is split into one refund per charge, balance first, then deposit; money collected outside the gateway is refunded outside it and only recorded. | New (EC-15) |
| BR-28 | Booking status and money movement are separate. A cancellation frees the slot immediately; its refund proceeds independently, and a failed refund goes to the admin queue. | New (EC-09) |
| BR-29 | Bookings, transactions and invoices are never hard-deleted. | Draft |

### Change safety

| ID | Rule | Origin |
| --- | --- | --- |
| BR-30 | Service name, price, duration and vehicle registration are copied onto the booking when it is created. Later edits do not change existing bookings. | New (EC-17) |
| BR-31 | Removing a bay, adding a closure date or shortening opening hours is refused while any active booking uses that bay, day or time. The garage sorts those bookings out with the customers first (D-04). | New (EC-18) |

### Technician unavailability and staff changes

| ID | Rule | Origin |
| --- | --- | --- |
| BR-32 | An unavailability window needs start < end and end > now. CONFIRMED bookings that conflict with it become REASSIGNMENT\_REQUIRED; checkout holds are not flagged but are re-checked at confirmation. | Draft + Changed (EC-06) |
| BR-33 | Before flagging, the system tries to move each affected booking to another free technician for the same window, keeping its bay (BR-11). It flags only when none is free. | New, see D-02 |
| BR-34 | Disabling or changing the role of a technician applies BR-32 to all their future bookings. | New (EC-14) |
| BR-35 | A replacement technician must be free (BR-06). A reschedule re-checks BR-01, BR-02, BR-05 and BR-07, excluding the booking itself. | Draft + Changed (EC-19) |
| BR-36 | REASSIGNMENT\_REQUIRED bookings stay at the top of the admin queue, soonest start first. The garage admin resolves them before the start time by reassigning, rescheduling (moving other bookings if needed, BR-47) or cancelling. If the start time passes first, the system sets UNRESOLVED (TR-11); any refund is then a goodwill refund (BR-27). | New (EC-20) |
| BR-47 | A garage admin may reassign or reschedule a CONFIRMED booking, for example to make room for a flagged one. It passes the same checks as BR-35 and stays CONFIRMED; the customer is contacted outside the system. | New (D-09) |

### Completion and no-shows

| ID | Rule | Origin |
| --- | --- | --- |
| BR-37 | Only the assigned technician may complete a booking, only from CONFIRMED, and only at or after its scheduled start. | Draft + Changed (EC-21) |
| BR-38 | On completion the service record is saved first, then the balance is charged. A failed charge leaves the balance OUTSTANDING for manual settlement. | Draft |
| BR-39 | Manual settlement requires an external reference and records the staff member who entered it. | Draft |
| BR-40 | A garage admin may mark a CONFIRMED booking NO\_SHOW after start + CFG-15. The deposit is kept unless refunded as goodwill (BR-27), and no balance is charged. | New (EC-04) |

### Accounts, vehicles and audit

| ID | Rule | Origin |
| --- | --- | --- |
| BR-41 | A customer cannot delete their account while they have active bookings or an outstanding balance. | New (EC-22) |
| BR-42 | Retired: an outstanding balance does not block new bookings; the garage collects it outside the system (D-05). | New (EC-22), see D-05 |
| BR-43 | A vehicle with an active booking cannot be deleted. | New (EC-11) |
| BR-44 | Every booking, allocation and payment transition is audit-logged: actor, time, from-state, to-state, reason. | Draft |
| BR-45 | Every "now" comparison uses the database clock. | New (EC-02) |
| BR-46 | A garage admin may book for a customer through the same booking flow, under their own staff login (there is no shared garage account); the booking records the admin as its creator and has no customer or vehicle attached. Every scheduling and allocation rule applies, with no overrides. A note naming the customer and vehicle registration is mandatory and replaces the vehicle checks (SEC1 ownership, BR-07). The deposit is paid from the garage's backup payment method; the customer pays at the counter outside the system and does not see the booking. | New (D-10) |
| BR-48 | Checkout requires a billing address for every customer booking, whatever the price. It is saved to the customer's profile for next time and copied onto each invoice. | New (team decision) |

## State model

A booking has nine states and eleven allowed transitions; anything else is refused. Money is tracked separately, so a payment problem never changes where the booking is in its lifecycle.

&#91;embedded content: booking lifecycle · 8 states, 10 transitions\]

Every transition is a conditional update on the expected from-state (`UPDATE … WHERE id = ? AND status = 'CONFIRMED'`). If zero rows change, someone else got there first: return 409 Conflict and log it. This one rule settles races such as a customer cancelling while the technician completes, or two admins acting on the same booking.

### Booking transitions

| ID | From | To | Trigger and actor | Rules |
| --- | --- | --- | --- | --- |
| TR-01 | (none) | PENDING\_PAYMENT | Customer starts checkout | BR-01 to BR-08, BR-12 to BR-14 |
| TR-02 | PENDING\_PAYMENT | CONFIRMED | Deposit succeeds | BR-15 to BR-17, BR-19 |
| TR-03 | PENDING\_PAYMENT | EXPIRED | Hold lapses, payment fails, checkout abandoned, or late payment with no free slot (deposit refunded) | BR-16, BR-20, BR-21 |
| TR-04 | CONFIRMED | REASSIGNMENT\_REQUIRED | Technician unavailable, disabled or re-roled with no automatic move | BR-31 to BR-34 |
| TR-05 | REASSIGNMENT\_REQUIRED | CONFIRMED | Garage admin reassigns or reschedules | BR-35 |
| TR-06 | CONFIRMED | COMPLETED | Assigned technician | BR-37, BR-38 |
| TR-07 | CONFIRMED | NO\_SHOW | Garage admin, after the grace period | BR-40 |
| TR-08 | CONFIRMED | CUSTOMER\_CANCELLED | Customer, inside the window | BR-23 |
| TR-09 | REASSIGNMENT\_REQUIRED | CUSTOMER\_CANCELLED | Customer, inside the window | BR-23 |
| TR-10 | CONFIRMED or REASSIGNMENT\_REQUIRED | CANCELLED\_ADMIN | Garage admin | BR-26 |
| TR-11 | REASSIGNMENT\_REQUIRED | UNRESOLVED | System, when the start time passes without a fix | BR-36 |

### Money: a separate lifecycle

Your draft has `COMPLETED_PAYMENT_FAILED`, which mixes two questions in one field: *is the work done?* and *is it paid?* Splitting them removes that state and stops every future payment edge case from creating another booking state (D-06).

| Record | Field | Values |
| --- | --- | --- |
| Booking | balance\_status | DEPOSIT\_PAID → SETTLED, or DEPOSIT\_PAID → OUTSTANDING → SETTLED |
| Transaction | type | DEPOSIT, BALANCE, MANUAL\_SETTLEMENT, DEPOSIT\_REFUND, SERVICE\_REFUND |
| Transaction | status | PENDING → SUCCEEDED, or PENDING → FAILED |
| Transaction | idempotency\_key | booking ID + type (+ sequence for repeat refunds) |

A failed refund is a FAILED transaction in the admin queue, not a booking state. Every transaction produces an invoice or credit note when it succeeds.

## User stories

Your C5 and C6 each carried a whole workflow; they are now seven single-goal stories (US-BK-01 to US-BK-07). Stories hold no numbers or states: the criteria cite rules (BR) and transitions (TR) instead. **\[Sec\]** marks a security criterion. "From" maps each story to your draft IDs.

### Customer

**US-BK-01 · See available slots** (from C5) As a customer, I want to see which dates and start times are free for my chosen service, so that I only pick a slot the garage can deliver.

1. *Given* I have chosen a vehicle and a service, *when* the calendar loads, *then* dates that fail BR-01 or have no slot under BR-02 and BR-05 are greyed out.
2. *Given* I change the service, *when* the change applies, *then* my chosen date and time are cleared.
3. **\[Sec\]** *Given* any availability request, *when* the response is returned, *then* it holds only dates and start times (BR-09).

**US-BK-02 · Hold my slot while I pay** (from C5) As a customer, I want my chosen slot held during checkout, so that nobody else takes it while I enter my card.

1. *Given* a free slot, *when* I start checkout, *then* a hold is created (TR-01) and I see a countdown (CFG-10).
2. *Given* another customer takes the slot first, *when* I submit, *then* I see "slot just taken" and a refreshed list (BR-12).
3. *Given* I leave checkout, *when* I press Cancel or Back, *then* the hold is released at once (BR-21).
4. **\[Sec\]** *Given* I already hold a slot, or my vehicle has a conflicting booking, *when* I start another checkout, *then* it is refused (BR-07, BR-08).

**US-BK-03 · Pay the deposit** (from C5) As a customer, I want to pay the deposit securely, so that my booking is confirmed.

1. *Given* a valid hold, *when* payment succeeds, *then* the booking is CONFIRMED (TR-02) and I receive a deposit invoice.
2. *Given* payment fails or the hold lapses, *when* checkout ends, *then* I see why and the slot is released (TR-03).
3. *Given* my payment succeeds after the hold lapsed, *when* it is processed, *then* I am confirmed if a slot is still free, otherwise fully refunded (BR-16).
4. **\[Sec\]** *Given* I alter the price in the request, *when* it is submitted, *then* the server uses its own price (BR-13).
5. **\[Sec\]** *Given* I double-click Pay or my connection retries, *when* the requests arrive, *then* I am charged once (BR-17).

**US-BK-04 · Cancel soon after booking** (from C6) As a customer, I want to cancel shortly after booking and get my deposit back, so that a mistake costs me nothing.

1. *Given* a CONFIRMED or REASSIGNMENT\_REQUIRED booking inside the window (BR-23), *when* I cancel, *then* it becomes CUSTOMER\_CANCELLED (TR-08 or TR-09) and a refund starts.
2. *Given* the window has passed, *when* I view the booking, *then* Cancel is replaced by the garage's contact details (BR-25).
3. **\[Sec\]** *Given* a booking that is not mine, *when* I send a cancel request for its ID, *then* I get 403 and the attempt is logged.

**US-BK-05 · Cancel when the garage cannot serve me** (new) As a customer, I want to cancel a booking the garage can no longer staff, so that I am not stuck waiting for a fix.

1. *Given* my booking is REASSIGNMENT\_REQUIRED, *when* I view it, *then* I see that the garage is rearranging it. Inside the window I can cancel with a full refund (BR-23, TR-09); after it I contact the garage (BR-25).

**US-BK-06 · Request a late cancellation (deferred with support)** (from C6, C9) As a customer, I want to ask the garage to cancel after the window, so that I can explain my circumstances.

1. *Given* the window has passed, *when* I submit a request, *then* a support request linked to the booking is created and the booking is unchanged until a garage admin decides (BR-25).

**US-BK-07 · Track my bookings** (from C7) As a customer, I want to search and filter my bookings, so that I can see what is upcoming, done or cancelled.

1. *Given* I filter by status or date, *when* results load, *then* I see only my own bookings.
2. **\[Sec\]** *Given* I change a booking ID in the URL, *when* the request is sent, *then* I get 403 (SEC1).

**US-BK-08 · See service history and invoices** (from C8) As a customer, I want to view past services and invoices, so that I can keep track of maintenance and payments.

1. *Given* a completed booking, *when* I open it, *then* I see the work notes, the services snapshot (BR-30) and every invoice and credit note.

### Technician

**US-BK-09 · See my jobs** (from T1, T2) As a technician, I want to see my assigned jobs with vehicle and service details, so that I know what to work on.

1. *Given* jobs are assigned to me, *when* I open my list, *then* I see only those jobs, filterable by date and status.
2. **\[Sec\]** *Given* a job is reassigned away from me, *when* I next load it, *then* I get 403.
3. **\[Sec\]** *Given* I view a job, *when* it renders, *then* it shows no payment data and only the customer details needed for the job.

**US-BK-10 · Complete a job** (from T3) As a technician, I want to mark a job complete with work notes, so that the vehicle's history is updated and the balance is collected.

1. *Given* my CONFIRMED job has started (BR-37), *when* I submit notes and complete it, *then* it becomes COMPLETED (TR-06) and the balance charge starts (BR-38).
2. *Given* the balance charge fails, *when* completion finishes, *then* the job stays COMPLETED and the balance shows OUTSTANDING.
3. **\[Sec\]** *Given* a job that is not mine or has not started, *when* I try to complete it, *then* I get 403 or 409.

### Garage admin

**US-BK-11 · Mark a technician unavailable** (from GA1) As a garage admin, I want to block out a technician's time, so that no bookings are given to someone who is absent.

1. *Given* a valid window (BR-32), *when* I save it, *then* the technician is excluded from new allocations in that window.
2. *Given* the technician has CONFIRMED bookings in the window, *when* I save, *then* each is moved to a free technician or flagged REASSIGNMENT\_REQUIRED (BR-33, TR-04), and I see the result.

**US-BK-12 · Resolve a flagged booking** (from GA2) As a garage admin, I want to reassign or reschedule a flagged booking, so that the customer is still served.

1. *Given* a REASSIGNMENT\_REQUIRED booking, *when* I pick a free technician or a new time that passes BR-35, *then* it returns to CONFIRMED (TR-05).
2. *Given* flagged bookings exist, *when* I open my dashboard, *then* they appear first, soonest start first (BR-36). I can also move other CONFIRMED bookings to make room (BR-47); a flagged booking not resolved by its start time becomes UNRESOLVED (TR-11).

**US-BK-13 · Cancel a booking for the garage** (from GA3) As a garage admin, I want to cancel a booking with a refund I choose, so that I can handle emergencies and late requests fairly.

1. *Given* a CONFIRMED or REASSIGNMENT\_REQUIRED booking, *when* I enter a reason and a refund of 0–100%, *then* it becomes CANCELLED\_ADMIN (TR-10) and any refund proceeds separately (BR-28).

**US-BK-14 · Goodwill refund after completion or a no-show** (new, from F/C-2.3) As a garage admin, I want to refund part or all of what a customer paid for a completed or no-show booking, so that I can put right a poor job or show goodwill.

1. *Given* a COMPLETED or NO\_SHOW booking, *when* I issue a refund, *then* it is refused if total refunds would exceed what the gateway collected (BR-27).

**US-BK-15 · Settle an outstanding balance** (from F/C-4.1) As a garage admin, I want to record a balance paid outside the system, so that the booking is fully settled.

1. *Given* balance OUTSTANDING, *when* I enter an external reference, *then* balance\_status becomes SETTLED and my staff ID is recorded (BR-39).

**US-BK-16 · Record a no-show** (new) As a garage admin, I want to mark a booking as a no-show, so that it is closed without charging the balance.

1. *Given* a CONFIRMED booking past start + CFG-15, *when* I mark it, *then* it becomes NO\_SHOW (TR-07), the deposit is kept and no balance is charged (BR-40).

**US-BK-17 · Manage capacity and services** (from GA1) As a garage admin, I want to change bays, closure dates and service types, so that bookings match what the workshop can do.

1. *Given* a change that would break an active booking, *when* I save, *then* it follows BR-31.
2. *Given* I change a service's price or duration, *when* I save, *then* existing bookings keep their snapshot (BR-30).

### Tech admin

**US-BK-18 · Disable a technician safely** (from TA1) As a tech admin, I want disabling a technician to protect their future bookings, so that customers are not left without a mechanic.

1. *Given* a technician with future bookings, *when* I disable or re-role them, *then* BR-34 runs and the garage admin is alerted.

### Garage admin, booking for a customer

**US-BK-19 · Book on a customer's behalf** (new, D-10) As a garage admin, I want to book a slot for a customer who calls or walks in, so that they can be served without using the app.

1. *Given* I use the normal booking flow under my own staff login, *when* I submit, *then* every scheduling and allocation rule applies with no override (BR-46).
2. *Given* I leave the customer note empty, *when* I submit, *then* the booking is refused.
3. *Given* I already have an open checkout hold, *when* I start another, *then* it is refused; there is no cap on my active bookings (BR-08).
4. **\[Sec\]** *Given* an admin booking is created, *when* it is saved, *then* the audit log records the admin, the note and the deposit payment.

## Misuse stories

Twelve attacker goals threaten the booking ecosystem; four of them (MS-BK-02, 03, 08, 11) abuse business rules rather than code bugs, and those are the ones most teams miss. Each is written as "As an attacker, I want … so that …" in short form.

| ID | Attacker wants to… | Threatens | Mitigation | Test |
| --- | --- | --- | --- | --- |
| MS-BK-01 | View or cancel another customer's booking by changing its ID | US-BK-04, 07 | Ownership check on every request (SEC1); non-sequential IDs | Customer A requests B's booking → 403 + log entry |
| MS-BK-02 | Block a day's slots by opening many checkouts and never paying | US-BK-02 | BR-08 (one hold per customer); rate-limit checkout starts | Second concurrent hold → refused |
| MS-BK-03 | Deny slots to real customers by booking many and cancelling inside the free window | US-BK-04 | BR-08 active-booking cap; alert on repeated free cancellations | Third active booking → refused |
| MS-BK-04 | Pay less by editing the price or deposit in the request | US-BK-03 | BR-13 server-side pricing | Tampered price → server price charged |
| MS-BK-05 | Get two refunds by replaying the cancel request | US-BK-04, 13 | BR-17 idempotency keys; state guard on every transition | Two parallel cancels → one refund, one 409 |
| MS-BK-06 | Test stolen cards through checkout | US-BK-03 | Rate-limit payment attempts per account and IP; lock after repeated failures | Sixth failed attempt in 10 min → blocked |
| MS-BK-07 | Trigger a customer's balance charge by completing a job that is not theirs, or before it starts | US-BK-10 | BR-37 | Other technician's job → 403; future job → 409 |
| MS-BK-08 | (Insider) mark a balance settled without collecting it, or refund money to an accomplice | US-BK-14, 15 | Refunds only to the original payment token; BR-27 cap; BR-39 + BR-44 audit reviewed by tech admin (TA4) | Refund to a new card → impossible by design |
| MS-BK-09 | Call a garage-admin endpoint (refund %, reassign) as a customer or technician | US-BK-12, 13 | Role check on the server for every admin action | Customer token on admin route → 403 |
| MS-BK-10 | Add someone else's registration to block them from booking their own car | US-BK-02 | Depends on D-07 | Per D-07 |
| MS-BK-11 | Overload the server through the availability endpoint, which loops over 60 days | US-BK-01 | Rate limit per user; short-lived cache per service | Burst of 100 requests → 429 |
| MS-BK-12 | (Insider) block slots for friends, or hide real capacity, with fake admin bookings | US-BK-19 | Mandatory customer note; deposit really paid from the garage account; one open hold at a time; admin bookings reviewed in the audit log by the tech admin (TA4) | Admin booking without a note → 400; every admin booking appears in the audit log |

## Edge-case review

The review found 25 issues in the current draft; five are high severity because they lose money or double-book a bay (EC-06, 08, 09, 10, 15). Each row says where the fix now lives, so nothing is fixed only in this table.

| ID | Severity | Finding | Resolution | Now lives in |
| --- | --- | --- | --- | --- |
| EC-01 | Low | The 17:30 grace is never used: with on-the-hour starts and 60/120/180-minute services, the latest possible end is 17:00. The features list also says "+/− 30 mins", the spec says close only. | Dropped (D-08). | CFG-05, D-08 |
| EC-02 | Low | "Today" has no time zone, app servers may disagree on the time, and clock changes in March and October shift 09:00 in UTC. | One garage time zone; database clock for every "now". | CFG-01, BR-45 |
| EC-03 | Low | Bank holidays and shutdowns are bookable. | Closure-date list. | CFG-03, BR-01 |
| EC-04 | Medium | A customer who never arrives leaves the booking CONFIRMED forever, and nothing stops the balance being charged. | NO\_SHOW state; deposit kept, no balance charge. | BR-40, TR-07, US-BK-16 |
| EC-05 | Medium | After the window the customer is told to "contact Garage Admin", but no channel or outcome is defined. | Customer contacts the garage (BP-07); the garage admin decides (BR-26). Support requests are deferred. | BR-25, US-BK-06 |
| EC-06 | High | F/C-3 flags checkout holds as REASSIGNMENT\_REQUIRED. If the payment then succeeds, F/C-1 overwrites the flag with CONFIRMED (a lost update), or an admin is asked to fix a booking nobody has paid for. | Never flag holds; re-check the technician when the deposit lands; state guard on every transition. | BR-16, BR-32, State model |
| EC-07 | Medium | The window runs from created\_at, so time spent in checkout eats into it. The three docs also word it differently. | Measure from confirmed\_at. | CFG-12, BR-23 |
| EC-08 | High | The gateway can succeed after expires\_at: money is taken but the booking is EXPIRED. Also, if the browser closes, nothing ever sets EXPIRED. | Check the hold before charging; late success confirms or refunds; sweep job; explicit abandon. | BR-15, BR-16, BR-20, BR-21 |
| EC-09 | High | The "atomic" boxes in F/C-1, 2.1, 2.2, 2.3 and 4 contain gateway calls, which a database rollback cannot undo. If the charge succeeds and the commit fails, a retry charges twice. | Idempotency keys; no gateway call inside a transaction; money tracked separately from booking status. | BR-17, BR-18, BR-28, State model |
| EC-10 | High | `SELECT … FOR UPDATE` locks only rows that already exist. Two customers booking the same free slot both see no conflict and both insert: a double booking. | Lock one row per date (the calendar\_day table) before checking, or use SERIALIZABLE with retry. | BR-12, F/C-1 step 4 |
| EC-11 | Medium | One vehicle can be booked into two overlapping slots from two tabs, and a vehicle can be deleted while booked. | Vehicle conflict check; block delete. | BR-07, BR-43 |
| EC-12 | Low | The features list says "least amount of work", the spec counts bookings: one 3-hour job counts as less work than two 1-hour jobs. The features list also says "uneven" where "even" is meant. Random tie-breaks make tests flaky. | Choose the measure; injectable random source. | BR-11, D-01 |
| EC-13 | Medium | A customer cannot cancel a REASSIGNMENT\_REQUIRED booking, even though the garage caused the problem. | Customer may cancel inside the window only; afterwards the garage admin cancels, at any time (D-03). | BR-24, US-BK-05, D-03 |
| EC-14 | Medium | A tech admin can disable a technician who still has future bookings; they stay assigned to an inactive account and the garage admin is not told. | Treat as unavailability. | BR-34, US-BK-18 |
| EC-15 | High | Post-completion refunds have no running total, so repeated refunds can exceed the price. After a manual settlement, a gateway refund would return money the gateway never took. | Cap refunds at the gateway-collected amount. | BR-27 |
| EC-16 | Low | 10% of £79.99 is £7.999. Rounding the deposit and the balance separately can lose or gain a penny. | Round the deposit; balance = price − deposit. | BR-19 |
| EC-17 | Low | Changing a service's price or duration, or a vehicle's registration, would rewrite existing bookings. | Snapshot onto the booking. | BR-30 |
| EC-18 | Medium | Removing bay 4 or adding a closure date leaves active bookings in a bay or on a day that no longer exists. | Refuse (D-04). | BR-31, D-04 |
| EC-19 | Medium | F/C-3's reschedule re-checks hours and bays only: not weekdays, horizon, closure dates, vehicle conflicts or times in the past. | Full re-validation. | BR-35, F/C-3 step 7 |
| EC-20 | Medium | Nothing happens if a flagged booking is still unresolved when it starts: the customer arrives to no technician. | The admin resolves it before the start time; otherwise the booking becomes UNRESOLVED (D-09). | BR-36, D-09 |
| EC-21 | Medium | A technician can complete a job before its date (wrong job tapped), which charges the customer. | Only at or after start. | BR-37 |
| EC-22 | Medium | A customer can delete their account while holding active bookings or an unpaid balance. | Block deletion while bookings are active or a balance is owed; new bookings stay allowed. | BR-41, BR-42, D-05 |
| EC-23 | Medium | F/C-1's error E2 and the same-day rule point customers to a "manual slot" from the garage admin, but no story lets an admin create a booking. | Admin books through the same flow on the garage account, with no overrides (BR-46). | D-10 |
| EC-24 | Low | If an unavailability window is deleted after its bookings were flagged, they stay flagged. | The original technician becomes a valid choice again through TR-05. | BR-35 |
| EC-25 | Low | A browser tab put to sleep pauses a locally counted timer, so the UI countdown can drift from the server. | The UI counts down to the server's expires\_at, not from page load. | US-BK-02 |

## Flowchart corrections

All seven of your flowcharts keep their shape; most need one or two extra diamonds and the gateway calls moved out of the "atomic" boxes. Label every diamond with its BR ID as you redraw, then check off each row.

| Flowchart | Changes | Diamonds should cite |
| --- | --- | --- |
| F/C-1 Booking and deposit | V1 also checks closure dates, vehicle conflicts and hold/booking caps. Step 4 locks the date row first. Before P1, add "hold still valid?". Split V3's No branch: *failed* → EXPIRED; *succeeded late* → re-allocate or refund. CM1 becomes a conditional update in its own transaction. Add an "abandon checkout" exit. | V1: BR-01, 07, 08, 13 · V2: BR-02 · C1: BR-05, 12 · B1: BR-10 · D1: BR-11 · new: BR-15, 16, 21 · CM1: BR-17, 18 |
| F/C-2.1 Customer cancel | V1 also accepts REASSIGNMENT\_REQUIRED (same time limit). V2 measures from confirmed\_at. Set the status first, which frees the slot; then refund in a separate step, with a failure branch to the admin queue. | V1: BR-23, 24 · V2: BR-23 · refund: BR-17, 18, 28 |
| F/C-2.2 Admin cancel | V2 simplifies to an integer from 0 to 100. The reason is mandatory. Refund leaves the transaction box, as in F/C-2.1. | V1: BR-26 · refund: BR-17, 18, 28 |
| F/C-2.3 Goodwill refund | V1 adds "total refunds + this refund ≤ gateway-collected amount". | V1: BR-27 |
| F/C-3 Unavailability | Step 2 validates the window. Step 3 checks CONFIRMED only. Add step 3b: try to move each booking to a free technician; flag only if none. Step 7 re-runs full validation. Add one more entry point: technician disabled (BR-34). | 2: BR-32 · 3b: BR-33 · 7: BR-35 · 8: BR-06 |
| F/C-4 Completion | V1 adds "now ≥ start". Reorder: commit COMPLETED, the service record and a PENDING balance transaction first; then call the gateway; then record the result. Failure sets balance OUTSTANDING instead of a new booking state. | V1: BR-37 · charge: BR-17, 18, 38 |
| F/C-4.1 Manual settlement | V1 checks balance\_status = OUTSTANDING instead of a booking state. | V1: BR-39 |

### New flowcharts needed

- [ ] **F/C-5 No-show:** admin marks NO\_SHOW after the grace period; deposit kept, no balance charge (BR-40).
- [ ] **F/C-6 Hold sweep and late payment:** the scheduled job that expires holds, and the late-success path from F/C-1 (BR-16, BR-20).
- [ ] **F/C-7 Late cancellation request:** support request linked to the booking, then the F/C-2.2 decision (BR-25). Deferred with the support feature.
- [ ] **F/C-8 Refund failure handling:** a FAILED refund enters the admin queue and is completed outside the system, recorded with an external reference (BR-17, BR-28).

## Open decisions

Ten choices were the team's to make; all ten are now decided, and the spec follows the last column.

| ID | Question | Recommendation | Why | Touches | Team decision |
| --- | --- | --- | --- | --- | --- |
| D-01 | Measure technician workload by booked minutes or number of bookings? | Minutes | Matches "least amount of work" in the features list; a 3-hour job is more work than a 1-hour job | BR-11 | Agreed |
| D-02 | When a technician becomes unavailable, move bookings automatically to a free technician first? | Yes | Customers never see the technician's identity; the admin handles only the cases that really need a call | BR-33 | Agreed: same window and bay, technician changes only; otherwise flag |
| D-03 | Can a customer cancel a REASSIGNMENT\_REQUIRED booking themselves with a full refund? | Yes | The garage caused the problem; blocking it creates support load | BR-24 | Changed: customer self-cancels only inside the 2-hour window, whatever the status; after it, garage admin only, at any time, refund 0–100% |
| D-04 | Capacity reduction that breaks active bookings: refuse, or flag the bookings? | Refuse until resolved | Simpler, and no booking silently changes | BR-31 | Agreed: refused until no active booking uses the bay or day |
| D-05 | Block new bookings while a balance is outstanding? | Yes | Stops unpaid debt growing | BR-42 | Changed: no. Balances are collected outside the system; they still block account deletion (BR-41) |
| D-06 | Replace COMPLETED\_PAYMENT\_FAILED with COMPLETED + balance OUTSTANDING? | Yes | Keeps payment edge cases from multiplying booking states | State model | Agreed |
| D-07 | Can two accounts register the same number plate? | Allow, unique per account; flag duplicates to the garage admin | Global uniqueness lets anyone block a real owner (MS-BK-10); allowing duplicates keeps the car sellable | MS-BK-10 | Agreed |
| D-08 | Keep the 17:30 grace? | Drop it, or rename it an overrun buffer and say no booking may use it | It currently has no effect (EC-01) | CFG-05 | Agreed: dropped; CFG-05 is now 17:00 |
| D-09 | What happens to a flagged booking still unresolved 24 h before its start? | Cancel automatically with full refund and tell the customer in-app | Prevents a customer arriving to no technician | BR-36 | Changed: no automatic cancel. The admin resolves it before the start time (move other bookings, agree a new slot, or cancel with full refund); otherwise it becomes UNRESOLVED (TR-11, BR-36) |
| D-10 | Should garage admins create bookings by hand (same-day, outside hours)? | Not in this iteration; change E2's message to "call the garage" | Admin booking reopens every rule above for a second actor | F/C-1 E2 | Changed: yes, through the same flow on the garage account, with no overrides (BR-46, US-BK-19) |

### Business policies (outside the system)

Some situations are deliberately handled by garage staff rather than by software. The design relies on these policies, so they are written down with IDs like the rules.

| ID | Policy | Relied on by |
| --- | --- | --- |
| BP-01 | For bookings made on a customer's behalf, the garage admin collects and records in the note the customer's name, phone number, registration, make, model and fuel type. Fuel type is needed for workshop safety. | BR-46, US-BK-19 |
| BP-02 | Customers booked by the garage admin pay at the counter; the garage reconciles this against the deposit it paid. | BR-46 |
| BP-03 | The garage admin resolves flagged bookings with the customer before the start time, by moving other bookings, agreeing a new slot, or cancelling with a full refund (optionally offering out-of-hours service). | BR-36, BR-47 |
| BP-04 | Outstanding balances are collected by the garage through its own channels. | BR-38, BR-41 |
| BP-05 | Before removing a bay, closing a day or shortening opening hours, the garage moves or cancels the affected bookings with the customers. | BR-31 |
| BP-06 | Refund amounts for admin cancellations and goodwill refunds are at the garage admin's discretion. | BR-26, BR-27 |
| BP-07 | Customers who want to cancel after the self-cancel window contact the garage by phone or email; the garage admin decides and cancels through the system. | BR-25, BR-26 |

## Discovery log

Add a row the moment you spot something while drawing, then carry on; triage it later into a BR, AC, TR, MS or the deferred list. EC-01 to EC-25 above are the first entries.

| ID | Date | Found while | Finding | Home (BR / AC / TR / MS / deferred) | Done |
| --- | --- | --- | --- | --- | --- |
| EC-26 |  |  |  |  |  |

### Deferred to later iterations

Your existing out-of-scope list stands. The review adds four items, so they are recorded as decisions rather than gaps:

- Garage-admin-created bookings, including same-day and outside-hours slots (D-10)
- Bay out of service: only technicians have unavailability windows today
- Jobs that overrun their slot and collide with the next booking
- Technician working hours and breaks (already deferred as "dynamic working hours")

Staff probation is dropped for this iteration; the team may revisit it. Customer support (requests, messages, attachments) and the support staff role are deferred; the design is kept in the Support (deferred) tab. Audit-log hash chains and in-app break-glass alerts are also deferred. Already deferred in your draft: customer booking amendments, failed payment retries and chargebacks, multi-day jobs, automated email and SMS notifications, multi-tenancy, AI chatbot, WAF.
