import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';

const SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const CONFIG_KEY='paisawise.gmail.webClientId';
const START_KEY='paisawise.gmail.startedAt';
const SEEN_KEY='paisawise.gmail.seenIds';
const TX_KEY='transactions';
let configuredId='';

export async function configureGmail(webClientId:string){
 const id=webClientId.trim();
 if(!/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id))throw new Error('Enter a valid Google OAuth Web client ID');
 await AsyncStorage.setItem(CONFIG_KEY,id);
 configuredId=id;
 GoogleSignin.configure({webClientId:id,scopes:[SCOPE],offlineAccess:false});
}
export async function initGmail(){
 const id=await AsyncStorage.getItem(CONFIG_KEY);
 if(id)await configureGmail(id);
 return Boolean(id);
}
export async function connectGmail(){
 if(!configuredId)throw new Error('Configure your OAuth client ID first');
 await GoogleSignin.hasPlayServices();
 await GoogleSignin.signIn();
 await GoogleSignin.addScopes({scopes:[SCOPE]});
 if(!(await AsyncStorage.getItem(START_KEY)))await AsyncStorage.setItem(START_KEY,String(Date.now()));
 return true;
}
export async function disconnectGmail(){
 try{await GoogleSignin.signOut()}catch(_){}
 // Preserve previously imported transactions but stop fetching new Gmail messages.
 await AsyncStorage.removeItem(START_KEY);
 await AsyncStorage.removeItem(SEEN_KEY);
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
 const start=Number(await AsyncStorage.getItem(START_KEY));
 if(!start||!configuredId)return {added:0};
 const accessToken=await token();
 // Gmail after: accepts Unix seconds. Never request messages before opt-in.
 const after=Math.floor(start/1000);
 const q=encodeURIComponent('after:'+after+' {debited credited spent received withdrawn deposited refund UPI}');
 const listing=await gmailFetch('messages?maxResults=40&q='+q,accessToken);
 const ids=Array.isArray(listing.messages)?listing.messages:[];
 const seen=new Set<string>(JSON.parse((await AsyncStorage.getItem(SEEN_KEY))||'[]'));
 const rows=JSON.parse((await AsyncStorage.getItem(TX_KEY))||'[]');
 if(!Array.isArray(rows))throw new Error('Invalid transaction storage');
 let added=0;
 for(const item of ids){
  if(!item.id||seen.has(item.id))continue;
  const message=await gmailFetch('messages/'+encodeURIComponent(item.id)+'?format=full',accessToken);
  if(Number(message.internalDate)<start)continue;
  const content=(bodyText(message.payload)||message.snippet||'').slice(0,500);
  const parsed=parse(content);
  if(parsed){
   const id='gmail:'+item.id;
   if(!rows.some((r:any)=>r.id===id)){rows.unshift({...parsed,id,timestamp:Number(message.internalDate),description:parsed.description});added++}
  }
  seen.add(item.id);
 }
 await AsyncStorage.setItem(TX_KEY,JSON.stringify(rows));
 await AsyncStorage.setItem(SEEN_KEY,JSON.stringify([...seen].slice(-2000)));
 return {added};
}
