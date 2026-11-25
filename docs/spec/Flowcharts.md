# Booking ecosystem flowcharts v0.2

Draft Mermaid sources for every booking flow, rebuilt on the v0.2 specification. Every decision diamond cites the rule (BR) it implements, and every status change cites its transition (TR).

## Conventions

All flowcharts use the same five shapes, so a reviewer can check any diagram against the spec in one pass.

| Shape | Mermaid | Means |
| --- | --- | --- |
| Stadium | `([ ])` | Start or end; error ends state the HTTP code |
| Diamond | `{ }` | Decision, labelled with the BR it implements |
| Rectangle | `[ ]` | Action; status changes are written "TR-xx: status = X" |
| Hexagon | `{{ }}` | Gateway call, always outside any database transaction (BR-18) |
| Subgraph | `subgraph` | One database transaction: all of it commits or none of it does |

Three rules hold everywhere and are not redrawn in each chart:

- **Guarded transitions:** every status change only applies if the booking is still in the expected from-state. If no row changes, the flow ends with 409 Conflict and an audit entry.
- **Audit:** every transition and every transaction writes an audit entry (BR-44).
- **Server time:** every "now" is the database clock in the garage time zone (BR-45, CFG-01).

One new parameter is introduced here: **CFG-16, reconciliation threshold**, proposed at 10 minutes (used in F/C-6 and F/C-8). It needs adding to the Configuration table.

## F/C-1 Booking, hold, allocation and deposit

The booking is created as a hold in transaction 1, the card is charged outside any transaction, and the booking is confirmed in transaction 2 only if the hold and the technician are still valid. Covers US-BK-01 to US-BK-03, and US-BK-19 for a garage admin booking on a customer's behalf.

```mermaid
flowchart TD
    A(["Customer or garage admin picks vehicle and service"]) --> B["Availability: two bulk queries over 60 days<br/>BR-01, BR-02, BR-05; IDs stripped BR-09"]
    B --> C(["Picks date and start time,<br/>starts checkout"])
    C --> V1{"BR-01, BR-02: date and time valid?<br/>BR-13: service active, price from server"}
    V1 -- No --> E1(["400 + reason"])
    V1 -- Yes --> AC{"Who is booking?"}
    AC -- Customer --> V2{"SEC1: customer owns vehicle?"}
    V2 -- No --> E2(["403 + audit entry"])
    V2 -- Yes --> V3{"BR-08: under hold and booking caps?<br/>BR-07: vehicle free in window?"}
    V3 -- No --> E3(["409 + reason"])
    V3 -- Yes --> L1
    AC -- Garage admin --> VN{"BR-46: note names customer<br/>and registration?"}
    VN -- No --> E8(["400: note required"])
    VN -- Yes --> VH{"BR-08: no other open hold<br/>on this admin account?"}
    VH -- No --> E3
    VH -- Yes --> L1

    subgraph TXN1 ["DB transaction 1: hold and allocate, BR-12"]
        L1["Lock calendar_day row for the date"] --> C1{"BR-05: at least 1 bay and 1 technician<br/>free for the whole window?"}
        C1 -- No --> R1["Rollback"]
        C1 -- Yes --> B1["BR-10: lowest free active bay;<br/>lock its row, BR-12"]
        B1 --> T1["BR-11: free technician with least workload;<br/>ties broken by injectable random source"]
        T1 --> H1["TR-01: insert PENDING_PAYMENT<br/>snapshot service, price, duration, reg BR-30<br/>deposit and balance BR-19<br/>expires_at = now + CFG-09 BR-14"]
    end

    R1 --> E4(["Slot just taken: refresh slots"])
    H1 --> P0["Checkout page: countdown to server expires_at"]
    P0 --> U1{"Action"}
    U1 -- Abandons --> X1["BR-21, TR-03: status = EXPIRED"]
    X1 --> E5(["Slot released"])
    U1 -- Submits payment --> V4{"BR-15: still PENDING_PAYMENT<br/>and now at or before expires_at?"}
    V4 -- No --> E6(["Hold lapsed: nothing charged, start again"])
    V4 -- Yes --> TX1["DB: insert DEPOSIT transaction = PENDING<br/>key = booking + DEPOSIT, BR-17"]
    TX1 --> G1{{"Gateway: charge deposit, BR-18<br/>admin bookings: garage backup method, BR-46"}}
    G1 --> V5{"Charge result?"}
    V5 -- Failed --> F1["DB: transaction = FAILED<br/>TR-03: status = EXPIRED"]
    F1 --> E7(["Payment failed: slot released"])
    V5 -- Timeout or unknown --> REC(["Leave PENDING: F/C-8 reconciles"])
    V5 -- Succeeded --> V6{"BR-16, BR-32: hold still valid and<br/>assigned technician still free?"}
    V6 -- No --> LATE(["F/C-6 late-payment path"])
    V6 -- Yes --> CM1

    subgraph TXN2 ["DB transaction 2: confirm"]
        CM1["transaction = SUCCEEDED, store token BR-22<br/>TR-02: status = CONFIRMED, confirmed_at = now<br/>balance_status = DEPOSIT_PAID"] --> I1["Deposit invoice"]
    end

    I1 --> END1(["Booking confirmed"])
```

