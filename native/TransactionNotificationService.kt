package com.paisawise

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

class TransactionNotificationService: NotificationListenerService() {
 companion object { val lock=Any() }
 override fun onNotificationPosted(sbn:StatusBarNotification?) {
  if(sbn==null)return
  val prefs=getSharedPreferences("paisawise_alerts",0)
  val since=prefs.getLong("enabled_since",0L)
  if(since==0L || sbn.postTime<since)return
  val packageName=sbn.packageName ?: return
  if(packageName==applicationContext.packageName)return
  val extras=sbn.notification?.extras ?: return
  val title=extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
  val body=extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
   ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
  val text=(title+" "+body).trim().take(500)
  if(text.length<12)return
  // Restrict collection to transaction-like alerts; never store OTP or verification codes.
  if(Regex("(?i)\\b(otp|one.time password|verification code|login code|security code)\\b").containsMatchIn(text))return
  if(!Regex("(?i)(₹|\\bINR\\b|\\bRs\\.?\\s*[0-9])").containsMatchIn(text))return
  if(!Regex("(?i)\\b(debited|credited|spent|paid|received|withdrawn|deposited|refund|transaction|upi)\\b").containsMatchIn(text))return
  val digest=MessageDigest.getInstance("SHA-256").digest((packageName+"|"+sbn.key+"|"+sbn.postTime+"|"+text).toByteArray())
  val id=digest.take(16).joinToString(""){"%02x".format(it)}
  synchronized(lock) {
   val existing=JSONArray(prefs.getString("queue","[]"))
   for(i in 0 until existing.length())if(existing.getJSONObject(i).optString("id")==id)return
   val item=JSONObject().put("id",id).put("source",packageName).put("text",text).put("timestamp",sbn.postTime)
   existing.put(item)
   val trimmed=JSONArray()
   for(i in maxOf(0,existing.length()-150) until existing.length())trimmed.put(existing.get(i))
   prefs.edit().putString("queue",trimmed.toString()).apply()
  }
 }
}
