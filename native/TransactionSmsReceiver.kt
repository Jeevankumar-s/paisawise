package com.paisawise

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

class TransactionSmsReceiver:BroadcastReceiver() {
 override fun onReceive(context:Context,intent:Intent) {
  if(intent.action!=Telephony.Sms.Intents.SMS_RECEIVED_ACTION)return
  val prefs=context.getSharedPreferences("paisawise_alerts",0)
  val since=prefs.getLong("sms_enabled_since",0L)
  if(since<=0)return
  val messages=Telephony.Sms.Intents.getMessagesFromIntent(intent)
  if(messages.isEmpty())return
  val text=messages.joinToString(""){it.messageBody ?: ""}.trim()
  val timestamp=messages.first().timestampMillis
  if(timestamp<since || text.length<12)return
  // Discard authentication messages without persisting them.
  if(Regex("(?i)\\b(otp|one.time password|verification code|login code|security code|passcode)\\b").containsMatchIn(text))return
  if(!Regex("(?i)(₹|\\bINR\\b|\\bRs\\.?\\s*[0-9])").containsMatchIn(text))return
  if(!Regex("(?i)\\b(debited|credited|spent|paid|received|withdrawn|deposited|refund|upi)\\b").containsMatchIn(text))return
  val sender=messages.first().originatingAddress ?: ""
  val id=MessageDigest.getInstance("SHA-256").digest((sender+"|"+timestamp+"|"+text).toByteArray()).take(16).joinToString(""){"%02x".format(it)}
  synchronized(TransactionNotificationService.lock) {
   val existing=JSONArray(prefs.getString("queue","[]"))
   for(i in 0 until existing.length())if(existing.getJSONObject(i).optString("id")==id)return
   existing.put(JSONObject().put("id",id).put("source","sms").put("text",text.take(500)).put("timestamp",timestamp))
   val trimmed=JSONArray()
   for(i in maxOf(0,existing.length()-150) until existing.length())trimmed.put(existing.get(i))
   prefs.edit().putString("queue",trimmed.toString()).apply()
  }
 }
}
