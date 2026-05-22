# KaiCast Legal Document Checklist
**Status:** Pre-launch working draft — review with licensed counsel before use  
**Jurisdiction framing:** Hawaii-first launch; all documents drafted for geographic scalability

---

## 1. Terms of Service (ToS)

### 1.1 Scope & Acceptance
- [ ] Effective date and versioning strategy (semantic: v1.0.0)
- [ ] Acceptance mechanism (explicit checkbox on account creation, not implied by use)
- [ ] Age requirement (13+ COPPA minimum; 18+ if selling subscriptions directly)
- [ ] Mechanism for notifying users of material changes (email + in-app banner, 30-day notice minimum)

### 1.2 Service Description
- [ ] Platform described as an **informational tool only** — not a safety advisory service
- [ ] Explicit list of what the platform does: aggregates publicly available environmental data, displays user-submitted reports, generates algorithmic condition scores
- [ ] What the platform does NOT do: guarantee conditions are safe, substitute for trained dive instruction, replace on-site judgment

### 1.3 User Accounts
- [ ] Account creation requirements and accurate information obligation
- [ ] User responsibility for account security
- [ ] Prohibited account sharing (relevant for subscription tier enforcement)
- [ ] Account suspension and termination policy (including what triggers it)

### 1.4 User-Generated Content (Dive Reports) — Critical Section
- [ ] Users grant KaiCast a **worldwide, royalty-free, sublicensable, perpetual license** to use, display, reproduce, distribute, and create derivative works from submitted reports
- [ ] Users warrant they have the right to submit the content (no third-party IP in photos, etc.)
- [ ] Platform right (not obligation) to remove or moderate any UGC
- [ ] Users retain ownership of their original content
- [ ] UGC may be used to improve the platform's scoring models — disclose this explicitly
- [ ] Reports are not verified by KaiCast; posted "as submitted" with timestamp and conditions data
- [ ] Prohibition on false, misleading, or fabricated reports
- [ ] No expectation of privacy for publicly submitted reports

### 1.5 Condition Scoring & Liability Disclaimers — Critical Section
- [ ] Scoring algorithm is **proprietary and algorithmic** — not certified by any governmental or diving authority
- [ ] Scores are derived from third-party data sources (NOAA, NDBC, OpenWeather) which may be delayed, inaccurate, or unavailable
- [ ] No representation that scores reflect actual real-time conditions at any given moment
- [ ] Ocean conditions change rapidly and unpredictably — scores may be outdated by time of dive
- [ ] **Explicit disclaimer**: KaiCast scores are not a substitute for on-site evaluation by a trained professional
- [ ] Users assume full responsibility for all dive decisions
- [ ] KaiCast is not a medical, safety, or rescue service
- [ ] Platform not responsible for injuries, death, property damage, or loss arising from reliance on scores or reports
- [ ] Force majeure clause covering data outages, NOAA downtime, etc.

### 1.6 Prohibited Conduct
- [ ] No scraping, crawling, or automated data extraction without written authorization
- [ ] No reverse engineering of scoring algorithms
- [ ] No impersonation of other users, divemasters, or marine authorities
- [ ] No submitting reports for locations you did not personally visit
- [ ] No commercial use of platform data without a data licensing agreement

### 1.7 Intellectual Property
- [ ] KaiCast owns all platform IP, scoring models, branding, and aggregated data products
- [ ] User license to use the platform is non-exclusive, non-transferable, revocable
- [ ] Feedback submitted by users (feature requests, bug reports) may be used without compensation or attribution

### 1.8 Subscription Terms
- [ ] Subscription tiers defined by reference (link to pricing page, not hardcoded in ToS)
- [ ] Auto-renewal disclosure (must be prominent under FTC guidelines and Apple/Google store rules)
- [ ] Cancellation policy (how to cancel, when cancellation takes effect)
- [ ] No prorated refunds on partial billing periods (or define your policy explicitly)
- [ ] Price change notice requirement (30 days recommended)

