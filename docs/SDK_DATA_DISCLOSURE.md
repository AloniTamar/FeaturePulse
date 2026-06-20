# FeaturePulse SDK — Google Play Data Safety Disclosure

Use this to fill out the Data Safety section in Google Play Console for apps that integrate FeaturePulse.

## Data collected

| Data type (Play category) | Collected? | Shared with 3rd parties? | Encrypted in transit? | User can request deletion? | Purpose |
|--------------------------|-----------|--------------------------|----------------------|---------------------------|---------|
| App interactions | Yes | No | Yes (HTTPS/TLS) | Yes | Analytics |
| App info and performance (crash logs) | No | — | — | — | — |
| Device or other IDs | Yes (random UUID only, not hardware ID) | No | Yes | Yes | Analytics |

## Data NOT collected by FeaturePulse

Location, contacts, personal info (name, email, address), financial info, health info, photos, files, audio, video.

## Data retention

- Raw interaction events: deleted after the retention period set by the app developer (default 7 days, minimum 1 day)
- Aggregated statistics: retained until the app developer deletes their FeaturePulse account

## User consent responsibilities

App developers integrating FeaturePulse are responsible for:
1. Disclosing FeaturePulse data collection in their own app's privacy policy
2. Complying with applicable privacy laws (GDPR, CCPA, etc.) for their user base
3. Providing a mechanism for users to request data deletion (FeaturePulse supports this via account deletion)
