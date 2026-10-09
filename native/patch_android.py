from pathlib import Path
import sys

root = Path(sys.argv[1])
main = root / "java/com/paisawise/MainApplication.kt"
s = main.read_text()
needle = "PackageList(this).packages.apply {"
assert needle in s, "React Native MainApplication template changed"
s = s.replace(needle, needle + "\n              add(TransactionAlertsPackage())", 1)
main.write_text(s)

manifest = root / "AndroidManifest.xml"
s = manifest.read_text()
assert "<application" in s
s = s.replace("<application", '<uses-permission android:name="android.permission.RECEIVE_SMS" />\n  <application', 1)
s = s.replace("</application>", """    <service
      android:name=".TransactionNotificationService"
      android:label="PaisaWise transaction alerts"
      android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
      android:exported="true">
      <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
      </intent-filter>
    </service>
    <receiver
      android:name=".TransactionSmsReceiver"
      android:exported="true"
      android:permission="android.permission.BROADCAST_SMS">
      <intent-filter>
        <action android:name="android.provider.Telephony.SMS_RECEIVED" />
      </intent-filter>
    </receiver>
  </application>""", 1)
manifest.write_text(s)

# Replace default React Native launcher artwork with PaisaWise icon.
s = manifest.read_text()
s = s.replace('android:icon="@mipmap/ic_launcher"', 'android:icon="@drawable/paisawise_icon"')
s = s.replace('android:roundIcon="@mipmap/ic_launcher_round"', 'android:roundIcon="@drawable/paisawise_icon"')
manifest.write_text(s)