### 1.9 Limitation of Liability
- [ ] Cap on total liability (typical: fees paid in last 12 months)
- [ ] Exclusion of consequential, indirect, incidental, punitive damages
- [ ] Mutual indemnification clause
- [ ] User indemnifies KaiCast for claims arising from their UGC or platform misuse

### 1.10 Dispute Resolution
- [ ] Governing law: **[State TBD — use Delaware or your state of incorporation rather than Hawaii specifically, for scalability]**
- [ ] Mandatory arbitration clause (AAA or JAMS rules) with class action waiver
- [ ] Small claims carve-out
- [ ] 30-day informal dispute resolution period before arbitration
- [ ] Jury trial waiver

### 1.11 Geographic & Regulatory Scope
- [ ] Service available in US initially; reserve right to expand or restrict by geography
- [ ] No affiliation with Hawaii DLNR, NOAA, Coast Guard, or any government agency (disclaim any implied endorsement)
- [ ] Compliance with applicable export laws for API/data licensing outside US

---

## 2. Privacy Policy

### 2.1 Identity & Contact
- [ ] Legal entity name and state of incorporation
- [ ] Physical address and privacy contact email (required for CCPA, GDPR)
- [ ] Effective date and version number
- [ ] Link to prior versions / change log

### 2.2 Data Collected
- [ ] **Account data**: name, email, password hash, profile photo
- [ ] **Dive report data**: location, depth, conditions ratings, photos, notes, timestamps
- [ ] **Device & usage data**: IP address, device ID, OS version, app version, session data
- [ ] **Location data**: GPS coordinates (if permission granted for spot recommendations)
- [ ] **Payment data**: transaction IDs, subscription tier (NOT raw card data — Stripe/payment processor handles this)
- [ ] **Communication data**: support tickets, emails, feedback forms
- [ ] **Inferred data**: diving frequency, spot preferences, behavioral patterns used for recommendations

### 2.3 How Data Is Used
- [ ] Delivering and personalizing the service
- [ ] Improving scoring models (aggregate, anonymized)
- [ ] Processing payments and managing subscriptions
- [ ] Sending transactional emails (account, subscription, alerts)
- [ ] Marketing communications (with opt-out)
- [ ] Safety and fraud prevention
- [ ] Aggregate analytics for B2B partners (hotel SaaS, tour operators) — **no PII shared without consent**
- [ ] Legal compliance

### 2.4 Data Sharing
- [ ] Service providers (Firebase/GCP, Stripe, email provider, analytics)
- [ ] B2B partners receive **aggregated, anonymized** data only — explicitly state no individual user data is sold
- [ ] Law enforcement / legal process
- [ ] Business transfers (merger/acquisition clause)
- [ ] No sale of personal data (required language for CCPA compliance)

### 2.5 Data Retention
- [ ] Account data: retained for life of account + [X] years post-deletion
- [ ] Dive reports: indefinite unless user deletes (discuss with counsel)
- [ ] Usage/analytics data: rolling 24-month window
- [ ] Payment records: 7 years (IRS standard)

### 2.6 User Rights
- [ ] Access and portability (data export)
- [ ] Correction of inaccurate data
- [ ] Deletion ("right to be forgotten") — with carve-outs for legal holds
- [ ] Opt-out of marketing
- [ ] Opt-out of profiling / behavioral data use
- [ ] Non-discrimination for exercising privacy rights (CCPA requirement)
- [ ] Response timeline: 30 days (CCPA) / 30 days (GDPR if applicable later)

### 2.7 Security
- [ ] Encryption in transit (TLS 1.2+) and at rest
- [ ] Firebase security rules overview (reference, not detail)
- [ ] No system is fully secure — standard disclaimer
- [ ] Breach notification procedure and timeline (72 hours under GDPR; state laws vary)

### 2.8 Cookies & Tracking
- [ ] What cookies are used and why (strictly necessary vs. analytics vs. marketing)
- [ ] How to opt out (browser settings, cookie banner)
- [ ] Do Not Track signal handling

