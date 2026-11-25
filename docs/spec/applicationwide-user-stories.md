# Application user stories v1.0

## Scope and how to read

This tab holds every user story outside the booking ecosystem: the public website, sign-in, customer accounts and vehicles, staff administration, the garage admin's records, break-glass access, and the security requirements that apply across the whole application. The Booking spec, Flowcharts and ERD tabs are final and are only referenced here by ID; where anything in this tab seems to disagree with them, they win. Customer support stays deferred (Support tab). Security emails (account verification, staff sign-in codes, password resets and staff activation) are in scope; booking notification emails remain out of scope, as the booking spec says.

| ID prefix | Area | Defined in |
| --- | --- | --- |
| US-PUB | Public website | This tab |
| US-AUTH | Authentication and sessions | This tab |
| US-ACC | Customer account and profile | This tab |
| US-VEH | Vehicles | This tab |
| US-STF | Staff administration (tech admin) | This tab |
| US-GAD | Garage admin, outside bookings | This tab |
| US-SA | Break-glass super admin | This tab |
| NFR-SEC | Application-wide security requirements | This tab |
| MS-APP | Application-wide misuse stories | This tab |
| US-BK, BR, BP, CFG, TR, MS-BK | Booking ecosystem | Booking spec tab (referenced, not changed) |
| ERD §n | Data model sections | ERD tab (referenced, not changed) |

Stories follow the booking spec's format: one role and one goal, Given/When/Then criteria, and **[Sec]** marking a security criterion. Values not yet agreed by the team are marked *Proposed* and collected under Open decisions at the end.

## Roles and capabilities

Each role carries a fixed set of capabilities; there are no separately assignable permissions (ERD §1). Support is reserved for a later iteration.

| Capability | Visitor | Customer | Technician | Garage admin | Tech admin | Super admin |
| --- | --- | --- | --- | --- | --- | --- |
| View the public website | Yes | Yes | Yes | Yes | Yes | Yes |
| Register and sign in at the customer portal | Register | Sign in | — | — | — | — |
| Sign in at the staff portal with MFA | — | — | Yes | Yes | Yes | Yes (break-glass) |
| Manage own profile, vehicles and account | — | Yes | — | — | — | — |
| Book and self-cancel own bookings | — | Yes (US-BK) | — | — | — | — |
| Book on a customer's behalf | — | — | — | Yes (BR-46) | — | — |
| View and complete assigned jobs | — | — | Yes (US-BK) | — | — | — |
| Run the schedule: capacity, services, reassign, cancel, refund, settle | — | — | — | Yes (US-BK) | — | — |
| Search operational booking and vehicle records | — | — | — | Yes | — | — |
| View transactions and invoices | — | Own only | — | Yes | Yes | — |
| Create, disable and re-role staff | — | — | — | — | Yes | — |
| Reset another user's credentials | — | — | — | — | Yes, except super admin | Garage and tech admins only |
| Read booking and money audit history | — | — | — | Yes | Yes | Yes |
| Read security events | — | — | — | — | Yes | Yes |

A role never inherits another role's capabilities: the tech admin, for example, cannot run the schedule, and the garage admin cannot manage staff accounts.

## Public website

**US-PUB-01 · Browse the garage's information** (from G1) As a visitor, I want to see the garage's services, prices, opening hours and contact details without registering, so that I can decide whether to use the garage.

1. *Given* I am not signed in, *when* I open the website, *then* I see each active service with its price and duration, the opening days and hours, and the contact details.
2. *Given* the garage admin switches a service off, *when* the page next loads, *then* that service no longer appears.
3. **[Sec]** *Given* any public page, *when* it renders, *then* it shows no customer, booking, staff or availability data.

**US-PUB-02 · Be prompted to sign in** (from G2) As a visitor, I want to be sent to sign in or register when I try something that needs an account, so that I can carry on once I have one.

1. *Given* I am not signed in, *when* I start a protected action such as booking, *then* I am taken to the customer sign-in page with a link to register.
2. *Given* I sign in from that prompt, *when* sign-in succeeds, *then* I return to the page I started from.
3. **[Sec]** *Given* the return address in the sign-in link, *when* it is followed, *then* only a relative path on our own site is accepted, so the link cannot send me to another website (open redirect).

