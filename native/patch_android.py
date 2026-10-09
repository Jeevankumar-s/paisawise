from pathlib import Path
import sys
root=Path(sys.argv[1])
main=root/"java/com/paisawise/MainApplication.kt"
s=main.read_text()
needle="PackageList(this).packages.apply {"
assert needle in s, "React Native MainApplication template changed"
s=s.replace(needle,needle+"\n              add(TransactionAlertsPackage())",1)
main.write_text(s)
manifest=root/"AndroidManifest.xml"
s=manifest.read_text()
needle="<application"
assert needle in s
s=s.replace("</application>",'''    <service
      android:name=".TransactionNotificationService"
      android:label="PaisaWise transaction alerts"
      android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
      android:exported="true">
      <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
      </intent-filter>
    </service>
  </application>''',1)
manifest.write_text(s)
