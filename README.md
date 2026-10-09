# PaisaWise

Privacy-first personal expense tracker for Android built with Expo and React Native.

## Features in version 0.1
- Dashboard with manually entered credits and debits
- Local SQLite transaction database
- Income, expenses, recorded net savings and savings rate
- Categorization and basic rules-based spending insights
- Pure bank SMS parsing helper with unit tests (not connected to the Android SMS inbox)
- GitHub Actions Android debug APK build

## Limitations
SMS inbox permissions/reading and Gmail OAuth are not yet implemented. The app does not connect to bank accounts. Net savings are based on recorded transactions, not actual account balances. Insights are budgeting heuristics, not personalized investment advice.

## Development
Requires Node.js 22, Android SDK and Java 17.
```sh
npm install
npm test
npm start
npx expo prebuild --platform android --non-interactive
cd android
./gradlew assembleDebug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions
The `Android debug APK` workflow runs on pushes to main or manually from Actions. Once a run succeeds, download the `PaisaWise-debug-apk` artifact from that run. This is a debug APK, not a signed release.