## Authentication and sessions

Customers sign in at app.example.com and staff at staff.example.com, both backed by one USER table (ERD §1). Staff confirm every sign-in with a one-time code sent to their email, and every outcome is written to the security log (ERD §7).

**US-AUTH-01 · Register as a customer** (from C1) As a visitor, I want to create an account at app.example.com/signup, so that I can manage my vehicles and book services.

1. *Given* I enter my full name, email, phone number and a password, *when* I register, *then* an unverified account is created and a verification link is emailed to me.
2. *Given* I open the link within 24 hours (AD-13), *when* it loads, *then* my email is verified and I can sign in.
3. *Given* my password is shorter than 12 characters or appears on a list of commonly used passwords, *when* I submit, *then* it is refused with the reason (AD-01).
4. **[Sec]** *Given* the email already has an account, *when* I register, *then* I see the same "check your email" message as anyone else, and the address's owner is emailed that an account already exists, so the page never reveals which emails are registered.
5. **[Sec]** *Given* I add extra fields such as a role to the request, *when* it is processed, *then* the account is always created as CUSTOMER (mass assignment).
6. **[Sec]** *Given* a verification link, *when* it has been used or has expired, *then* it no longer works; only a hash of it is stored.

**US-AUTH-02 · Sign in as a customer** (from C1) As a customer, I want to sign in at app.example.com/login with my email and password, so that I can reach my account.

1. *Given* correct details and a verified email, *when* I sign in, *then* a session starts and I reach my dashboard.
2. *Given* my email is not verified yet, *when* I sign in, *then* I am asked to verify it and can request a new link.
3. **[Sec]** *Given* a wrong email or password, *when* I submit, *then* I see one generic message that does not reveal which part was wrong or whether the account exists.
4. **[Sec]** *Given* 5 failed attempts in a row on one account, *when* the next attempt arrives, *then* the account is locked for 15 minutes (AD-02).
5. **[Sec]** *Given* a staff account's details, *when* they are entered at the customer portal, *then* sign-in fails with the same generic message.

**US-AUTH-03 · Sign in as staff with an emailed code** (from the staff story) As a staff member, I want to confirm sign-in with a one-time code sent to my email, so that a leaked password alone cannot open my account.

1. *Given* a correct password at staff.example.com/login, *when* I submit, *then* a 6-digit code is emailed to me, valid for 10 minutes (AD-13), and entering it starts a session with my role's capabilities only.
2. **[Sec]** *Given* a wrong or expired code, *when* I submit, *then* sign-in fails and the failure counts toward lockout; requesting a new code cancels the previous one.
3. **[Sec]** *Given* my account is DISABLED, *when* I try to sign in, *then* it fails with the generic message.
4. **[Sec]** *Given* customer details, *when* they are entered at the staff portal, *then* sign-in fails with the generic message.
5. **[Sec]** *Given* the password step passed but the code has not, *when* I try any other staff page, *then* I am sent back to the code page.

**US-AUTH-04 · Activate my staff account** As a new staff member, I want to set my own password from an activation email, so that nobody else ever knows it.

1. *Given* the tech admin created my account, *when* I open the activation link within 72 hours (AD-03), *then* I set my password and from then on sign in with emailed codes.
2. **[Sec]** *Given* the link has expired or been used, *when* I open it, *then* it no longer works and the tech admin must send a new one.

**US-AUTH-05 · Sign out** As any signed-in user, I want to sign out, so that nobody else can use my session on this device.

1. *Given* I am signed in, *when* I sign out, *then* the session is revoked on the server and its cookie is cleared, so reusing the old cookie fails.

**US-AUTH-06 · Be signed out after inactivity** As any user, I want an idle session to end on its own, so that an unattended device does not stay signed in.

1. *Given* no activity for 30 minutes (customers) or 15 minutes (staff), *when* I next act, *then* I must sign in again (AD-04).
2. *Given* continuous activity, *when* a session reaches 12 hours (customers) or 8 hours (staff), *then* it ends anyway (AD-04).