**What changed from your version:** date-row lock (EC-10), hold check before charging (EC-08), gateway outside the transactions (EC-09), vehicle and cap checks (EC-11, MS-BK-02), abandon exit, and the late-success branch.

## F/C-2.1 Customer self-cancellation

The slot is freed the moment the cancellation commits; the refund follows separately and can fail without undoing the cancellation. Covers US-BK-04 and US-BK-05.

```mermaid
flowchart TD
    S(["Customer clicks Cancel"]) --> V1{"SEC1: customer owns booking?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-23: status CONFIRMED or<br/>REASSIGNMENT_REQUIRED?"}
    V2 -- No --> E2(["409: cannot be cancelled"])
    V2 -- Yes --> V3{"BR-23: now minus confirmed_at<br/>within CFG-12?"}
    V3 -- No --> E3(["Self-cancel closed:<br/>show garage contact details, BR-25"])
    V3 -- Yes --> U1

    subgraph TXN1 ["DB transaction: cancel"]
        U1["TR-08 or TR-09: status = CUSTOMER_CANCELLED<br/>bay and technician released"] --> R0["Insert DEPOSIT_REFUND transaction = PENDING<br/>full deposit; key = booking + DEPOSIT_REFUND, BR-17"]
    end

    R0 --> G1{{"Gateway: refund deposit, BR-18"}}
    G1 --> V4{"Refund result?"}
    V4 -- Succeeded --> D1["transaction = SUCCEEDED<br/>credit note"]
    D1 --> END1(["Cancelled and refunded"])
    V4 -- Failed or unknown --> D2["BR-28: booking stays cancelled<br/>refund handled by F/C-8"]
    D2 --> END2(["Cancelled, refund pending"])
```

**What changed:** REASSIGNMENT\_REQUIRED path (EC-13), window from confirmed\_at (EC-07), refund outside the transaction with a failure path (EC-09), late-request exit (EC-05).

## F/C-2.2 Garage admin cancellation

The admin chooses the refund percentage and must give a reason; the refund then runs exactly as in F/C-2.1. Covers US-BK-13, including late cancellations customers raise with the garage by phone or email (BP-07).