### 2.9 Geographic Scope Notes
- [ ] Currently serving US users; international expansion will trigger additional compliance review
- [ ] CCPA compliance active (California users)
- [ ] GDPR compliance **not required at launch** but structure data practices to accommodate later (document legal basis for processing, honor DSARs promptly)
- [ ] Hawaii has no standalone state privacy law as of 2024 — CCPA standards are a safe baseline

---

## 3. Commercial Agreements

### 3.1 Hotel / Resort SaaS Agreement (TMHelperAgent)
- [ ] Software-as-a-service grant (non-exclusive, non-transferable license to access platform)
- [ ] Permitted use: display conditions data to guests and staff within hotel property/systems
- [ ] Prohibited use: redistribution, resale, white-labeling without written agreement
- [ ] SLA commitments: uptime target, maintenance windows, support response times
- [ ] Data ownership: hotel guest data stays with hotel; KaiCast owns all platform and aggregated data
- [ ] No PII about hotel guests flows to KaiCast without explicit DPA
- [ ] Integration specifications by reference (API docs, not embedded in contract)
- [ ] Customization scope: what the hotel can and cannot modify in the UI
- [ ] Fees: fixed monthly/annual fee per property; volume discounts for multi-property groups
- [ ] Term and auto-renewal (12-month initial, annual renewal)
- [ ] Termination for cause (non-payment, breach, insolvency)
- [ ] Effect of termination: data export window (30 days), then deletion
- [ ] Mutual NDA embedded or separate
- [ ] Limitation of liability: cap at 12 months of fees paid; no consequential damages
- [ ] Governing law: **[State of incorporation, not Hawaii-specific]** — important for scaling nationally

### 3.2 Tour Operator Data Agreement
- [ ] Framed primarily as a **data partnership** (operators contribute real-time condition confirmations; KaiCast provides platform and exposure)
- [ ] Operator data license: grants KaiCast perpetual, royalty-free right to use submitted condition data in aggregated scoring
- [ ] KaiCast provides: operator listing on platform, co-branded condition widgets (if applicable), monthly aggregated data reports
- [ ] Operator represents: submitted data is based on firsthand observation, not fabricated
- [ ] Operator is NOT an agent or employee of KaiCast; independent contractor relationship explicit
- [ ] Revenue share terms (if applicable) or flat fee structure
- [ ] Liability: KaiCast not responsible for bookings, tours, safety outcomes from operator listings
- [ ] Operator indemnifies KaiCast for claims arising from their tours or submitted data
- [ ] Term: month-to-month with 30-day notice to terminate
- [ ] Geographic clause: agreement covers current operating regions; expandable by written addendum

### 3.3 API / Data Licensing Agreement
- [ ] License grant: access to KaiCast API endpoints and/or data feeds (define scope)
- [ ] Use restrictions: internal use only vs. redistribution vs. building derived products
- [ ] Rate limits, quotas, and fair use policy
- [ ] Attribution requirements (if applicable)
- [ ] Prohibited use: competitive services, resale without written approval
- [ ] API versioning and deprecation notice policy (minimum 90 days)
- [ ] SLA: uptime target, data freshness guarantees (or explicit disclaimer of same)
- [ ] Pricing: per-call, per-seat, or data volume tiers
- [ ] Audit rights: KaiCast may audit usage logs for compliance
- [ ] Termination: immediate for misuse; 30 days notice otherwise
- [ ] Governing law: state of incorporation

---

## 4. Payment Terms & Refund Policy

### 4.1 Consumer Subscriptions
- [ ] All prices in USD; taxes added at checkout where applicable
- [ ] Billing cycle: monthly or annual, as selected at purchase
- [ ] Auto-renewal is **on by default** — Apple/Google App Store rules require prominent disclosure
- [ ] Free trial terms: what's included, when billing begins, how to cancel before charge
- [ ] **Refund policy**: no refunds on partial billing periods (or define 7-day window — pick one and be consistent with App Store rules)
- [ ] App Store purchases: refunds governed by Apple/Google policy; KaiCast cannot issue refunds for store purchases
- [ ] Direct (web) purchases: refund requests to [support email] within [X] days of charge
- [ ] Subscription pausing (if feature offered)
- [ ] What happens on cancellation: access through end of billing period
- [ ] Failed payment handling: grace period, retry schedule, account downgrade