**US-AUTH-07 · Change my password** As any signed-in user, I want to change my password, so that I can replace one I think is exposed.

1. **[Sec]** *Given* I enter my current password and a new one meeting the policy, *when* I save, *then* the password changes and all my other sessions are revoked.

**US-AUTH-08 · Reset a forgotten password** (AD-05) As a customer, I want to reset my own password by email, so that I can get back into my account without contacting the garage.

1. *Given* I enter my email at app.example.com, *when* I request a reset, *then* I see the same confirmation whether or not an account exists, and an account holder is emailed a reset link valid for 30 minutes (AD-13).
2. *Given* a valid link, *when* I set a new password meeting the policy, *then* it changes, the link stops working and all my sessions end.
3. **[Sec]** *Given* reset links, *when* they are created, *then* they are random, single-use and stored only as a hash, and reset requests are rate-limited (NFR-SEC-05).

Staff who forget their password ask the tech admin, who sends them a reset link (US-STF-04).

## Customer account, profile and vehicles

Fields, formats and deletion behaviour follow ERD §2 and the team's Customer and Vehicle Data Research; the stories below add the user-facing behaviour.

### Account and profile

**US-ACC-01 · Keep my details up to date** (from C2) As a customer, I want to view and update my name, phone number and billing address, so that the garage can contact me and invoice me correctly.

1. *Given* I am signed in, *when* I open my profile, *then* I see my full name, email, phone number and billing address.
2. *Given* I change my name, phone or billing address, *when* I save valid values (name 2–100 characters, UK phone number), *then* they are stored and used on future invoices; past invoices keep their copy (ERD §5).
3. **[Sec]** *Given* I send a profile update naming another customer's ID, *when* it is processed, *then* only my own profile can change, because the server takes my identity from my session.

**US-ACC-02 · Change my email address** As a customer, I want to change the email I sign in with, so that I can keep using my account if my address changes.

1. *Given* I enter a new email and my current password, *when* I save, *then* a verification link is sent to the new address, and the change takes effect only once I open it; until then I keep signing in with the old address.
2. *Given* the new email already belongs to another account, *when* I save, *then* I see the same confirmation as any other change and nothing changes, so the page does not reveal which emails are registered.
3. **[Sec]** *Given* a wrong current password, *when* I save, *then* nothing changes and the attempt is logged as a security event.
4. **[Sec]** *Given* the change completes, *when* it takes effect, *then* the old address is emailed a notice, so a hijacker changing my email cannot do it unnoticed.

**US-ACC-03 · Delete my account** (from C3) As a customer, I want to delete my account, so that I control my personal data when I stop using the garage.

1. *Given* I have an active booking or an outstanding balance, *when* I ask to delete my account, *then* I am told why it cannot be deleted yet (BR-41).
2. *Given* nothing blocks deletion and I confirm with my password, *when* I delete, *then* my profile is overwritten, my status becomes DELETED, my vehicles are archived with VIN and registration cleared, my payment tokens are purged and all my sessions end (ERD §2, §5).
3. *Given* my account is deleted, *when* the garage looks at past records, *then* bookings, transactions and invoices are still there, as the data research requires.
4. **[Sec]** *Given* someone using my unlocked session without my password, *when* they try to delete my account, *then* it is refused.

### Vehicles

**US-VEH-01 · Add a vehicle** (from C4) As a customer, I want to add my vehicle, so that I can book services for it.

1. *Given* I enter registration, make, model, manufacture year and fuel type, and optionally transmission, mileage and VIN, *when* I save, *then* the vehicle appears in my list.
2. *Given* I already have that registration on my account (in any spacing or letter case), *when* I save, *then* it is refused as a duplicate; the same registration on another customer's account is allowed (D-07 in the booking spec).
3. **[Sec]** *Given* any request to add a vehicle, *when* it is saved, *then* the owner is always me, taken from my session, never from the request.

**US-VEH-02 · View and edit my vehicles** (from C4) As a customer, I want to see and correct my vehicles' details, so that the garage prepares the right parts and precautions.

