# KAICAST API LICENSE AGREEMENT

**Effective Date:** [DATE]  
**Agreement Version:** 1.0.0

This API License Agreement ("Agreement") is entered into as of the Effective Date by and between:

**KaiCast:** KaiCast, LLC, a Hawaii limited liability company, with its principal place of business at 91-1051 Laulauna St #3B, Ewa Beach, HI 96706 ("KaiCast")

and

**Licensee:** [COMPANY / INDIVIDUAL NAME], with its principal place of business at [Licensee Address] ("Licensee")

---

## 1. DEFINITIONS

"**API**" means KaiCast's application programming interface, including all endpoints, data feeds, webhooks, and associated developer tools, as described in the API Documentation.

"**API Documentation**" means KaiCast's technical documentation for the API, available at [docs.kaicast.com] or as otherwise provided, as updated from time to time.

"**API Key**" means the unique authentication credentials issued to Licensee for accessing the API.

"**Condition Data**" means ocean conditions scores, environmental data, site information, and related data accessible through the API.

"**Licensee Application**" means the software application, website, or service developed by Licensee that integrates with the API, as identified in the applicable Order Form.

"**Order Form**" means the signed order document specifying the license scope, permitted use, quota, fees, and term.

"**Quota**" means the maximum number of API calls permitted per day or per month, as set forth in the Order Form.

---

## 2. LICENSE GRANT

**2.1 Grant.** Subject to the terms of this Agreement and payment of all Fees, KaiCast grants Licensee a limited, non-exclusive, non-transferable, non-sublicensable license during the Term to:

(a) Access the API using Licensee's API Key;  
(b) Retrieve Condition Data from the API; and  
(c) Display, reproduce, and incorporate Condition Data into the Licensee Application, **solely for the purpose described in the Order Form**.

**2.2 Permitted Use Types.** The Order Form will specify one of the following permitted use scopes:

- **Internal Use:** Licensee may use Condition Data solely within Licensee's own internal systems and operations, and may not display Condition Data to end users.
- **Customer-Facing Display:** Licensee may display Condition Data within the Licensee Application to Licensee's own registered end users.
- **Redistribution:** Licensee may redistribute Condition Data to its own customers as a data feed, subject to the additional restrictions in Section 3.3 and applicable redistribution fees.

---

## 3. RESTRICTIONS

**3.1 General Restrictions.** Licensee may not:

(a) Share, publish, or disclose API Keys to any third party;  
(b) Use the API to build, train, or improve a competing ocean conditions product or algorithm;  
(c) Cache or store Condition Data beyond the caching period specified in the API Documentation (default: 15 minutes), except as expressly permitted in writing;  
(d) Modify, alter, or misrepresent Condition Data in a way that could mislead end users regarding actual ocean conditions;  
(e) Use the API to send data to KaiCast in excess of applicable rate limits;  
(f) Scrape, crawl, or access the API in ways not described in the API Documentation;  
(g) Use Condition Data in any safety-critical system that makes automated decisions without human review; or  
(h) Remove or obscure any KaiCast attribution requirements set forth in Section 4.

**3.2 Scope Restriction.** The license applies only to the Licensee Application identified in the Order Form. Use of the API in additional applications requires a separate license or written approval from KaiCast.

**3.3 Redistribution Restrictions.** If redistribution is permitted by the Order Form, Licensee must: (a) ensure its end user agreement prohibits further redistribution of Condition Data; (b) include KaiCast's required disclaimer language (see Section 5) in all end user displays; and (c) not represent Condition Data as proprietary to Licensee.

---

## 4. ATTRIBUTION

Unless waived in writing by KaiCast, Licensee must display the following attribution in any user-facing interface that displays Condition Data:

> *"Ocean conditions data powered by KaiCast"*

Attribution must be clearly legible and link to [www.kaicast.com] where technically feasible. KaiCast reserves the right to update attribution requirements with 60 days' written notice.

---

## 5. REQUIRED SAFETY DISCLAIMER

In any user-facing interface displaying Condition Scores, Licensee must display language substantially similar to the following:

> *"Condition scores are provided for informational purposes only. They are not a guarantee of safety and do not substitute for on-site evaluation by a trained professional. Ocean conditions change rapidly. Always assess conditions on-site before entering the water."*

KaiCast may update required disclaimer language; Licensee must implement updates within 60 days of notice.

---

## 6. API QUOTAS AND RATE LIMITS

**6.1 Quota.** Licensee's API access is subject to the Quota specified in the Order Form. Calls exceeding the Quota may be throttled or blocked.

**6.2 Rate Limits.** The API enforces rate limits as described in the API Documentation (default: [X] calls per minute per API Key). Sustained rate limit violations may result in temporary or permanent API Key suspension.

**6.3 Overage.** If Licensee's API usage exceeds the Quota, KaiCast may: (a) charge overage fees at the rate specified in the Order Form; or (b) throttle API access to the Quota limit. KaiCast will provide notice before charging overage fees.

