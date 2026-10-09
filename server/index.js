import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {MongoClient} from 'mongodb';
import {OAuth2Client} from 'google-auth-library';
import {z} from 'zod';

const required=['MONGODB_URI','GOOGLE_OAUTH_CLIENT_ID'];
for(const name of required)if(!process.env[name])throw new Error('Missing '+name);
const mongo=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:5});
await mongo.connect();
const db=mongo.db(process.env.MONGODB_DB||'paisawise');
const tx=db.collection('transactions');
await tx.createIndex({owner:1,id:1},{unique:true});
await tx.createIndex({owner:1,timestamp:-1});
const google=new OAuth2Client(process.env.GOOGLE_OAUTH_CLIENT_ID);
const app=express();
app.use(helmet());
app.use(express.json({limit:'128kb'}));
app.use(rateLimit({windowMs:60000,limit:90,standardHeaders:'draft-7',legacyHeaders:false}));
app.get('/health',(_req,res)=>res.json({ok:true}));
app.use(async(req,res,next)=>{
 try{
  const bearer=/^Bearer (.+)$/.exec(req.headers.authorization||'');
  if(!bearer)return res.status(401).json({error:'Sign in required'});
  const ticket=await google.verifyIdToken({idToken:bearer[1],audience:process.env.GOOGLE_OAUTH_CLIENT_ID});
  const payload=ticket.getPayload();
  if(!payload?.sub||!payload.email_verified)return res.status(401).json({error:'Invalid identity'});
  req.owner=payload.sub;
  next();
 }catch(_){res.status(401).json({error:'Invalid or expired Google identity token'})}
});
const schema=z.object({
 id:z.string().min(1).max(180),kind:z.enum(['credit','debit']),
 amount:z.number().positive().finite().max(1e10),category:z.string().max(60),
 description:z.string().max(240).default(''),timestamp:z.number().int().nonnegative(),
 source:z.string().max(32).optional(),sourceAccount:z.string().email().optional()
}).strict();
app.get('/transactions',async(req,res)=>{
 const rows=await tx.find({owner:req.owner},{projection:{_id:0,owner:0}}).sort({timestamp:-1}).limit(5000).toArray();
 res.json({transactions:rows});
});
app.post('/transactions/sync',async(req,res)=>{
 const result=z.array(schema).max(500).safeParse(req.body?.transactions);
 if(!result.success)return res.status(400).json({error:'Invalid transactions'});
 if(!result.data.length)return res.json({synced:0});
 const ops=result.data.map(row=>({updateOne:{filter:{owner:req.owner,id:row.id},update:{$setOnInsert:{...row,owner:req.owner}},upsert:true}}));
 await tx.bulkWrite(ops,{ordered:false});
 res.json({synced:result.data.length});
});
app.delete('/transactions/:id',async(req,res)=>{
 await tx.deleteOne({owner:req.owner,id:req.params.id});
 res.json({ok:true});
});
function insightSummary(rows){
 const debit=rows.filter(x=>x.kind==='debit');
 const income=rows.filter(x=>x.kind==='credit').reduce((s,x)=>s+x.amount,0);
 const spending=debit.reduce((s,x)=>s+x.amount,0);
 const categories={};
 for(const row of debit)categories[row.category]=(categories[row.category]||0)+row.amount;
 const byMonth={};
 for(const row of debit){const month=new Date(row.timestamp).toISOString().slice(0,7);byMonth[month]=(byMonth[month]||0)+row.amount}
 return {income,spending,savings:income-spending,categories,byMonth};
}
app.get('/insights',async(req,res)=>{
 const rows=await tx.find({owner:req.owner},{projection:{_id:0,kind:1,amount:1,category:1,timestamp:1}}).limit(5000).toArray();
 const summary=insightSummary(rows);
 const top=Object.entries(summary.categories).sort((a,b)=>b[1]-a[1])[0];
 const advice=[];
 if(top)advice.push('Your largest spending category is '+top[0]+'. A 10% reduction would save approximately ₹'+Math.round(top[1]*.1)+'.');
 if(summary.income>0)advice.push('Your recorded savings rate is '+Math.round(summary.savings/summary.income*100)+'%.');
 if(!rows.length)advice.push('New transactions will generate insights here.');
 // No email bodies, account numbers, names, or individual transaction descriptions sent to AI.
 if(process.env.AI_API_KEY&&process.env.AI_API_URL&&process.env.AI_MODEL){
  try{
   const endpoint=new URL(process.env.AI_API_URL);
   if(endpoint.protocol!=='https:')throw new Error('AI endpoint must use HTTPS');
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
   try{
    const response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+process.env.AI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.AI_MODEL,messages:[{role:'system',content:'You are a cautious Indian personal finance coach. Use only the supplied aggregated statistics. Provide 3 specific, practical savings suggestions, avoid investment guarantees. Do not invent facts.'},{role:'user',content:JSON.stringify(summary)}],temperature:0.3,max_tokens:350}),signal:controller.signal});
    if(response.ok){const body=await response.json();const text=body?.choices?.[0]?.message?.content;if(typeof text==='string')return res.json({summary,advice,ai:text.slice(0,2500)})}
   }finally{clearTimeout(timeout)}
  }catch(error){console.warn('AI service unavailable:',error.message)}
 }
 res.json({summary,advice,ai:null});
});
app.listen(Number(process.env.PORT)||8080,()=>console.log('PaisaWise private API listening'));