1. *Given* I open My vehicles, *when* the list loads, *then* I see only my own vehicles that are not archived.
2. *Given* I edit a vehicle, *when* I save, *then* future bookings use the new details and existing bookings keep their snapshot (BR-30).
3. **[Sec]** *Given* I request another customer's vehicle by changing its ID, *when* the request is sent, *then* I get 403 and the attempt is logged.

**US-VEH-03 · Remove a vehicle** (from C4) As a customer, I want to remove a vehicle I no longer own, so that my list stays accurate.

1. *Given* the vehicle has an active booking, *when* I try to remove it, *then* I am told to cancel or complete that booking first (BR-43).
2. *Given* no active booking, *when* I remove it, *then* it is archived: hidden from my list and from booking, while its service history is kept.
3. *Given* I add the same registration again later, *when* I save, *then* it is added as a new vehicle.

## Staff administration (tech admin)

The tech admin controls who can reach the staff portal and with which role, but never the super admin account. Disabling a technician also protects their bookings, as US-BK-18 already defines.

**US-STF-01 · Create a staff account** (from TA1) As the tech admin, I want to create an account for a new staff member with one role, so that they can do their job and nothing more.

1. *Given* I enter a full name, work email and a role of TECHNICIAN, GARAGE_ADMIN or TECH_ADMIN, *when* I save, *then* the account is created and an activation email is sent to the new staff member (US-AUTH-04); I never see or set their password.
2. **[Sec]** *Given* I choose SUPER_ADMIN or SUPPORT, *when* I save, *then* it is refused: the super admin is never created in the app, and support is reserved for a later iteration.
3. **[Sec]** *Given* any other role than tech admin, *when* the create-staff page or API is called, *then* it returns 403 and the attempt is logged.

**US-STF-02 · Disable or re-enable a staff member** (from TA1) As the tech admin, I want to switch a staff account off and back on, so that access always matches who currently works at the garage.

1. *Given* an active staff account, *when* I disable it, *then* its status becomes DISABLED, all its sessions end immediately and it can no longer sign in.
2. *Given* the account is a technician with future bookings, *when* I disable it, *then* BR-34 runs and the garage admin is alerted (US-BK-18).
3. *Given* a disabled account, *when* I re-enable it, *then* it can sign in again.
4. **[Sec]** *Given* my own account, or the last active tech admin, *when* I try to disable it, *then* it is refused, so the garage cannot lock itself out by mistake (AD-07).

**US-STF-03 · Change a staff member's role** (from TA1) As the tech admin, I want to change someone's role, so that their access follows a change in their job.

1. *Given* I pick a new role, *when* I save, *then* the role changes and all their sessions end, so the new capabilities apply from their next sign-in.
2. *Given* they were a technician, *when* the role changes away from TECHNICIAN, *then* BR-34 runs for their future bookings.
3. **[Sec]** *Given* SUPER_ADMIN as the new role, or my own account as the target, *when* I save, *then* it is refused.

**US-STF-04 · Send a password reset to another user** (from TA2) As the tech admin, I want to send a password-reset link to a user's registered email, so that a locked-out or compromised account can be recovered without me ever knowing the new password.

1. *Given* any user except the super admin, *when* I send a reset, *then* their current password stops working, their sessions end, and a reset link valid for 30 minutes (AD-13) goes to their own registered email.
2. **[Sec]** *Given* the super admin account, *when* I try to send a reset, *then* it is refused and the attempt is logged.
3. **[Sec]** *Given* any reset I send, *when* it is sent, *then* it is logged as a security event naming me, and I cannot change the address it goes to.

**US-STF-05 · Review security and audit logs** (from TA4) As the tech admin, I want to search the security and audit logs, so that I can spot and investigate suspicious activity.

1. *Given* I filter by event type, user or date range, *when* the results load, *then* I see matching security and audit events, newest first.
2. **[Sec]** *Given* any log entry, *when* I view it, *then* I can read it but there is no way to edit or delete it (ERD §7).

**US-STF-06 · Monitor payments** (from TA3, AD-06) As the tech admin, I want to see payment transactions and whether the payment gateway is reachable, so that I can spot payment problems early.

