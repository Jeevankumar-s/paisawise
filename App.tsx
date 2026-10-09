import React,{useEffect,useMemo,useState} from 'react';
import {Alert,AppState,TextInput,SafeAreaView,ScrollView,View,Text,Pressable,StyleSheet,StatusBar} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg,{Defs,LinearGradient,Stop,Path,Rect,Line,Circle,G,Text as SvgText} from 'react-native-svg';
import * as alerts from './src/alerts';
import * as gmail from './src/gmail';
const finance=require('./src/finance.cjs');
type Transaction={id:string;kind:'credit'|'debit';amount:number;category:string;description:string;timestamp?:number};
const INK='#172D28',MUTED='#72847A',BG='#F5F7F2',GREEN='#234F3F',LIME='#D8F47C',CARD='#FFFFFF';
const money=(n:number)=>'₹'+Math.abs(Math.round(n)).toLocaleString('en-IN');
const short=(n:number)=>n>=100000?'₹'+(n/100000).toFixed(1)+'L':n>=1000?'₹'+(n/1000).toFixed(1)+'k':money(n);
const palette=['#356B55','#B5CF76','#E9A86A','#9CB5DB','#BD9BD4','#D5D9C8'];
function trend(rows:Transaction[]){
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-6+i);return d});
 return days.map(d=>({label:d.toLocaleDateString('en-IN',{weekday:'short'}).slice(0,2),value:rows.filter(r=>r.kind==='debit'&&r.timestamp&&r.timestamp>=d.getTime()&&r.timestamp<d.getTime()+86400000).reduce((sum,r)=>sum+r.amount,0)}));
}
function SpendingChart({rows}:{rows:Transaction[]}){
 const data=trend(rows),max=Math.max(1,...data.map(d=>d.value)),w=330,h=155,base=121;
 return <Svg width="100%" height={175} viewBox="0 0 330 175"><Defs><LinearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#8DBE76"/><Stop offset="1" stopColor="#285944"/></LinearGradient></Defs>
 {[0,1,2].map(i=><Line key={i} x1="10" y1={20+i*49} x2="322" y2={20+i*49} stroke="#EDF1E9" strokeDasharray="4 5"/>)}
 {data.map((d,i)=>{const bh=Math.max(d.value?7:3,(d.value/max)*95),x=15+i*45;return <G key={i}><Rect x={x+2} y={base-bh+5} width="28" height={bh} rx="9" fill="#CAD9C8" opacity=".42"/><Rect x={x} y={base-bh} width="28" height={bh} rx="9" fill={i===6?'#244D3D':'url(#bar)'}/><SvgText x={x+14} y="151" textAnchor="middle" fontSize="11" fontWeight="600" fill="#85948B">{d.label}</SvgText></G>})}</Svg>;
}
function Donut({values}:{values:{name:string;value:number}[]}){
 const total=values.reduce((a,b)=>a+b.value,0),r=54,c=2*Math.PI*r;let used=0;
 return <Svg width={155} height={155} viewBox="0 0 155 155"><Circle cx="77.5" cy="77.5" r={r} stroke="#EDF1EA" strokeWidth="20" fill="none"/>
 {values.map((v,i)=>{const len=total?v.value/total*c:0;const off=-used;used+=len;return <Circle key={v.name} cx="77.5" cy="77.5" r={r} fill="none" stroke={palette[i%palette.length]} strokeWidth="20" strokeDasharray={''+Math.max(0,len-3)+' '+c} strokeDashoffset={off} rotation="-90" origin="77.5,77.5"/>})}
 <SvgText x="77.5" y="73" fontSize="11" textAnchor="middle" fill="#7E9084">SPENDING</SvgText><SvgText x="77.5" y="93" fontSize="17" fontWeight="800" textAnchor="middle" fill="#173A2C">{total?'100%':'0%'}</SvgText></Svg>;
}
export default function App(){
 const [rows,setRows]=useState<Transaction[]>([]),[tab,setTab]=useState<'Overview'|'Activity'|'Insights'>('Overview');
 useEffect(()=>{AsyncStorage.getItem('transactions').then(raw=>{if(raw){const saved=JSON.parse(raw);if(Array.isArray(saved))setRows(saved)}}).catch(()=>Alert.alert('Storage error','Could not read your locally saved transactions.'))},[]);
 const [tracking,setTracking]=useState(false),[permission,setPermission]=useState(false),[smsTracking,setSmsTracking]=useState(false);
 const [gmailClientId,setGmailClientId]=useState(''),[gmailReady,setGmailReady]=useState(false);
 useEffect(()=>{gmail.initGmail().then(setGmailReady).catch(e=>console.warn('Gmail configuration',e))},[]);
 useEffect(()=>{
  let alive=true;
  const refresh=async()=>{
   try {
    const status=await alerts.getStatus();
    const sms=await alerts.getSmsStatus();
    if(alive)setSmsTracking(Boolean(sms.enabled));
    if(alive){setTracking(Boolean(status.enabled));setPermission(Boolean(status.permissionGranted))}
    if((status.enabled&&status.permissionGranted)||sms.enabled){
     const result=await alerts.syncFutureAlerts(finance.parseBankSms);
     if(result.added){
      const raw=await AsyncStorage.getItem('transactions');
      if(alive&&raw)setRows(JSON.parse(raw));
     }
    }
   }catch(e){console.warn('Transaction alert sync failed',e)}
   try{const result=await gmail.syncGmail(finance.parseBankSms);if(result.added){const raw=await AsyncStorage.getItem('transactions');if(alive&&raw)setRows(JSON.parse(raw))}}catch(e){console.warn('Gmail sync not ready',e)}
  };
  refresh();
  const sub=AppState.addEventListener('change',state=>{if(state==='active')refresh()});
  return ()=>{alive=false;sub.remove()};
 },[]);
 const s=useMemo(()=>finance.summarize(rows),[rows]);
 const categories=Object.entries(s.byCategory).map(([name,value])=>({name,value:Number(value)})).sort((a,b)=>b.value-a.value);
 const rate=Math.max(0,Math.min(100,s.savingsRate));
 return <SafeAreaView style={styles.root}><StatusBar barStyle="dark-content" backgroundColor={BG}/><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.page}>
 <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR FINANCIAL SPACE</Text><Text style={styles.brand}>paisa<Text style={{color:'#719D56'}}>wise.</Text></Text></View><View style={styles.avatar}><Text style={{fontSize:19}}>✦</Text></View></View>
 <View style={styles.tabs}>{(['Overview','Activity','Insights'] as const).map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[styles.tab,tab===t&&styles.activeTab]}><Text style={[styles.tabText,tab===t&&styles.activeTabText]}>{t}</Text></Pressable>)}</View>
 {tab==='Overview'&&<><View style={styles.hero}><View style={styles.heroCircleOne}/><View style={styles.heroCircleTwo}/><Text style={styles.heroLabel}>NET SAVINGS  ·  RECORDED</Text><Text style={styles.heroMoney}>{s.savings<0?'-':''}{money(s.savings)}</Text><View style={styles.heroDivider}/><View style={styles.heroStats}><View><Text style={styles.heroSmall}>↗  Money in</Text><Text style={styles.heroValue}>{short(s.income)}</Text></View><View><Text style={styles.heroSmall}>↘  Money out</Text><Text style={styles.heroValue}>{short(s.expenses)}</Text></View><View><Text style={styles.heroSmall}>Savings rate</Text><Text style={styles.heroValue}>{s.income?Math.round(s.savingsRate)+'%':'—'}</Text></View></View></View>
 <View style={styles.sectionHead}><Text style={styles.heading}>Spending pulse</Text><Text style={styles.period}>LAST 7 DAYS</Text></View><View style={styles.surface}><View style={styles.chartHead}><View><Text style={styles.muted}>Total recorded expenses</Text><Text style={styles.chartAmount}>{money(s.expenses)}</Text></View><View style={styles.graphTag}><Text style={styles.graphTagText}>↗ Trends</Text></View></View><SpendingChart rows={rows}/></View>
 <View style={styles.sectionHead}><Text style={styles.heading}>Where it went</Text><Text style={styles.period}>ALL TIME</Text></View><View style={styles.surface}><View style={styles.donutRow}><Donut values={categories}/><View style={{flex:1,gap:11}}>{categories.slice(0,4).map((v,i)=><View key={v.name} style={styles.legend}><View style={[styles.dot,{backgroundColor:palette[i]}]}/><Text numberOfLines={1} style={styles.legendName}>{v.name}</Text><Text style={styles.legendAmount}>{short(v.value)}</Text></View>)}{categories.length===0&&<Text style={styles.muted}>Your category breakdown will appear when new transactions are detected.</Text>}</View></View></View>
 <Pressable onPress={async()=>{try{await alerts.enable();setTracking(true);Alert.alert('Enable notification access','Allow PaisaWise notification access in Android settings, then return to the app. Only future transaction-like notifications will be processed.')}catch(e){Alert.alert('Unavailable',String(e))}}} style={[styles.privacy,{backgroundColor:'#DCE9D0'}]}><Text style={styles.privacyIcon}>↗</Text><View style={{flex:1}}><Text style={styles.privacyTitle}>{tracking&&permission?'Automatic alerts enabled':'Enable automatic transaction tracking'}</Text><Text style={styles.privacyBody}>{tracking&&permission?'New bank and Gmail transaction notifications will be checked on this device.':'Tap to grant Android notification access. No past SMS or emails will be scanned.'}</Text></View></Pressable>
 <Pressable onPress={async()=>{try{const enabled=await alerts.enableSms();if(enabled){setSmsTracking(true);Alert.alert('SMS tracking enabled','Only SMS arriving after activation will be processed. Old messages are not accessed.')}else{Alert.alert('Permission requested','Allow SMS permission, then tap Enable SMS tracking again to activate future-only tracking.')}}catch(e){Alert.alert('SMS tracking',String(e))}}} style={[styles.privacy,{backgroundColor:'#E4EBF5'}]}><Text style={styles.privacyIcon}>✉</Text><View style={{flex:1}}><Text style={styles.privacyTitle}>{smsTracking?'Future SMS tracking enabled':'Enable SMS tracking'}</Text><Text style={styles.privacyBody}>{smsTracking?'New transaction SMS can now be detected locally.':'Allow Android SMS permission to track only new bank transaction messages. You may need to tap twice.'}</Text></View></Pressable>
 <View style={[styles.privacy,{backgroundColor:'#E8E6F4'}]}><Text style={styles.privacyIcon}>✉</Text><View style={{flex:1}}><Text style={styles.privacyTitle}>Connect Gmail securely</Text><Text style={styles.privacyBody}>Set up your own Google OAuth Web client ID, then authorize read-only Gmail access. Only future emails are considered.</Text><TextInput value={gmailClientId} onChangeText={setGmailClientId} autoCapitalize="none" autoCorrect={false} placeholder="Google OAuth Web client ID" placeholderTextColor="#88948F" style={{backgroundColor:'#FFF',color:'#173A2C',padding:10,borderRadius:10,marginTop:10,fontSize:12}}/><Pressable onPress={async()=>{try{if(gmailClientId.trim()){await gmail.configureGmail(gmailClientId);setGmailReady(true)}await gmail.connectGmail();Alert.alert('Gmail connected','Only emails received after connection will be scanned when you open PaisaWise.')}catch(e){Alert.alert('Gmail setup',String(e))}}} style={{backgroundColor:'#234F3F',padding:12,borderRadius:12,alignItems:'center',marginTop:10}}><Text style={{color:'white',fontWeight:'800'}}>{gmailReady?'Authorize Gmail':'Save client ID and connect'}</Text></Pressable></View></View>
 <View style={styles.privacy}><Text style={styles.privacyIcon}>⌁</Text><View style={{flex:1}}><Text style={styles.privacyTitle}>Private by design</Text><Text style={styles.privacyBody}>Your finance history stays on this device. No manual entry needed.</Text></View></View></>}
 {tab==='Activity'&&<><Text style={styles.heading}>Transaction activity</Text><Text style={styles.muted}>Your locally recorded credits and debits.</Text><View style={{height:18}}/>{rows.length===0?<View style={styles.empty}><Text style={styles.emptySymbol}>◷</Text><Text style={styles.emptyTitle}>Nothing to review yet</Text><Text style={styles.muted}>Future bank alerts and emails will appear here once connected.</Text></View>:rows.map(r=><View key={r.id} style={styles.transaction}><View style={[styles.transactionIcon,{backgroundColor:r.kind==='credit'?'#E6F2DC':'#F5EAE1'}]}><Text style={{color:GREEN,fontSize:19}}>{r.kind==='credit'?'↙':'↗'}</Text></View><View style={{flex:1}}><Text numberOfLines={1} style={styles.transactionName}>{r.description}</Text><Text style={styles.muted}>{r.category}</Text></View><Text style={[styles.transactionValue,{color:r.kind==='credit'?'#327A51':INK}]}>{r.kind==='credit'?'+':'-'}{money(r.amount)}</Text></View>)}</>}
 {tab==='Insights'&&<><Text style={styles.heading}>Your money, decoded</Text><Text style={styles.muted}>Useful patterns from your recorded activity.</Text><View style={{height:18}}/><View style={styles.surface}><Text style={styles.muted}>SAVINGS PROGRESS</Text><Text style={styles.bigRate}>{s.income?Math.round(s.savingsRate)+'%':'—'}</Text><View style={styles.progressTrack}><View style={[styles.progressFill,{width:rate+'%'}]}/></View><Text style={styles.muted}>A 20% savings rate is a common starting goal, not a requirement.</Text></View><View style={styles.surface}><Text style={styles.heading}>Personalized insights</Text>{finance.insights(rows).map((tip:string,i:number)=><View key={i} style={styles.tip}><Text style={styles.tipStar}>✦</Text><Text style={[styles.muted,{flex:1,lineHeight:21}]}>{tip}</Text></View>)}</View></>}
 <View style={styles.footer}><Text style={styles.footerTitle}>Notification-based tracking</Text><Text style={styles.footerText}>New SMS alerts and notification previews can be processed on-device after permission. Gmail account synchronization requires Google authorization.</Text></View>
 </ScrollView></SafeAreaView>
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:BG},page:{paddingHorizontal:21,paddingTop:22,paddingBottom:60},
 header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:25},eyebrow:{fontSize:10,fontWeight:'800',letterSpacing:2,color:MUTED,marginBottom:3},brand:{fontSize:33,fontWeight:'900',letterSpacing:-1.6,color:INK},avatar:{width:45,height:45,borderRadius:16,backgroundColor:'#E2EDDA',alignItems:'center',justifyContent:'center'},
 tabs:{flexDirection:'row',backgroundColor:'#E8EDE5',borderRadius:17,padding:4,marginBottom:21},tab:{flex:1,paddingVertical:12,alignItems:'center',borderRadius:13},activeTab:{backgroundColor:'#FFFFFF',elevation:2},tabText:{fontSize:13,fontWeight:'700',color:MUTED},activeTabText:{color:INK},
 hero:{backgroundColor:GREEN,borderRadius:29,padding:24,overflow:'hidden',marginBottom:27,elevation:7},heroCircleOne:{position:'absolute',width:220,height:220,borderRadius:110,borderWidth:35,borderColor:'#3D6B50',right:-100,top:-110,opacity:.8},heroCircleTwo:{position:'absolute',width:190,height:190,borderRadius:95,borderWidth:22,borderColor:'#47735C',right:-90,bottom:-120,opacity:.5},heroLabel:{color:'#B8D2C2',fontSize:10,fontWeight:'800',letterSpacing:2},heroMoney:{fontSize:39,color:'#F7FFE8',fontWeight:'900',letterSpacing:-1.3,marginTop:13,marginBottom:26},heroDivider:{height:1,backgroundColor:'#537463',marginBottom:18},heroStats:{flexDirection:'row',justifyContent:'space-between'},heroSmall:{fontSize:11,color:'#C0D6C6',marginBottom:7},heroValue:{fontSize:17,fontWeight:'800',color:'#FFFFFF'},
 sectionHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},heading:{fontSize:21,fontWeight:'900',color:INK,letterSpacing:-.5},period:{fontSize:10,fontWeight:'800',color:MUTED,letterSpacing:1},surface:{backgroundColor:CARD,borderRadius:25,padding:20,marginBottom:25,elevation:2},chartHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},muted:{fontSize:12,color:MUTED,lineHeight:19},chartAmount:{fontSize:27,fontWeight:'900',color:INK,marginTop:3},graphTag:{backgroundColor:'#E8F2E1',paddingVertical:8,paddingHorizontal:11,borderRadius:12},graphTagText:{color:'#41734D',fontSize:11,fontWeight:'800'},
 donutRow:{flexDirection:'row',alignItems:'center',gap:10},legend:{flexDirection:'row',alignItems:'center',gap:7},dot:{width:9,height:9,borderRadius:4},legendName:{fontSize:12,color:MUTED,flex:1},legendAmount:{fontSize:12,fontWeight:'800',color:INK},
 privacy:{backgroundColor:'#E7EEDC',borderRadius:20,padding:17,flexDirection:'row',gap:13,marginBottom:24},privacyIcon:{fontSize:29,color:GREEN},privacyTitle:{fontWeight:'800',fontSize:14,color:GREEN,marginBottom:4},privacyBody:{fontSize:12,color:'#54705D',lineHeight:18},
 transaction:{backgroundColor:'white',padding:14,borderRadius:17,flexDirection:'row',alignItems:'center',gap:11,marginBottom:9},transactionIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},transactionName:{fontSize:13,fontWeight:'800',color:INK},transactionValue:{fontSize:14,fontWeight:'900'},empty:{backgroundColor:'white',borderRadius:24,padding:28,alignItems:'center',gap:12},emptySymbol:{fontSize:36,color:GREEN},emptyTitle:{fontSize:18,fontWeight:'800',color:INK,textAlign:'center'},
 bigRate:{fontSize:48,fontWeight:'900',color:GREEN,marginVertical:12},progressTrack:{height:12,backgroundColor:'#E9EEE6',borderRadius:10,overflow:'hidden',marginBottom:14},progressFill:{height:12,backgroundColor:'#87B667',borderRadius:10},tip:{flexDirection:'row',gap:12,marginTop:17},tipStar:{color:'#74A14E',fontSize:17},
 footer:{padding:19,borderRadius:20,borderWidth:1,borderColor:'#DFE7DA',marginTop:5},footerTitle:{fontWeight:'900',color:INK,fontSize:14,marginBottom:6},footerText:{color:MUTED,fontSize:12,lineHeight:19}
});