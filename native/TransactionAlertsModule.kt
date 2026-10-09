package com.paisawise

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.core.content.ContextCompat
import androidx.core.app.ActivityCompat
import org.json.JSONArray

class TransactionAlertsModule(private val context: ReactApplicationContext): ReactContextBaseJavaModule(context) {
  override fun getName() = "TransactionAlerts"

  @ReactMethod fun enableTracking(promise: Promise) {
    val prefs=context.getSharedPreferences("paisawise_alerts",0)
    prefs.edit().putLong("enabled_since",System.currentTimeMillis()).apply()
    promise.resolve(true)
  }

  @ReactMethod fun enableSms(promise: Promise) {
    val activity=context.currentActivity
    if(activity==null){promise.reject("ACTIVITY","Open PaisaWise to grant SMS permission");return}
    if(ContextCompat.checkSelfPermission(context,Manifest.permission.RECEIVE_SMS)==PackageManager.PERMISSION_GRANTED){
      context.getSharedPreferences("paisawise_alerts",0).edit().putLong("sms_enabled_since",System.currentTimeMillis()).apply()
      promise.resolve(true)
    }else{
      ActivityCompat.requestPermissions(activity,arrayOf(Manifest.permission.RECEIVE_SMS),7401)
      promise.resolve(false)
    }
  }

  @ReactMethod fun getSmsStatus(promise:Promise) {
    val granted=ContextCompat.checkSelfPermission(context,Manifest.permission.RECEIVE_SMS)==PackageManager.PERMISSION_GRANTED
    val prefs=context.getSharedPreferences("paisawise_alerts",0)
    val since=prefs.getLong("sms_enabled_since",0L)
    // A user who grants permission in Android settings must explicitly opt in to tracking.
    val result=com.facebook.react.bridge.Arguments.createMap()
    result.putBoolean("permissionGranted",granted)
    result.putBoolean("enabled",granted&&since>0)
    promise.resolve(result)
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