### 4.2 B2B / SaaS Invoicing
- [ ] Net 30 payment terms standard for annual contracts
- [ ] Late payment: 1.5% monthly interest or maximum allowed by law
- [ ] Disputed invoices: written notice within 15 days; undisputed portion still due
- [ ] Currency: USD; international clients bear FX risk
- [ ] Purchase orders: KaiCast may require a PO for contracts above $[X]
- [ ] Taxes: customer responsible for applicable taxes in their jurisdiction

---

## 5. Supplemental Documents

### 5.1 Acceptable Use Policy (AUP)
- [ ] Prohibited content in dive reports (graphic violence, spam, false safety information)
- [ ] No use of platform to facilitate illegal activities (e.g., poaching, accessing protected marine areas)
- [ ] Enforcement: warning → temporary suspension → permanent ban
- [ ] Reporting mechanism for AUP violations

### 5.2 Cookie Policy
- [ ] Standalone or embedded in Privacy Policy
- [ ] Category breakdown: strictly necessary / functional / analytics / marketing
- [ ] Consent mechanism (for GDPR regions, later)
- [ ] Third-party cookies (Google Analytics, Firebase, etc.)

### 5.3 Data Processing Agreement (DPA)
- [ ] Required for any B2B customer who may send you personal data of their customers or employees
- [ ] GDPR-aligned structure even if not legally required at launch — sets you up for EU expansion
- [ ] Defines KaiCast as data processor, hotel/operator as data controller
- [ ] Sub-processor list (GCP, Stripe, etc.)
- [ ] Security measures by reference to Privacy Policy
- [ ] Data breach notification: 72 hours to controller

### 5.4 DMCA Policy
- [ ] Designated DMCA agent registered with US Copyright Office ($6 fee, do it before launch)
- [ ] Takedown request process (written notice requirements)
- [ ] Counter-notice process
- [ ] Repeat infringer termination policy

---

## 6. Scalability Notes for Counsel
*Flags to raise with your attorney to avoid lock-in to Hawaii-only framing:*

- **Governing law**: Use state of incorporation (likely Delaware or wherever you form your LLC/corp) — not Hawaii. This is standard and avoids conflicts as you expand.
- **Jurisdiction clauses**: Arbitration venue should be neutral (e.g., San Francisco or virtual), not Honolulu.
- **Regulatory references**: Avoid citing specific Hawaii statutes by name in core ToS/Privacy Policy. Reference "applicable law" instead, with Hawaii-specific compliance handled in a separate addendum if needed.
- **DLNR / Marine Sanctuary language**: Any disclaimer referencing Hawaii DLNR or specific Hawaii marine protected areas should live in a platform FAQ or help center — not baked into the ToS — so it's easy to update as you expand to other states.
- **Data residency**: Don't commit to Hawaii-based servers in your Privacy Policy. GCP region is fine to leave as a backend decision.
- **"Ocean conditions" scope**: Define the service as covering "coastal and ocean environments" rather than "Hawaii waters" — future-proofed for any coastal market.
- **Operator agreements**: Use "operating region" as a variable concept rather than naming Hawaii.

---

## 7. Launch Readiness Checklist

| Document | Drafted | Legal Review | Finalized | Live |
|---|---|---|---|---|
| Terms of Service | | | | |
| Privacy Policy | | | | |
| Cookie Policy | | | | |
| Refund Policy | | | | |
| DMCA Agent Registration | | | | |
| Hotel SaaS Agreement | | | | |
| Tour Operator Agreement | | | | |
| API License Agreement | | | | |
| Data Processing Agreement | | | | |
| Acceptable Use Policy | | | | |

---

*This checklist is a working framework and does not constitute legal advice. Review all documents with a licensed attorney familiar with SaaS, maritime/recreational liability, and multi-state consumer law before publishing.*