```mermaid
flowchart TD
    S(["Garage admin enters reason and refund %"]) --> V1{"MS-BK-09: role = GARAGE_ADMIN?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-26: status CONFIRMED or<br/>REASSIGNMENT_REQUIRED?"}
    V2 -- No --> E2(["409: cannot be cancelled"])
    V2 -- Yes --> V3{"BR-26: reason given and<br/>refund % a whole number 0 to 100?"}
    V3 -- No --> E3(["400 + reason"])
    V3 -- Yes --> U1

    subgraph TXN1 ["DB transaction: cancel"]
        U1["TR-10: status = CANCELLED_ADMIN<br/>store reason and refund %<br/>bay and technician released"] --> D0{"Refund % above 0?"}
        D0 -- Yes --> R0["Insert DEPOSIT_REFUND = PENDING<br/>amount = deposit x % / 100, rounded to the penny<br/>key = booking + DEPOSIT_REFUND, BR-17"]
        D0 -- No --> N0["Record deposit forfeited"]
    end

    N0 --> END0(["Cancelled, no refund"])
    R0 --> G1{{"Gateway: refund, BR-18"}}
    G1 --> V4{"Refund result?"}
    V4 -- Succeeded --> D1["transaction = SUCCEEDED<br/>credit note"]
    D1 --> END1(["Cancelled and refunded"])
    V4 -- Failed or unknown --> D2["BR-28: booking stays cancelled<br/>refund handled by F/C-8"]
    D2 --> END2(["Cancelled, refund pending"])
```

**What changed:** "0 or 1 to 100" simplified to 0 to 100; reason mandatory; refund outside the transaction (EC-09).

## F/C-2.3 Goodwill refund (completed or no-show)

One refund screen serves completed jobs, no-shows and unresolved bookings. A booking can be refunded more than once, but the running total never exceeds what the gateway collected, and the booking's status never changes. Covers US-BK-14.

```mermaid
flowchart TD
    S(["Garage admin opens refund screen,<br/>enters refund % and reason"]) --> V1{"MS-BK-09: role = GARAGE_ADMIN?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-27: status COMPLETED, NO_SHOW<br/>or UNRESOLVED?"}
    V2 -- No --> E2(["409: use cancellation instead"])
    V2 -- Yes --> V3{"Reason given and refund %<br/>a whole number 1 to 100?"}
    V3 -- No --> E3(["400 + reason"])
    V3 -- Yes --> L1

    subgraph TXN1 ["DB transaction: check cap and record refund"]
        L1["Lock booking row"] --> V4{"BR-27: refunds so far + this refund<br/>within amount collected via gateway?"}
        V4 -- No --> R1["Rollback"]
        V4 -- Yes --> T1["Insert SERVICE_REFUND rows = PENDING, one per charge,<br/>balance first, then deposit, BR-27<br/>total = gateway-collected x % / 100, rounded to the penny<br/>key = booking + SERVICE_REFUND + sequence, BR-17"]
    end

    R1 --> E4(["400: over the refundable amount;<br/>refund any externally paid part outside the system"])
    T1 --> G1{{"Gateway: refund each row against its own charge,<br/>original token only, MS-BK-08"}}
    G1 --> V5{"Refund result?"}
    V5 -- Succeeded --> D1["transaction = SUCCEEDED<br/>credit note; status unchanged"]
    D1 --> END1(["Refund issued"])
    V5 -- Failed or unknown --> D2["Handled by F/C-8"]
    D2 --> END2(["Refund pending"])
```

The booking row is locked while the running total is checked, so two admins refunding at once cannot both pass V4. **What changed:** cumulative cap and original-token-only refunds (EC-15, MS-BK-08).

## F/C-3 Technician unavailability and reassignment

When a technician becomes unavailable, the system first moves each affected booking to another free technician; only bookings it cannot move are flagged for the garage admin. Covers US-BK-11, US-BK-12 and US-BK-18.

### F/C-3 Mark unavailable or disable