**6.4 Fair Use.** Licensee agrees to use the API in a manner consistent with its intended purpose and will not take actions designed to artificially inflate API call counts.

---

## 7. API VERSIONING AND DEPRECATION

**7.1 Versioning.** KaiCast uses semantic versioning for the API. KaiCast will use commercially reasonable efforts to maintain backward compatibility within major API versions.

**7.2 Deprecation Notice.** KaiCast will provide at least **90 days' written notice** before deprecating any API endpoint or making a breaking change. Major version transitions may require Licensee to update its integration.

**7.3 No Guaranteed Availability.** KaiCast does not guarantee that any specific API endpoint, data field, or feature will be available indefinitely. The API may be updated, changed, or discontinued with appropriate notice.

---

## 8. FEES AND PAYMENT

**8.1 Fees.** Licensee agrees to pay the Fees set forth in the Order Form. Fee structures may be based on API call volume, data tier, use type, or a combination thereof.

**8.2 Billing.** KaiCast will invoice Licensee monthly or annually as specified in the Order Form. Payment is due within 30 days of invoice date.

**8.3 Late Payment.** Unpaid amounts accrue interest at 1.5% per month. KaiCast may suspend API access for non-payment after 15 days' written notice.

**8.4 Price Changes.** KaiCast may adjust pricing at renewal with at least 60 days' notice.

---

## 9. INTELLECTUAL PROPERTY

**9.1 KaiCast Ownership.** The API, Condition Data, scoring algorithms, and all KaiCast intellectual property remain the sole property of KaiCast. This Agreement does not transfer any ownership interest to Licensee.

**9.2 Licensee Ownership.** Licensee retains ownership of the Licensee Application, excluding any KaiCast components.

**9.3 Feedback.** Licensee grants KaiCast a perpetual, royalty-free license to use any feedback, suggestions, or ideas submitted by Licensee regarding the API.

---

## 10. AUDIT RIGHTS

KaiCast may, upon 10 business days' written notice and no more than once per calendar year, audit Licensee's API usage logs and integration to verify compliance with this Agreement. Licensee will reasonably cooperate with any audit.

---

## 11. DISCLAIMER OF WARRANTIES

THE API AND ALL CONDITION DATA ARE PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. KAICAST DOES NOT WARRANT THAT CONDITION DATA IS ACCURATE, COMPLETE, OR TIMELY, OR THAT THE API WILL BE UNINTERRUPTED OR ERROR-FREE. CONDITION DATA IS DERIVED FROM THIRD-PARTY SOURCES THAT MAY BE DELAYED OR UNAVAILABLE.

---

## 12. LIMITATION OF LIABILITY

KAICAST'S TOTAL LIABILITY TO LICENSEE FOR ALL CLAIMS UNDER THIS AGREEMENT SHALL NOT EXCEED THE FEES PAID BY LICENSEE IN THE 12 MONTHS PRECEDING THE CLAIM. IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.

---

## 13. INDEMNIFICATION

Licensee will indemnify, defend, and hold harmless KaiCast from third-party claims arising from: (a) Licensee's use of the API in violation of this Agreement; (b) the Licensee Application; (c) Licensee's end users' reliance on Condition Data; or (d) Licensee's failure to include required attribution or safety disclaimers.

---

## 14. TERM AND TERMINATION

**14.1 Term.** This Agreement commences on the Effective Date and continues for the initial term specified in the Order Form, renewing automatically unless terminated.

**14.2 Termination for Convenience.** Either Party may terminate with 30 days' written notice.

**14.3 Termination for Cause.** KaiCast may terminate immediately for: (a) Licensee's use of the API in a prohibited manner; (b) material breach not cured within 15 days of notice; or (c) non-payment.

**14.4 Effect of Termination.** API Keys are revoked immediately upon termination. Licensee must cease all use of the API and remove Condition Data from the Licensee Application within 30 days.

---

## 15. GENERAL PROVISIONS

**15.1 Governing Law.** This Agreement is governed by the laws of the State of Hawaii.

**15.2 Dispute Resolution.** Disputes shall be resolved by binding arbitration under AAA Commercial Rules.

**15.3 Entire Agreement.** This Agreement and the Order Form constitute the entire agreement between the Parties regarding API access.

**15.4 Assignment.** Licensee may not assign this Agreement without KaiCast's written consent. KaiCast may assign freely in connection with a business transfer.

**15.5 Notices.** Notices must be in writing and sent to the addresses in the Order Form.

---

**KAICAST LLC**

Signature: _________________________ Date: _____________  
Name: _____________________________  
Title: ______________________________

**LICENSEE**

Signature: _________________________ Date: _____________  
Name: _____________________________  
Title: ______________________________  
Company: __________________________

---

*Review with qualified legal counsel before use.*
