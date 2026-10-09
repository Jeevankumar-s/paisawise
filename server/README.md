# PaisaWise private backend (optional)

The Android app currently stores transactions on-device with AsyncStorage. This folder is a backend foundation for **opt-in** MongoDB synchronization and privacy-preserving spending insights. It is **not deployed or connected to the APK yet**.

## Setup

Use a private MongoDB Atlas database, a Google OAuth Web client ID matching your app, and a Node 22+ server. Copy `.env.example` to `.env` on your server and populate values there. Never commit credentials, Gmail tokens, signing keys, or your MongoDB URI.

Run `npm install && npm start` from `server/`. Expose the API only over HTTPS. Authenticate each request with a short-lived Google ID token in the `Authorization: Bearer <id_token>` header; the server verifies Google's signature and audience and scopes data by the stable Google subject ID. This is distinct from the Gmail API access token.

Endpoints: `GET /health`, `GET /transactions`, `POST /transactions/sync`, `DELETE /transactions/:id`, `GET /insights`.

MongoDB stores normalized transaction data, not Gmail message bodies or SMS content beyond the transaction description submitted by the app. The optional AI provider receives **only aggregates**, not personal transaction descriptions or email content. AI provider API access may not be free; the server falls back to deterministic advice without an API key.

Before enabling cloud sync in the app, add user-visible opt-in, encryption/privacy disclosures, robust offline retry, account mapping, conflict handling and device testing. Never silently upload the existing local transaction history. Only sync transactions after explicit opt-in. Keep the old APK installed until migration is verified.