```mermaid
flowchart TD
    A(["Garage admin marks technician unavailable"]) --> V1{"BR-32: start before end<br/>and end after now?"}
    V1 -- No --> E1(["400 + reason"])
    V1 -- Yes --> W1["Save unavailability window<br/>technician excluded from new allocations, BR-06"]
    B(["Tech admin disables or re-roles technician"]) --> W2["BR-34: account no longer an active technician<br/>all future bookings affected"]
    W1 --> Q1["Find this technician's CONFIRMED bookings in the window<br/>holds are not flagged: re-checked at confirmation, BR-32"]
    W2 --> Q1
    Q1 --> V2{"Any found?"}
    V2 -- No --> END1(["Done"])
    V2 -- Yes --> LOOP["Take the next affected booking, soonest first"]
    LOOP --> L1

    subgraph TXN1 ["DB transaction per booking, BR-12"]
        L1["Lock calendar_day row"] --> V3{"BR-33: another technician free<br/>for the same window, same bay? BR-06"}
        V3 -- Yes --> M1["BR-11: pick least workload<br/>update technician; stays CONFIRMED"]
        V3 -- No --> F1["TR-04: status = REASSIGNMENT_REQUIRED"]
    end

    F1 --> AL["Alert garage admin; top of queue, BR-36"]
    M1 --> NX{"More bookings?"}
    AL --> NX
    NX -- Yes --> LOOP
    NX -- No --> END2(["Summary shown: moved vs flagged"])
```

### F/C-3.1 Resolve a flagged booking

```mermaid
flowchart TD
    S(["Garage admin opens a flagged booking, or a CONFIRMED one<br/>to make room, BR-47; contacts customer out of band"]) --> D{"Outcome?"}
    D -- Cancel --> C1(["F/C-2.2 admin cancellation"])
    D -- Customer cancels --> C2(["F/C-2.1, inside the window only"])
    D -- Reassign or reschedule --> V1{"Date or time changed?"}
    V1 -- Yes --> V2{"BR-35: passes BR-01 and BR-02,<br/>starts after now, BR-07 vehicle free?"}
    V2 -- No --> E1(["400 + reason"])
    V2 -- Yes --> L1
    V1 -- No --> L1

    subgraph TXN1 ["DB transaction, BR-12"]
        L1["Lock calendar_day rows: old and new date,<br/>earliest date first, BR-12"] --> V3{"Bay free in window, excluding self?<br/>keep current bay if free, else BR-10"}
        V3 -- No --> R1["Rollback"]
        V3 -- Yes --> V4{"BR-06: chosen technician free<br/>and not unavailable?"}
        V4 -- No --> R1
        V4 -- Yes --> U1["TR-05 if flagged: status = CONFIRMED<br/>update technician, bay and times"]
    end

    R1 --> E2(["Pick another technician or time"])
    U1 --> END1(["Booking confirmed again"])
```

If the unavailability window is later deleted, the original technician passes V4 again (EC-24). **What changed:** window validation, CONFIRMED-only flagging (EC-06), automatic move first (D-02), technician-disable entry point (EC-14), full re-validation on reschedule (EC-19).

## F/C-4 Completion and balance charge

The work is recorded as done before the balance is charged, so a failed charge only marks the balance OUTSTANDING and never leaves a finished job in limbo. Covers US-BK-10 and US-BK-15.

```mermaid
flowchart TD
    S(["Assigned technician submits work notes,<br/>clicks Complete"]) --> V1{"BR-37: booking technician = me?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-37: status = CONFIRMED<br/>and now at or after start?"}
    V2 -- No --> E2(["409: not yet started or not active"])
    V2 -- Yes --> U1

    subgraph TXN1 ["DB transaction 1: complete"]
        U1["TR-06: status = COMPLETED<br/>save service record to vehicle history, BR-38<br/>bay and technician released"] --> T1["Insert BALANCE transaction = PENDING<br/>amount = price minus deposit, BR-19<br/>key = booking + BALANCE, BR-17"]
    end

    T1 --> G1{{"Gateway: charge balance with stored token, BR-18"}}
    G1 --> V3{"Charge result?"}
    V3 -- Succeeded --> OK["transaction = SUCCEEDED<br/>balance_status = SETTLED<br/>balance invoice"]
    OK --> END1(["Completed and settled"])
    V3 -- Failed --> FL["transaction = FAILED<br/>balance_status = OUTSTANDING<br/>appears in admin settlement queue"]
    FL --> END2(["Completed, balance outstanding: F/C-4.1"])
    V3 -- Timeout or unknown --> REC(["Leave PENDING: F/C-8 reconciles"])
```

