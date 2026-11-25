# Wireframe Checklist

## How to use this checklist

The wireframes need 48 screens: 6 public and customer sign-in screens, 15 in the customer portal, 24 in the staff portal, and 3 shared error screens. Each row lists what the screen must show, the extra states to draw beside the normal view, and the stories it comes from, so every wireframe can be checked against the spec.

- Draw the normal view first, then each state listed in *States to draw* (errors, empty lists, locked or blocked cases).
- Type into the **Done** column as you go (e.g. "done", "partly: missing hold-expired state").
- Customer screens live at app.example.com, staff screens at staff.example.com. Support screens are deferred: do not draw them.

## Public website and customer sign-in

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-01 | Home (public) | Services with name, price and duration; opening days and hours; contact details; Sign in and Register buttons | — | US-PUB-01 |  |
| W-02 | Register (app.example.com/signup) | Full name, email, phone, password with the rule "at least 12 characters" | Password rejected; "check your email" confirmation, which looks the same even if the email already has an account | US-AUTH-01 |  |
| W-03 | Email verification result | Success message with a Sign in button | Link expired or already used, with a Resend link button | US-AUTH-01 |  |
| W-04 | Customer sign in (app.example.com/login) | Email, password, Forgot password link, Register link | Generic "email or password is incorrect"; account locked for 15 minutes; email not verified with Resend; after sign-in, back to the page the user came from | US-AUTH-02, US-PUB-02 |  |
| W-05 | Forgot password | Email field | One confirmation message, identical for any email entered | US-AUTH-08 |  |
| W-06 | Set new password (from email link) | New password with the 12-character rule | Link expired or used; success leading to sign in | US-AUTH-08 |  |

## Customer portal (app.example.com)

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-07 | Dashboard | Upcoming bookings, Book a service button, vehicles summary, navigation: Bookings, Vehicles, Profile, Sign out | New customer with no vehicles: prompt to add one first | US-BK-07, US-VEH-02 |  |
| W-08 | My vehicles | Registration, make, model, year, fuel type for each vehicle; Add, Edit, Remove | No vehicles yet | US-VEH-02 |  |
| W-09 | Add or edit vehicle | Required: registration, make, model, manufacture year, fuel type (Petrol, Diesel, Hybrid, Electric). Optional: transmission, mileage, VIN | Registration already on this account; field validation errors | US-VEH-01, US-VEH-02 |  |
| W-10 | Remove vehicle | Confirmation dialog | Blocked: the vehicle has an active booking | US-VEH-03 |  |
| W-11 | Book, step 1: vehicle and service | Vehicle picker; the three services with price and duration | Changing the service clears any chosen date and time | US-BK-01 |  |
| W-12 | Book, step 2: date and time | Calendar covering the next 60 days; start-time buttons for the chosen date | Greyed-out dates (weekends, closed days, full days, today and past); a date with no times left | US-BK-01 |  |
| W-13 | Book, step 3: checkout | Summary (vehicle, service, date, time, price, 10% deposit now, balance due on completion); billing address (required); card entry area clearly belonging to the payment gateway; countdown from 5:00; Pay deposit and Cancel | Slot just taken; hold expired; payment failed; Pay button disabled after one click; refused because an open checkout or 2 active bookings already exist | US-BK-02, US-BK-03, BR-48 |  |
| W-14 | Booking confirmed | Booking summary, deposit invoice link, the time until which free cancellation is possible | — | US-BK-03 |  |
| W-15 | My bookings | List with status; filter by status and date; search | No bookings; no results | US-BK-07 |  |
| W-16 | Booking detail | Status, vehicle, service, date and time, amount paid and remaining, invoices and credit notes | Inside the 2-hour window (Cancel button with deadline); after it (garage phone and email instead); flagged ("the garage is rearranging this booking" banner); completed (work notes and mileage); cancelled, no-show and unresolved | US-BK-04, US-BK-05, US-BK-08 |  |
| W-17 | Cancel booking | Confirmation showing the full deposit refund | Refunded; refund pending | US-BK-04 |  |
| W-18 | Profile | Name, phone, billing address (editable); email shown with a Change button; Change password; Delete account | Validation errors | US-ACC-01 |  |
| W-19 | Change email | New email and current password | "Check your new inbox to confirm" pending notice; wrong password | US-ACC-02 |  |
| W-20 | Change password | Current and new password | Wrong current password; success noting other devices were signed out | US-AUTH-07 |  |
| W-21 | Delete account | What will be deleted and what is kept; password confirmation | Blocked by an active booking or an outstanding balance | US-ACC-03 |  |

## Staff portal: sign-in and technician (staff.example.com)

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-22 | Staff sign in | Email and password | Generic error; account locked; account disabled (same generic message) | US-AUTH-03 |  |
| W-23 | Emailed sign-in code | 6-digit code field, "code expires in 10 minutes", Resend code | Wrong or expired code; account locked after repeated wrong codes | US-AUTH-03 |  |
| W-24 | Activate staff account (from email link) | Set password with the 12-character rule | Link expired or used | US-AUTH-04 |  |
| W-25 | Staff navigation | One menu variant per role: technician, garage admin, tech admin, super admin, each showing only that role's sections | — | Roles and capabilities |  |
| W-26 | Technician: my jobs | Each job's time, bay, service and registration; filter by date and status | No jobs on the chosen day | US-BK-09 |  |
| W-27 | Technician: job detail and complete | Vehicle details with fuel type shown prominently (safety), service, time, bay; the admin's note for admin bookings; work notes and mileage fields; Complete button | Complete disabled before the start time; result "paid" or "balance outstanding" | US-BK-10 |  |

