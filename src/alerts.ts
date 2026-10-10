import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const bridge=NativeModules.TransactionAlerts;
const KEY='transactions';
const IDKEY='paisawise_notification_ids';
export const available=Boolean(bridge);
export async function getStatus(){return bridge?bridge.getStatus():{enabled:false,permissionGranted:false}}
export async function getSmsStatus(){return bridge?bridge.getSmsStatus():{enabled:false,permissionGranted:false}}
export async function enableSms(){if(!bridge)throw new Error('SMS tracking is unavailable');return bridge.enableSms()}
export async function enable(){if(!bridge)throw new Error('Notification tracking is unavailable in this build');await bridge.enableTracking();return bridge.openNotificationSettings()}
export async function syncFutureAlerts(parseBankSms:any){
 if(!bridge)return {added:0};
 const status=await bridge.getStatus();
 const sms=await bridge.getSmsStatus();
 if((!status.enabled||!status.permissionGranted)&&!sms.enabled)return {added:0};
 const pending=JSON.parse(await bridge.getPending());
 if(!Array.isArray(pending)||pending.length===0)return {added:0};
 const existingRaw=await AsyncStorage.getItem(KEY);
 const rows=existingRaw?JSON.parse(existingRaw):[];
 if(!Array.isArray(rows))throw new Error('Stored transactions are invalid');
 const seenRaw=await AsyncStorage.getItem(IDKEY);
 const seen=new Set<string>(seenRaw?JSON.parse(seenRaw):[]);
 const acknowledged:string[]=[];
 let added=0;
 for(const item of pending){
  if(!item||typeof item.id!=='string')continue;
  if(seen.has(item.id)){acknowledged.push(item.id);continue}
  const parsed=parseBankSms(item.text);
  if(parsed){
   if(!rows.some((r:any)=>r.id===item.id)){
    rows.unshift({...parsed,id:item.id,source:item.source||'sms',timestamp:Number(item.timestamp)||Date.now(),description:parsed.description});
    added++;
   }
  }
  seen.add(item.id);acknowledged.push(item.id);
 }
 await AsyncStorage.setItem(KEY,JSON.stringify(rows));
 await AsyncStorage.setItem(IDKEY,JSON.stringify(Array.from(seen).slice(-1500)));
 await bridge.acknowledge(JSON.stringify(acknowledged));
 return {added};
}
