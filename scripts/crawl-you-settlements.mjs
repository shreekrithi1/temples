/** Budgeted crawl. Every attempted paid request is reserved on disk BEFORE sending.
 * Resume with the same ledger; never delete it to reset the authorized budget.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../',import.meta.url), data=new URL('src/data/',root);
const cache=new URL('.temple-cache/you-settlements/',root);fs.mkdirSync(cache,{recursive:true});
const plan=JSON.parse(fs.readFileSync(new URL('you-settlement-plan.json',data)));
const ledgerPath=new URL('you-settlement-budget.json',data), lockPath=new URL('crawl.lock',cache);
const key=process.env.YOU_API_KEY;if(!key)throw new Error('YOU_API_KEY missing');
if(fs.existsSync(lockPath)) {
 const pid=Number(fs.readFileSync(lockPath,'utf8'));let alive=true;
 try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
 if(alive)throw new Error('A settlement crawler is already running');fs.unlinkSync(lockPath);
}
fs.writeFileSync(lockPath,String(process.pid),{flag:'wx'});
let ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath)):{budgetUSD:20,maxAttemptedCalls:4000,attemptedCalls:0,estimatedCostUSD:0,pricePerCallUSD:0.005,pricingSource:plan.pricingSource,startedAt:new Date().toISOString()};
// The ledger preserves the original $20 plus the explicitly authorized $10 top-up.
// Queue changes never grant spending permission; keep a hard $30 lifetime ceiling.
if(![20,30].includes(ledger.budgetUSD)||ledger.maxAttemptedCalls!==ledger.budgetUSD/0.005||(ledger.budgetUSD===30&&!ledger.authorizations?.some(a=>a.additionalUSD===10&&a.totalBudgetUSD===30))||ledger.pricePerCallUSD!==0.005||!Number.isInteger(ledger.attemptedCalls)||ledger.attemptedCalls<0||ledger.attemptedCalls>ledger.maxAttemptedCalls)throw new Error('Unexpected budget configuration');
const persist=()=>{const temp=new URL('you-settlement-budget.tmp',data);fs.writeFileSync(temp,JSON.stringify(ledger,null,2)+'\n');fs.renameSync(temp,ledgerPath);};
const results=[];let next=0,done=0,stop=false;const failures=[];
let lastStart=0;
async function search(item) {
 const file=new URL(createHash('sha256').update(item.query).digest('hex')+'.json',cache);
 if(fs.existsSync(file)){results.push({...JSON.parse(fs.readFileSync(file)),...item});return;}
 for(let attempt=0;attempt<2;attempt++){
  if(stop||ledger.attemptedCalls>=ledger.maxAttemptedCalls)return;
  // JS executes this reservation synchronously: concurrent workers cannot overspend.
  ledger.attemptedCalls++;ledger.estimatedCostUSD=Number((ledger.attemptedCalls*0.005).toFixed(3));ledger.updatedAt=new Date().toISOString();persist();
  const start=Math.max(Date.now(),lastStart+250);lastStart=start;
  await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));
  try{
   const response=await fetch('https://ydc-index.io/v1/search',{method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json'},body:JSON.stringify({query:item.query,count:100}),signal:AbortSignal.timeout(25000)});
   if([401,402,403].includes(response.status)){stop=true;throw new Error('You.com authentication or credits unavailable');}
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const payload=await response.json();
   if(!Array.isArray(payload.results?.web))throw new Error('Unexpected search response');
   const entry={...item,searchedAt:new Date().toISOString(),results:payload.results.web.map(({title,url,description,snippets})=>({title,url,description,snippets}))};
   fs.writeFileSync(file,JSON.stringify(entry));results.push(entry);return;
  }catch(error){
   if(attempt===1||stop){failures.push({query:item.query,error:String(error.message)});return;}
   await new Promise(r=>setTimeout(r,3000));
  }
 }
}
try {
 await Promise.all(Array.from({length:6},async()=>{while(next<plan.queries.length&&!stop){const item=plan.queries[next++];await search(item);done++;if(done%100===0)console.log(`Queries processed: ${done}/${plan.queries.length}; paid attempts: ${ledger.attemptedCalls}/${ledger.maxAttemptedCalls}; saved results: ${results.reduce((n,r)=>n+r.results.length,0)}`);}}));
 const completed=new Set(results.map(r=>r.query));
 const report={provider:'You.com',updatedAt:new Date().toISOString(),completeGlobalInventory:false,budget:ledger,successfulQueries:results.length,resultCount:results.reduce((n,r)=>n+r.results.length,0),unsearchedQueries:plan.queries.filter(q=>!completed.has(q.query)).map(q=>q.query),failures,searches:results};
 const output=new URL('you-settlement-research.tmp',data);
 const head=JSON.stringify({...report,searches:undefined});
 fs.writeFileSync(output,head.slice(0,-1)+',\"searches\":[');
 for(let i=0;i<results.length;i++)fs.appendFileSync(output,(i?',':'')+JSON.stringify(results[i]));
 fs.appendFileSync(output,']}\n');
 fs.renameSync(output,new URL('you-settlement-research.json',data));
 console.log(JSON.stringify({successfulQueries:report.successfulQueries,resultCount:report.resultCount,attemptedCalls:ledger.attemptedCalls,estimatedCostUSD:ledger.estimatedCostUSD,unsearchedQueries:report.unsearchedQueries.length,failures:failures.length}));
}finally{fs.unlinkSync(lockPath);}