### F/C-4.1 Manual settlement

```mermaid
flowchart TD
    S(["Garage admin collects balance outside the system,<br/>enters reference"]) --> V1{"MS-BK-09: role = GARAGE_ADMIN?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-39: balance_status = OUTSTANDING?"}
    V2 -- No --> E2(["409: nothing outstanding"])
    V2 -- Yes --> V3{"BR-39: external reference provided?"}
    V3 -- No --> E3(["400 + reason"])
    V3 -- Yes --> T1

    subgraph TXN1 ["DB transaction: settle"]
        T1["Insert MANUAL_SETTLEMENT = SUCCEEDED<br/>processed_by = admin ID, reference"] --> U1["balance_status = SETTLED<br/>balance invoice"]
    end

    U1 --> END1(["Settled"])
```

The manual amount is not refundable through the gateway (BR-27). **What changed:** start-time check (EC-21), work saved before charging, COMPLETED\_PAYMENT\_FAILED replaced by balance OUTSTANDING (D-06), idempotent charge (EC-09).

## F/C-5 No-show

A booking the customer never turns up for is closed as NO\_SHOW: the deposit is kept and the balance is never charged. Covers US-BK-16.

```mermaid
flowchart TD
    S(["Garage admin marks booking as no-show"]) --> V1{"MS-BK-09: role = GARAGE_ADMIN?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-40: status = CONFIRMED?"}
    V2 -- No --> E2(["409: not active"])
    V2 -- Yes --> V3{"BR-40: now at or after<br/>start + CFG-15?"}
    V3 -- No --> E3(["409: too early to mark"])
    V3 -- Yes --> U1

    subgraph TXN1 ["DB transaction"]
        U1["TR-07: status = NO_SHOW<br/>bay and technician released<br/>balance_status stays DEPOSIT_PAID: no balance due"]
    end

    U1 --> END1(["Closed as no-show, deposit kept"])
```

**New flow** (EC-04).

The kept deposit can still be returned later as a goodwill refund through F/C-2.3, for example when the customer had a valid reason.

## F/C-6 Scheduled jobs and late payment

One scheduled job releases lapsed holds and marks flagged bookings UNRESOLVED once their start time has passed; the late-payment path confirms a paid booking if a slot is still free and refunds it in full otherwise.

### F/C-6.1 Scheduled sweep (every minute)

```mermaid
flowchart TD
    S(["Scheduler tick"]) --> Q1["Find PENDING_PAYMENT bookings<br/>with expires_at before now, BR-20"]
    Q1 --> V1{"Deposit transaction still PENDING?<br/>payment in flight"}
    V1 -- Yes --> K1["Skip: F/C-8 reconciles after CFG-16"]
    V1 -- No --> U1["TR-03: status = EXPIRED"]
    K1 --> Q2
    U1 --> Q2["Find REASSIGNMENT_REQUIRED bookings<br/>whose start time has passed, BR-36"]
    Q2 --> V2{"Any found?"}
    V2 -- No --> END1(["Done until next tick"])
    V2 -- Yes --> U2["TR-11: status = UNRESOLVED<br/>bay and technician released<br/>no automatic refund"]
    U2 --> N1["Stays in admin queue for follow-up;<br/>any refund through F/C-2.3"]
    N1 --> END1
```

Skipping holds with a payment in flight is what lets the late-payment path below rely on the booking still being PENDING\_PAYMENT.

### F/C-6.2 Late payment (from F/C-1)