## Staff portal: garage admin

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-28 | Garage admin dashboard | Flagged bookings first, soonest start first; today's schedule; counts of outstanding balances and failed refunds | All queues empty | US-BK-12, BR-36 |  |
| W-29 | Day schedule | Grid of bays against hours, each booking showing technician, service and status | Closed day | US-BK-11, US-BK-12 |  |
| W-30 | Booking search | Filters: date range, status, technician, bay, registration; results list | No results | US-GAD-01 |  |
| W-31 | Booking detail (admin) | All booking details, balance status, invoices, history timeline (who did what and when); actions Reassign or reschedule, Cancel, Mark no-show, Goodwill refund | Actions shown only when the status allows them; Mark no-show disabled until 30 minutes after the start | US-BK-12, US-BK-13, US-BK-16, US-GAD-03 |  |
| W-32 | Reassign or reschedule | Technician picker listing only free technicians; date and time; bay chosen automatically | Technician not free; time outside opening hours | US-BK-12, F/C-3.1 |  |
| W-33 | Admin cancellation | Reason (required); refund % from 0 to 100 with the amount it gives | Missing reason; refund pending | US-BK-13 |  |
| W-34 | Book for a customer | Same steps as W-11 to W-13, without the vehicle picker, plus a required note prompting for name, phone, registration, make, model and fuel type; payment uses the garage's backup payment method | Empty note; another checkout already open | US-BK-19, BP-01 |  |
| W-35 | Technician unavailability | Technician, start, end, category (Leave, Training, Other; no free-text reason) | Invalid window; result summary of bookings moved and bookings flagged | US-BK-11 |  |
| W-36 | Garage settings | Opening days and hours; closure dates; bays (retire, re-activate); services (add, price, duration 60/120/180, switch off); deposit %; booking caps; no-show grace | Change refused because active bookings depend on it | US-BK-17 |  |
| W-37 | Payments and queues | Transactions (type, status, amount, date, invoice link); outstanding balances queue with Mark settled and an external reference field; failed refunds queue with Record external refund | Empty queues | US-GAD-02, US-BK-15, F/C-8 |  |
| W-38 | Goodwill refund | Booking (completed, no-show or unresolved), amount already refunded, amount still refundable, refund % and reason | Refund would exceed what was collected | US-BK-14 |  |

## Staff portal: tech admin and super admin

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-39 | Staff accounts | Name, email, role and status for each staff member; Create; per row: Disable or Enable, Change role, Send password reset | Own row's actions disabled with an explanation; disabling the last tech admin refused | US-STF-01 to US-STF-04 |  |
| W-40 | Create staff account | Name, work email, role (Technician, Garage admin, Tech admin only) | "Activation email sent" confirmation | US-STF-01 |  |
| W-41 | Logs | Two tabs, Security events and Audit events; filters by type, user and date; read-only, with no edit or delete controls | No results | US-STF-05 |  |
| W-42 | Payments monitor | Transactions (read-only) and a gateway status indicator; no action buttons | Gateway unreachable | US-STF-06 |  |
| W-43 | Break-glass sign in | Three steps: password, emailed code, recovery code | Any factor wrong (generic message) | US-SA-01 |  |
| W-44 | Restore access | Garage admin and tech admin accounts only, each with Disable, Enable and Send password reset | — | US-SA-02 |  |
| W-45 | New recovery code (at sign-out) | The new code shown once, a Copy button, and an "I have stored it offline" confirmation | — | US-SA-03 |  |

## Shared screens and rules for every wireframe

| # | Screen | Must show | States to draw | Stories | Done |
| --- | --- | --- | --- | --- | --- |
| W-46 | Session expired | "You were signed out after inactivity" with Sign in again; a version for each portal | — | US-AUTH-06 |  |
| W-47 | Access denied (403) | Plain message with a link home; no detail about the record | — | NFR-SEC-01 |  |
| W-48 | Something went wrong | Generic message; no technical detail | — | NFR-SEC-13 |  |

Every wireframe follows these rules, which come from the spec:

- **No card numbers anywhere.** Card entry sits in an area that clearly belongs to the payment gateway (BR-22).
- **Customers never see technician names or bay numbers** (BR-09).
- **Sign-in, registration and reset messages are generic.** Never "email not found" (MS-APP-02).
- **Pay and confirm buttons disable after the first click** (BR-17).
- **Changing email and deleting the account ask for the password** (US-ACC-02, US-ACC-03).
- **Money in pounds and pence; times in UK time** (CFG-01).
- **Log screens have no edit or delete controls** (ERD §7).
- **Not in this iteration, so do not draw:** support tickets or messages, a notifications centre, VAT lines on invoices, or customer self-rescheduling of bookings.