1. *Given* I open Payments, *when* it loads, *then* I see transactions with their type, status, amount and gateway reference, and the gateway's current reachability.
2. **[Sec]** *Given* the gateway's secret keys, *when* I use the app, *then* they are never shown or editable: they live in application configuration (ERD §3, §5).
3. *Given* a refund or settlement is needed, *when* I look for the action, *then* it is not available to me: money actions belong to the garage admin (US-BK-13 to US-BK-15).

## Garage admin, outside bookings

Everything the garage admin does to bookings, capacity and services is already in the booking spec (US-BK-11 to US-BK-17, US-BK-19); these stories cover their records and reporting views.

**US-GAD-01 · Search operational records** (from GA4) As the garage admin, I want to search bookings and the vehicles on them, so that I can oversee day-to-day workshop activity.

1. *Given* I filter by date range, status, technician, bay or registration, *when* results load, *then* I see matching bookings with date, time, service, technician, bay, status and balance status.
2. *Given* I open a booking, *when* it has a customer vehicle, *then* I see that vehicle's details; for my own admin bookings I see the note (BR-46).
3. **[Sec]** *Given* any search input, *when* it is processed, *then* it is passed to the database as a parameter, never pasted into the query (SQL injection, NFR-SEC-02).

**US-GAD-02 · Review payments and invoices** (from GA5) As the garage admin, I want to see deposits, balances, settlements and refunds with their invoices, so that I can track revenue and check refunds went through.

1. *Given* I open Payments, *when* it loads, *then* I see each transaction's booking, type, status, amount and date, with a link to its invoice or credit note.
2. *Given* balances are OUTSTANDING or refunds FAILED, *when* I open my queues, *then* they are listed for action (F/C-4.1, F/C-8).
3. **[Sec]** *Given* any transaction, *when* it is shown, *then* the payment token is never displayed.

**US-GAD-03 · See a booking's history** As the garage admin, I want to see everything that happened to a booking, so that I can answer questions about it with certainty.

1. *Given* I open a booking's history, *when* it loads, *then* I see its audit events in order: who did what, when, from which state to which, and why (ERD §7).
2. **[Sec]** *Given* I am the garage admin, *when* I look for security events (sign-ins, lockouts), *then* they are not available to me; they belong to the tech admin.

## Break-glass super admin

In this sprint the super admin only restores admin access when the garage admin or tech admin account is breached or locked out; later sprints may give it combined powers (AD-08). Every sign-in is logged; in-app alerts are deferred (ERD §7).

**US-SA-01 · Sign in for an emergency** (from SA1) As the break-glass super admin, I want to sign in with my password, an emailed code and the offline recovery code, so that admin access can be restored when it is lost.

1. *Given* the correct password, *when* I submit it at staff.example.com/login, *then* a code is sent to the dedicated break-glass mailbox, and with that code plus the recovery code held offline by the garage and tech admins a super admin session starts.
2. **[Sec]** *Given* any one of the three factors is missing or wrong, *when* I submit, *then* sign-in fails with the generic message and counts toward lockout.
3. **[Sec]** *Given* the break-glass mailbox, *when* it is set up, *then* it is separate from every garage admin and tech admin mailbox, so a compromised admin mailbox cannot also receive break-glass codes (AD-14).
4. **[Sec]** *Given* any super admin sign-in, successful or not, *when* it happens, *then* it is recorded as a security event.

**US-SA-02 · Restore admin access** As the super admin, I want to recover or lock down the garage admin and tech admin accounts, so that the garage regains control after a breach or lockout.

1. *Given* a garage admin or tech admin account, *when* I disable it, re-enable it or send it a password-reset link, *then* the change applies and all that account's sessions end.
2. *Given* customers, technicians, bookings or money, *when* I look for actions on them, *then* none are available in this sprint (AD-08).

**US-SA-03 · Close the emergency** As the super admin, I want the recovery code replaced after use, so that a code seen during an emergency cannot be used again.

1. *Given* I have finished, *when* I sign out, *then* the recovery code is replaced: a new one is shown once for the garage and tech admins to store offline, and the old one stops working (AD-09).
2. **[Sec]** *Given* the super admin's own password or email address, *when* anyone else tries to change them, *then* it is refused; only the super admin can change them (US-STF-04).

## Application-wide security requirements

