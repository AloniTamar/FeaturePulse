# FeaturePulse Privacy Policy

Last updated: 2026-06-19

## What data we collect

The FeaturePulse SDK collects the following data from end-users of apps that integrate it:

| Data | Description |
|------|-------------|
| UI interaction events | Element type, screen name, event type (tap/impression), timestamp |
| Session ID | Random UUID generated per app session — not linked to any user account |
| Device ID | Random UUID generated on first SDK init — not a hardware identifier |

The FeaturePulse web portal collects: email address and password hash (bcrypt) for account authentication.

## What we do NOT collect

- Real names, phone numbers, or government IDs
- Hardware device identifiers (IMEI, MAC address, advertising ID)
- Location data
- Photos, contacts, or files
- Any data about end-users' identities

## How data is used

Raw interaction events are used solely to compute aggregated UI health metrics (interaction rate, feature state). Raw events are automatically deleted after the configured retention period (default: 7 days). Aggregated statistics are retained until the app developer deletes their account.

## Who we share data with

| Provider | Purpose | DPA |
|----------|---------|-----|
| Railway | Server hosting + PostgreSQL database | railway.app/legal/privacy |
| OpenRouter | AI insights (only if enabled per-app) | openrouter.ai/privacy |

## Your rights

- **Right to erasure:** Delete your account via the portal (Settings → Delete Account). This permanently deletes all apps, features, events, and aggregates.
- **Data portability:** Export your feature data as CSV from the portal Features page.
- **Contact:** tamaraloni11@gmail.com

## Jurisdiction

This policy is governed by the laws of Israel.
