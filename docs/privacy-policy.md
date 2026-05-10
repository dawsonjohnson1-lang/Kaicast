# Privacy Policy

**Effective date:** 2026-05-09
**Last updated:** 2026-05-09

This Privacy Policy describes how KaiCast ("KaiCast", "we", "us", or "our") collects, uses, and shares information when you use the KaiCast mobile application (the "App") and related services (collectively, the "Service").

> **[REVIEW]** Replace "KaiCast" with the registered legal entity name before publishing (e.g. "KaiCast LLC"). Confirm effective date when you ship.

By using the Service, you agree to the collection and use of information as described in this Policy. If you do not agree, please do not use the Service.

---

## 1. Information We Collect

### 1.1 Information you provide

- **Account information.** Email address, password (handled and stored by Firebase Authentication; we never see plaintext passwords), display name, handle, and home dive spot.
- **Profile information.** Optional profile photo, home island, home town, dive certification level, preferred dive type, and birth year (where applicable).
- **Dive logs.** Date, time, duration, depth, location (named spot or custom coordinates you enter), surface conditions, current, visibility, group size, weapon (for spearfishing), notes, and any photos you attach.
- **Favorites and social graph.** The dive spots you mark as favorites and the other KaiCast users you follow / who follow you.

### 1.2 Information collected automatically

- **Device information.** Platform (iOS or Android), device model, OS version, app version, and a unique device identifier used for push notifications (an Expo push token).
- **Conditions snapshot.** When you submit a dive log for a known spot, we attach a snapshot of the live ocean and weather report for that spot at the time of submission. This lets you compare predicted vs. observed conditions later.
- **Diagnostic logs.** When something fails (a network call, a write error, a permission denial), we may record the error message and a stack trace via Google Cloud Logging. We do not attach this to your account unless investigation requires it.

### 1.3 Information from third parties

We retrieve ocean and weather conditions from public-data sources (NOAA, NDBC, Open-Meteo) and forecasts and map tiles from commercial providers (OpenWeather, Mapbox, ESRI). These calls are made server-side; the providers do not receive your user identity.

---

## 2. How We Use Information

We use the information we collect to:

- Provide the core Service: live ocean conditions, multi-day forecasts, dive logging, social features, and push notifications.
- Authenticate you and protect your account.
- Improve forecast accuracy by cross-referencing conditions snapshots with diver-reported observations on the same day at the same spot. Aggregate, anonymized correlations may inform future model refinements.
- Send transactional messages (security alerts, important account notices). We do not send marketing email.
- Send opt-in push notifications you have enabled in Settings. You can disable push at any time in your device's system Settings; we will retain your token only until your device reports it as unregistered.
- Diagnose and resolve technical issues.

We do **not** sell your personal information.

---

## 3. How We Share Information

### 3.1 Service providers (sub-processors)

We use the following third-party processors to operate the Service. Each is bound by data-processing terms requiring confidentiality and security commensurate with industry standards:

| Provider | Purpose | Data shared |
| --- | --- | --- |
| Google Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Functions) | Identity, database, file storage, server compute | Account, profile, logs, favorites, social graph, device tokens |
| Expo (push notification gateway) | Push delivery | Device push tokens, notification payload |
| Mapbox | Map tiles for the Explore map | Spot coordinates only (no user identity) |
| OpenWeather | Hourly forecast weather | Spot coordinates only |
| Open-Meteo Marine | 7-day wave forecast | Spot coordinates only (no user identity) |
| NOAA CO-OPS / NDBC | Tide and buoy observations | Public station IDs only |
| ESRI World Imagery | Satellite imagery tiles | Spot coordinates only |

> **[REVIEW]** If you sign Mapbox / OpenWeather / Expo paid plans with custom DPAs, link them here.

### 3.2 Other users

Information you choose to share — your display name, handle, profile photo, public dive logs, favorites count, and social graph — is visible to other users of the Service. Logs you mark as private (where supported) are visible only to you. Your email address and device tokens are never shown to other users.

### 3.3 Legal requirements

We may disclose information if compelled to do so by law (subpoena, court order, or government request) or where we have a good-faith belief that disclosure is necessary to: (a) protect or defend our rights or property; (b) protect the safety of users or the public; or (c) investigate fraud or security incidents.