These 16 requirements apply to every page and API, so they are written once here instead of in every story; each has a test that proves it. They replace SEC1–SEC3 from the original draft. Technical choices follow AD-11.

| ID | Requirement | How we test it | From |
| --- | --- | --- | --- |
| NFR-SEC-01 | The server checks role and record ownership on every request; hiding buttons in the interface is never the control | Call staff and other-customer endpoints with a customer session → 403 + security event | SEC1 |
| NFR-SEC-02 | Every input is validated on the server for type, length and format; all database queries are parameterised | SQL metacharacters in search and form fields are treated as plain text | Draft: inputs validated |
| NFR-SEC-03 | All user-supplied text is escaped when displayed; a Content-Security-Policy blocks inline scripts | A name such as `<script>` shows as literal text in the staff portal | New |
| NFR-SEC-04 | Session IDs are random (at least 128 bits), stored hashed, sent in `HttpOnly`, `Secure`, `SameSite` cookies scoped to their own portal (app.example.com or staff.example.com, never the parent domain), and replaced at sign-in | The session cookie is unreadable from JavaScript; a customer cookie is never sent to the staff portal; a pre-sign-in session ID no longer works after sign-in | SEC3 |
| NFR-SEC-05 | Rate limits on sign-in, registration, password-reset requests, emailed-code requests, checkout start, payment attempts and availability lookups | Bursts beyond the limit return 429 (values AD-10) | SEC3, MS-BK-06, MS-BK-11 |
| NFR-SEC-06 | Passwords are hashed with Argon2id and a unique salt, and never logged or returned | The database holds only hashes; logs contain no passwords | Draft |
| NFR-SEC-07 | Staff sign-in codes are 6 random digits sent by email, valid 10 minutes, single-use, stored only as a hash, and cancelled when a new code is requested; wrong codes count toward lockout | A used, expired or replaced code is rejected | Draft: mandatory staff MFA |
| NFR-SEC-08 | Every state-changing request carries a CSRF token | A form posted from another site is rejected | New |
| NFR-SEC-09 | HTTPS only, with HSTS; plain HTTP redirects to HTTPS | No page is served over HTTP | New |
| NFR-SEC-10 | Security headers on every response: CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, a strict `Referrer-Policy` | Header check passes on every route; pages cannot be framed (clickjacking) | New |
| NFR-SEC-11 | Secrets (database credentials, gateway secret, email service credentials, encryption keys) live in environment configuration, never in source code or the repository | A secrets scan of the repository finds none | New |
| NFR-SEC-12 | Gateway tokens are encrypted at rest; every emailed link and code (verification, activation, reset, sign-in) is random, single-use, time-limited and stored only as a hash | Raw database rows show ciphertext or hashes only | ERD §1, §5 |
| NFR-SEC-13 | Errors show users a generic message; stack traces and internal details go only to logs | Forcing an error shows no stack trace | New |
| NFR-SEC-14 | The application's database account has no schema rights and only INSERT/SELECT on log tables | DDL and log updates from the app account fail | ERD §7 |
| NFR-SEC-15 | Dependencies are pinned and scanned for known vulnerabilities before each release | The release checklist shows a clean `npm audit` or equivalent | New |
| NFR-SEC-16 | Booking and payment operations are atomic and logged as the booking spec and ERD define | Covered by BR-12, BR-17, BR-18, BR-44 and ERD §7 | SEC2, SEC3 |

## Application-wide misuse stories

Fifteen attacker goals target sign-in, accounts and staff administration; booking-specific misuse stays in the booking spec (MS-BK-01 to MS-BK-12).

