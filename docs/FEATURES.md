# PaisaWise feature delivery status

This single commit adds working offline budgets, goal creation, monthly reports, recurring-payment heuristics, and transaction search/filter UI with unit tests. Existing SMS/notification collectors, Gmail account selection, and dashboard remain.

**Not yet complete:** secure biometric app lock; Android background sync for both Gmail accounts; CSV export; interactive gesture-enabled charts; robust cross-channel duplicate detection; production MongoDB deployment and mobile sync; live AI recommendations. These require additional native integration, credentials or infrastructure, consent flows and device testing. The backend foundation exists in server/ but is not deployed. Do not present these as shipped features.

Google Sign-In has only one active session, so Gmail accounts are saved but not concurrently synchronized. The current offline insights remain rule-based. Never place MongoDB credentials or AI API keys in the APK.