```mermaid
flowchart TD
    S(["Deposit succeeded, but the hold lapsed<br/>or the technician became unavailable"]) --> L1

    subgraph TXN1 ["DB transaction, BR-12"]
        L1["Lock calendar_day row"] --> V1{"BR-16, BR-05: a bay and a technician free<br/>for the same window, excluding self?"}
        V1 -- Yes --> A1["Keep current bay and technician if free,<br/>else BR-10 and BR-11"]
        A1 --> C1["transaction = SUCCEEDED, store token<br/>TR-02: status = CONFIRMED, confirmed_at = now<br/>deposit invoice"]
        V1 -- No --> X1["transaction = SUCCEEDED<br/>TR-03: status = EXPIRED<br/>insert DEPOSIT_REFUND = PENDING, full amount, BR-17"]
    end

    C1 --> END1(["Booking confirmed"])
    X1 --> G1{{"Gateway: refund deposit, BR-18"}}
    G1 --> V2{"Refund result?"}
    V2 -- Succeeded --> D1["transaction = SUCCEEDED, credit note"]
    D1 --> END2(["Customer told: slot gone, fully refunded"])
    V2 -- Failed or unknown --> END3(["F/C-8 handles refund"])
```

**New flows** (EC-08, EC-20).

## F/C-7 Late cancellation request (deferred with support)

Not built in this iteration: late cancellations go through the garage by phone or email (BP-07). Kept for when support returns. After the self-cancel window, the customer raises a request through support; the booking does not change until a garage admin decides. Covers US-BK-06.

```mermaid
flowchart TD
    S(["Customer clicks Request cancellation"]) --> V1{"SEC1: customer owns booking?"}
    V1 -- No --> E1(["403 + audit entry"])
    V1 -- Yes --> V2{"BR-25: status CONFIRMED or REASSIGNMENT_REQUIRED<br/>and self-cancel window closed?"}
    V2 -- No --> E2(["409: use Cancel instead, or not active"])
    V2 -- Yes --> V3{"Open cancellation request<br/>already exists for this booking?"}
    V3 -- Yes --> E3(["409: request already open"])
    V3 -- No --> R1["Create support request, type = CANCELLATION,<br/>linked to booking; booking unchanged"]
    R1 --> SUP["Support staff review, read-only on booking (S2),<br/>forward to garage admin"]
    SUP --> V4{"Booking still CONFIRMED<br/>when admin decides?"}
    V4 -- No --> VOID["Close request as void"]
    VOID --> END0(["Customer told why"])
    V4 -- Yes --> D{"Garage admin decision"}
    D -- Approve --> A1(["F/C-2.2 with chosen refund %"])
    D -- Decline --> X1["Reply on support request;<br/>booking unchanged"]
    X1 --> END1(["Request closed"])
```

**New flow** (EC-05).

## F/C-8 Payment failure and reconciliation

Every transaction that failed or has stayed PENDING longer than CFG-16 ends up here; nothing is ever retried. An unknown outcome is looked up with the gateway, and a failed refund is completed outside the system and recorded.

```mermaid
flowchart TD
    S(["Transaction FAILED, or PENDING<br/>older than CFG-16"]) --> V1{"Status?"}
    V1 -- PENDING --> G0{{"Gateway: look up outcome by idempotency key<br/>a lookup, not a new attempt"}}
    G0 --> V2{"Gateway outcome?"}
    V2 -- Succeeded --> OK(["Apply the success branch of the original flow:<br/>F/C-1, F/C-6.2, F/C-2.x or F/C-4"])
    V2 -- Failed or not found --> M1["transaction = FAILED"]
    M1 --> V3
    V1 -- FAILED --> V3{"Transaction type?"}
    V3 -- DEPOSIT --> D1["TR-03: status = EXPIRED if still PENDING_PAYMENT"]
    D1 --> END1(["Slot released; customer may book again"])
    V3 -- BALANCE --> B1["balance_status = OUTSTANDING"]
    B1 --> END2(["F/C-4.1 manual settlement"])
    V3 -- DEPOSIT_REFUND or SERVICE_REFUND --> Q1["Admin refund queue, BR-28"]
    Q1 --> R2["Garage admin refunds outside the system<br/>new refund row = SUCCEEDED: external reference,<br/>admin ID, no gateway ref; replaces the failed row,<br/>which then leaves the queue"]
    R2 --> I2["Credit note"]
    I2 --> END3(["Refunded"])
```

**New flow** (EC-09). No transaction is ever retried. Retries and chargebacks stay out of scope for now.