| ID | Attacker wants to… | Mitigation | Test |
| --- | --- | --- | --- |
| MS-APP-01 | Take over accounts by trying passwords leaked from other sites (credential stuffing) | Lockout (US-AUTH-02), rate limits (NFR-SEC-05), common-password check (US-AUTH-01) | Sixth wrong password in a row → account locked |
| MS-APP-02 | Find out which emails have accounts | Identical responses for sign-in, registration and password-reset whether or not the account exists (US-AUTH-01, US-AUTH-02, US-AUTH-08); rate limits | Existing and unknown emails give identical responses |
| MS-APP-03 | Steal a session cookie through injected script | Escaping and CSP (NFR-SEC-03); `HttpOnly` cookies (NFR-SEC-04); idle timeout (US-AUTH-06) | `document.cookie` cannot read the session |
| MS-APP-04 | Plant a known session ID before the victim signs in (session fixation) | New session ID at sign-in (NFR-SEC-04) | Pre-sign-in ID is rejected after sign-in |
| MS-APP-05 | Become staff by adding a role field to registration or profile requests (mass assignment) | Server accepts only listed fields; role fixed to CUSTOMER (US-AUTH-01) | Registration with `role=TECH_ADMIN` creates a customer |
| MS-APP-06 | Reach staff pages or APIs with a customer account | Portal separation and portal-scoped cookies (US-AUTH-02, US-AUTH-03, NFR-SEC-04); server role checks (NFR-SEC-01) | Customer session on a staff API → 403 |
| MS-APP-07 | Trick a signed-in admin's browser into cancelling or refunding bookings (CSRF) | CSRF tokens and `SameSite` cookies (NFR-SEC-08) | Cross-site form post → rejected |
| MS-APP-08 | Run script in a staff member's browser through a customer name or vehicle model (stored XSS) | Output escaping and CSP (NFR-SEC-03) | Script in a name renders as text in the staff portal |
| MS-APP-09 | (Insider) a tech admin promotes themselves or takes over the super admin | No self role changes; super admin cannot be reset or assigned (US-STF-03, US-STF-04) | Self role change and super admin reset → refused + logged |
| MS-APP-10 | (Insider) a tech admin takes over a customer's account through a password reset | Resets only email a link to the account's own address; the tech admin never sees a password and cannot change the address (US-STF-04) | Every reset appears in the security log with the actor; the link goes only to the registered email |
| MS-APP-11 | Send phishing links that bounce through our sign-in page to a fake site (open redirect) | Only same-site relative return paths (US-PUB-02) | `?next=https://evil.example` is ignored |
| MS-APP-12 | Skip the emailed code by calling staff pages straight after the password step | Until the code is accepted the session can reach only the code page (US-AUTH-03) | Any other page from the half-signed-in state → back to the code page |
| MS-APP-13 | Guess a staff sign-in code | Wrong codes count toward lockout; codes expire in 10 minutes and are single-use (NFR-SEC-07) | Five wrong codes → account locked |
| MS-APP-14 | Frame admin pages in a hidden page to trick clicks (clickjacking) | `frame-ancestors 'none'` (NFR-SEC-10) | Staff page inside an iframe → refused by the browser |
| MS-APP-15 | Reuse a verification, activation or reset link found in an old email or a forwarded message | Links are single-use, expire (AD-13) and are cancelled when the password changes (NFR-SEC-12) | A used or expired link → rejected |

## Traceability from the original draft

Every story in the team's original draft now maps to a final story, a security requirement, or the deferred support feature.

| Original | Now | Note |
| --- | --- | --- |
| G1 | US-PUB-01 |  |
| G2 | US-PUB-02 | Adds open-redirect protection |
| C1 | US-AUTH-01, US-AUTH-02, US-AUTH-05, US-AUTH-08 | Split into register, sign in, sign out, password reset |
| C2 | US-ACC-01, US-ACC-02 | Email change split out (needs password) |
| C3 | US-ACC-03 |  |
| C4 | US-VEH-01 to US-VEH-03 |  |
| C5 | US-BK-01 to US-BK-03 | Booking spec |
| C6 | US-BK-04, US-BK-05 | Booking spec |
| C7 | US-BK-07 | Booking spec |
| C8 | US-BK-08 | Booking spec |
| C9 | Deferred | Support tab |
| Staff sign-in | US-AUTH-03, US-AUTH-04, US-AUTH-05 |  |
| T1, T2 | US-BK-09 | Booking spec |
| T3 | US-BK-10 | Booking spec |
| S1, S2 | Deferred | Support tab |
| GA1 | US-BK-11, US-BK-17 | Booking spec |
| GA2 | US-BK-12 | Booking spec |
| GA3 | US-BK-13 | Booking spec |
| GA4 | US-GAD-01 |  |
| GA5 | US-GAD-02 |  |
| TA1 | US-STF-01 to US-STF-03, US-BK-18 | Probation dropped |
| TA2 | US-STF-04, US-AUTH-03, NFR-SEC-07 | Credential reset and mandatory staff MFA |
| TA3 | US-STF-06 | Scope proposed in AD-06 |
| TA4 | US-STF-05 |  |
| SA1 | US-SA-01 to US-SA-03 |  |
| SEC1 | NFR-SEC-01 |  |
| SEC2 | NFR-SEC-16 | Via BR-12 and BR-18 |
| SEC3 | NFR-SEC-04, NFR-SEC-05, NFR-SEC-16 |  |

