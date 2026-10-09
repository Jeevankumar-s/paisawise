# Personal Gmail OAuth setup for PaisaWise

This is for a private sideloaded Android app. Do not commit secrets or send anyone your Gmail password.

1. Open https://console.cloud.google.com/ and create a project, e.g. PaisaWise Personal.
2. In **APIs & Services > Library**, enable **Gmail API**.
3. In **Google Auth Platform > Branding**, configure an external app with your email as contact. In **Audience**, add your own Gmail address as a test user. In **Data access**, add `https://www.googleapis.com/auth/gmail.readonly`. Google may show a testing/unverified-app warning; read the consent screen carefully.
4. In **Clients**, create an **Android** OAuth client with package name `com.paisawise` and the SHA-1 fingerprint of the APK signing certificate. For the current GitHub Actions React Native template, check the Gradle signing config used for release; do not guess the fingerprint. Use `keytool -printcert -jarfile app-release.apk` to inspect the signed APK. The fingerprint must match the certificate used to install your build.
5. Also create a **Web application** OAuth client in the same Google Cloud project. Copy its **Client ID** (not the secret). Paste this ID into PaisaWise's Gmail connection field.
6. Sign in and grant the Gmail read-only scope. The app stores its connection start timestamp locally and only queries messages after that time.

Google Sign-In may require additional Android configuration depending on the plugin version and Google Cloud settings. OAuth setup and Android sign-in must be tested on the signed device build. Gmail read-only is a restricted Google scope, and Google's verification policies may apply even for a personal test application. Keep the OAuth app in Testing and add your account as a test user.

Privacy: Gmail content is fetched directly from Gmail to the app; there is no PaisaWise backend. The app stores parsed transactions locally, not raw Gmail message bodies. It does not ask for your Google password. The Google Sign-In library manages its own sign-in state.

Limitations: This is an initial integration, not a completed verified production Gmail connector. It polls while the app is active rather than using background push notifications. Gmail API results may miss some messages; transactions that arrive in both SMS and Gmail can still appear twice. Do not rely on this app for authoritative financial records.
