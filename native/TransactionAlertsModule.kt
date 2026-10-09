package com.paisawise

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray

class TransactionAlertsModule(private val context: ReactApplicationContext): ReactContextBaseJavaModule(context) {
  override fun getName() = "TransactionAlerts"

  @ReactMethod fun enableTracking(promise: Promise) {
    val prefs=context.getSharedPreferences("paisawise_alerts",0)
    prefs.edit().putLong("enabled_since",System.currentTimeMillis()).apply()
    promise.resolve(true)
  }

  @ReactMethod fun getStatus(promise: Promise) {
    val prefs=context.getSharedPreferences("paisawise_alerts",0)
    val enabled=prefs.getLong("enabled_since",0L)>0
    val component=android.content.ComponentName(context, TransactionNotificationService::class.java)
    val allowed=android.service.notification.NotificationListenerService::class.java.let {
      androidx.core.app.NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }
    val result=com.facebook.react.bridge.Arguments.createMap()
    result.putBoolean("enabled",enabled)
    result.putBoolean("permissionGranted",allowed)
    promise.resolve(result)
  }

  @ReactMethod fun openNotificationSettings(promise: Promise) {
    try {
      val intent=Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(true)
    } catch(e: Exception){promise.reject("SETTINGS",e)}
  }

  @ReactMethod fun getPending(promise: Promise) {
    val prefs=context.getSharedPreferences("paisawise_alerts",0)
    promise.resolve(prefs.getString("queue","[]") ?: "[]")
  }

  @ReactMethod fun acknowledge(idsJson:String,promise:Promise) {
    try {
      val ids=JSONArray(idsJson)
      val seen=(0 until ids.length()).map { ids.getString(it) }.toSet()
      val prefs=context.getSharedPreferences("paisawise_alerts",0)
      synchronized(TransactionNotificationService.lock) {
        val arr=JSONArray(prefs.getString("queue","[]"))
        val kept=JSONArray()
        for(i in 0 until arr.length()){
          val item=arr.getJSONObject(i)
          if(item.optString("id") !in seen)kept.put(item)
        }
        prefs.edit().putString("queue",kept.toString()).apply()
      }
      promise.resolve(true)
    }catch(e:Exception){promise.reject("ACK",e)}
  }
}