## Open decisions

All fourteen decisions are settled; three (AD-05, AD-11, AD-12) were changed by the team. IDs start with AD so they never clash with the booking spec's D-01 to D-10.

| ID | Question | Proposal | Used by | Team decision |
| --- | --- | --- | --- | --- |
| AD-01 | Password policy | At least 12 characters and not on a common-password list; no forced mix of character types | US-AUTH-01, US-AUTH-07 | Agreed |
| AD-02 | Lockout | 5 failures in a row lock the account for 15 minutes | US-AUTH-02, US-AUTH-03 | Agreed |
| AD-03 | Staff activation lifetime | 72 hours | US-AUTH-04 | Agreed (now an activation link rather than a temporary password) |
| AD-04 | Session timeouts | Idle: 30 min customers, 15 min staff. Absolute: 12 h customers, 8 h staff | US-AUTH-06 | Agreed |
| AD-05 | Forgotten passwords | Customer contacts the garage; tech admin issues a temporary password | US-AUTH-08 | Changed: customers reset their own password through an emailed link |
| AD-06 | Tech admin and payments (TA3) | Monitor only: view transactions and gateway reachability; no money actions; secrets stay in configuration | US-STF-06 | Agreed |
| AD-07 | Lockout protection | A tech admin cannot disable or re-role themselves, or disable the last active tech admin | US-STF-02, US-STF-03 | Agreed |
| AD-08 | Super admin powers | Only restore garage admin and tech admin access | US-SA-02 | Agreed for this sprint; later sprints may combine powers |
| AD-09 | Recovery code after use | Replaced at sign-out; new code shown once for offline storage | US-SA-03 | Agreed |
| AD-10 | Rate limit values | Sign-in: 5 per minute per account and 20 per minute per IP. Registration: 5 per hour per IP. Checkout starts: 10 per hour per customer. Failed payments: 5 per 10 minutes per customer. Availability: 60 per minute per user | NFR-SEC-05 | Agreed |
| AD-11 | Technical choices | Argon2id for passwords; TOTP authenticator apps; `SameSite=Lax` cookies for customers and `Strict` for staff; synchroniser CSRF tokens | NFR-SEC-04, -06, -07, -08 | Changed: emailed sign-in codes instead of TOTP; the rest agreed |
| AD-12 | Email verification at registration | Not in this iteration | US-AUTH-01 | Changed: registration emails a verification link |
| AD-13 | Email link and code lifetimes | Staff sign-in code: 10 minutes. Password-reset link: 30 minutes. Verification link: 24 hours. Staff activation: 72 hours (AD-03) | US-AUTH-01, -03, -04, -08, US-STF-04 | Agreed |
| AD-14 | Break-glass mailbox | A dedicated mailbox for super admin codes, separate from every admin mailbox | US-SA-01 | Agreed |

**ERD change approved and applied:** ERD §1 now has `email_verified_at` on USER and an EMAIL_TOKEN table for hashed one-time links and codes, replacing the authenticator secret (see the change log in ERD §1).

## Change log

| Date | Change |
| --- | --- |
| 25 Nov 2026 | First version of the application-wide stories. |
| 25 Nov 2026 | Team decisions applied: emailed sign-in codes replace authenticator apps; registration email verification; self-service customer password reset; activation and reset links replace temporary passwords; portal addresses added; AD-01 to AD-14 settled. US-ACC-02 now verifies a new email address before switching to it. |