### 3.4 Business transfers

If KaiCast is acquired or merged, your information may be transferred to the successor entity, subject to this Policy.

---

## 4. Data Retention

- Account information is retained while your account is active and for up to 90 days after deletion to allow account recovery and resolve abuse investigations.
- Dive logs and the conditions snapshots attached to them are retained while your account is active. Deleting a log removes both the log and its snapshot.
- Cached condition reports (the per-spot hourly cache used to keep the app fast) are retained for up to 30 days before purge.
- Server logs are retained for up to 30 days unless required for an active investigation.

You may request deletion of your account and associated data at any time (see Section 7).

---

## 5. Children's Privacy

The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us at the address below and we will delete it.

> **[REVIEW]** If you intend to allow users under 16 in any region, this section needs additional GDPR-K language and verifiable parental-consent flows.

---

## 6. Security

We use industry-standard safeguards including TLS in transit, encrypted Firebase Firestore at rest, password hashing handled by Firebase Authentication, and least-privilege Firestore security rules. No system is perfectly secure; we cannot guarantee absolute security but we will notify affected users of any breach involving personal information consistent with applicable law.

---

## 7. Your Rights

Depending on where you live, you may have rights with respect to your personal information including:

- The right to **access** the information we hold about you.
- The right to **correct** inaccurate information.
- The right to **delete** your account and personal information.
- The right to **export** your information in a portable format.
- The right to **object** to or **restrict** certain processing.
- The right to **withdraw consent** for processing where consent is the legal basis.

To exercise any of these rights, email **[REVIEW: privacy@kaicast.com]**. We will respond within 30 days.

### 7.1 California residents (CCPA / CPRA)

You have the right to know what categories of personal information we collect, to request deletion, and to opt out of "sale" or "sharing" of personal information. We do not sell or share personal information for cross-context behavioral advertising.

### 7.2 European Economic Area, UK, and Switzerland (GDPR / UK-GDPR)

The legal bases on which we rely include: performance of a contract (account and Service delivery), consent (push notifications, optional profile fields), and legitimate interests (security, fraud prevention, service improvement). You may lodge a complaint with your local supervisory authority. Our data controller of record is **[REVIEW: legal entity name and address]**.

---

## 8. Account and Data Deletion

You may delete your account from within the App (Settings → Account → Delete account) **[REVIEW: confirm in-app delete shipped]** or by emailing **[REVIEW: privacy@kaicast.com]** from the address associated with your account. Deletion is irreversible. After deletion, your dive logs, social graph, favorites, and device tokens are removed within 30 days. Aggregated analytics derived from your usage prior to deletion may be retained in a non-identifiable form.

---

## 9. International Transfers

KaiCast servers are operated by Google Cloud and may be located in regions outside your country of residence (primarily us-central1, Iowa, USA). Where required, we rely on Standard Contractual Clauses or equivalent transfer mechanisms approved by the relevant authorities.

---

## 10. Diving Safety Notice

KaiCast provides ocean condition forecasts derived from public buoy, weather, and tide data. **Forecasts can be wrong, sources can be delayed, and conditions can change rapidly.** Nothing in the Service is a substitute for in-person observation, proper training, current certification, dive planning, equipment checks, or the judgment of a qualified dive professional. **Diving is inherently dangerous and you assume all risk.** See our Terms of Service for further details.

---

## 11. Changes to This Policy

We may update this Policy from time to time. If we make material changes, we will notify you in-app and update the "Effective date" above. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.

---

## 12. Contact

Questions, requests, or complaints:

- **Email:** [REVIEW: privacy@kaicast.com]
- **Postal:** [REVIEW: company name and mailing address]

---

> **Reviewer checklist before publishing:**
>
> - [ ] Replace every `[REVIEW]` placeholder with real legal entity, address, and contact email.
> - [ ] Confirm effective date.
> - [ ] If you collect anything not listed in Section 1, add it.
> - [ ] If you add any sub-processor (analytics, crash reporting, marketing email), update Section 3.1.
> - [ ] Have a lawyer in your jurisdiction review before publishing — this draft is a starting point, not legal advice.
