import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

const SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const CONFIG_KEY='paisawise.gmail.webClientId';
const ACCOUNTS_KEY='paisawise.gmail.accounts.v2';
const ACTIVE_KEY='paisawise.gmail.active.v2';
const START_KEY='paisawise.gmail.startedAt';
const SEEN_KEY='paisawise.gmail.seenIds';
type Account={email:string;startedAt:number;seenIds:string[]};
let currentEmail='';
let syncing=false;
async function accounts():Promise<Account[]>{
 const raw=await AsyncStorage.getItem(ACCOUNTS_KEY);
 if(!raw)return [];
 try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(a=>a&&typeof a.email==='string'&&Number.isFinite(a.startedAt)):[]}catch(_){return []}
}
export async function listGmailAccounts(){return accounts()}
export async function activeGmailAccount(){return (await AsyncStorage.getItem(ACTIVE_KEY))||''}
async function saveAccounts(value:Account[]){await AsyncStorage.setItem(ACCOUNTS_KEY,JSON.stringify(value))}

const TX_KEY='transactions';
let configuredId='';

export async function configureGmail(webClientId:string){
 const id=webClientId.trim();
 if(!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id))throw new Error('Enter a valid Google OAuth Web client ID');
 await AsyncStorage.setItem(CONFIG_KEY,id);
 configuredId=id;
 // Keep initial account sign-in limited to identity scopes. Request Gmail separately
 // so consent errors can be attributed to the restricted Gmail scope.
 GoogleSignin.configure({webClientId:id,offlineAccess:false});
}
export async function getSavedGmailClientId(){return (await AsyncStorage.getItem(CONFIG_KEY))||''}
export async function initGmail(){
 const id=await AsyncStorage.getItem(CONFIG_KEY);
 if(id)await configureGmail(id);
 return Boolean(id);
}
export async function connectGmail(){
 if(!configuredId)throw new Error('Configure your OAuth client ID first');
 await GoogleSignin.hasPlayServices();
 const signed=await GoogleSignin.signIn();
 const user=(signed as any)?.data?.user||(signed as any)?.user;
 const email=String(user?.email||'').toLowerCase().trim();
 if(!email)throw new Error('Google did not return an account email');
 try{await GoogleSignin.addScopes({scopes:[SCOPE]})}
 catch(error:any){throw new Error('Google account sign-in succeeded but Gmail permission was denied: '+String(error?.message||error))}
 const all=await accounts();
 if(!all.some(a=>a.email===email)){
  // Preserve original opt-in time when upgrading from the one-account version.
  const legacyStart=Number(await AsyncStorage.getItem(START_KEY));
  const legacySeen=JSON.parse((await AsyncStorage.getItem(SEEN_KEY))||'[]');
  all.push({email,startedAt:legacyStart||Date.now(),seenIds:Array.isArray(legacySeen)?legacySeen:[]});
  await saveAccounts(all);
 }
 currentEmail=email;
 await AsyncStorage.setItem(ACTIVE_KEY,email);
 return {email,count:all.length};
}
export async function disconnectGmail(email?:string){
 const target=(email||await activeGmailAccount()).toLowerCase();
 const remaining=(await accounts()).filter(a=>a.email!==target);
 await saveAccounts(remaining);
 if(target===await activeGmailAccount()){
  try{await GoogleSignin.signOut()}catch(_){}
  currentEmail='';
  await AsyncStorage.removeItem(ACTIVE_KEY);
 }
 // Keep previously detected transactions when an account is disconnected.
}
async function token(){
 const result=await GoogleSignin.getTokens();
 if(!result.accessToken)throw new Error('Gmail authorization expired');
 return result.accessToken;
}
async function gmailFetch(path:string,accessToken:string){
 const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+accessToken}});
 if(!response.ok)throw new Error('Gmail API returned '+response.status);
 return response.json();
}
function decodeBase64Url(data:string){
 const normalized=data.replace(/-/g,'+').replace(/_/g,'/');
 const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 let bits=0,value=0,bytes:number[]=[];
 for(const char of normalized.replace(/=+$/,'')){const digit=chars.indexOf(char);if(digit<0)continue;value=(value<<6)|digit;bits+=6;if(bits>=8){bits-=8;bytes.push((value>>bits)&255)}}
 // UTF-8 decoding through percent encoding; avoids Node Buffer dependencies in React Native.
 try{return decodeURIComponent(bytes.map(b=>'%'+b.toString(16).padStart(2,'0')).join(''))}catch(_){return String.fromCharCode(...bytes.slice(0,4000))}
}
function bodyText(payload:any):string{
 const parts=[payload,...(payload?.parts||[])];
 for(const part of parts){if(part?.mimeType==='text/plain'&&part?.body?.data)return decodeBase64Url(part.body.data)}
 return '';
}
export async function syncGmail(parse:any){
 if(syncing)return {added:0,reason:'busy'};
 syncing=true;
 try{
  const email=await activeGmailAccount();
  const all=await accounts();
  const account=all.find(a=>a.email===email);
  if(!account||!configuredId)return {added:0};
  // Google Sign-In's native SDK maintains one active account session.
  // Never attribute messages to another account when the user switches.
  const signed=await GoogleSignin.getCurrentUser();
  const actual=String((signed as any)?.user?.email||'').toLowerCase();
  if(!actual||actual!==email)return {added:0,reason:'reauthorization_required'};
  const accessToken=await token();
  const q=encodeURIComponent('after:'+Math.floor(account.startedAt/1000)+' {debited credited spent received withdrawn deposited refund UPI}');
  const seen=new Set<string>(account.seenIds);
  const stored=JSON.parse((await AsyncStorage.getItem(TX_KEY))||'[]');
  if(!Array.isArray(stored))throw new Error('Invalid transaction storage');
  let added=0,pageToken='';
  for(let page=0;page<3;page++){
   const listing=await gmailFetch('messages?maxResults=100&q='+q+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''),accessToken);
   const ids=Array.isArray(listing.messages)?listing.messages:[];
   for(const item of ids){
    if(!item.id||seen.has(item.id))continue;
    const message=await gmailFetch('messages/'+encodeURIComponent(item.id)+'?format=full',accessToken);
    if(Number(message.internalDate)<account.startedAt){seen.add(item.id);continue}
    const content=(bodyText(message.payload)||message.snippet||'').slice(0,1200);
    const parsed=parse(content);
    if(parsed){
     const id='gmail:'+email+':'+item.id;
     if(!stored.some((r:any)=>r.id===id)){
      stored.unshift({...parsed,id,source:'gmail',sourceAccount:email,timestamp:Number(message.internalDate),description:parsed.description});
      added++;
     }
    }
    seen.add(item.id);
   }
   pageToken=listing.nextPageToken||'';
   if(!pageToken)break;
  }
  // Save transactions first; IDs ensure retries are safe after interrupted writes.
  await AsyncStorage.setItem(TX_KEY,JSON.stringify(stored));
  account.seenIds=Array.from(seen).slice(-4000);
  await saveAccounts(all);
  return {added,email};
 }finally{syncing=false}
}
