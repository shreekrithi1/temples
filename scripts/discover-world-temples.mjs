/** You.com discovery -> verified Wikipedia coordinates -> local catalog.
 * Run: node --env-file=.env.local scripts/discover-world-temples.mjs
 * Search responses are cached; --refresh repeats searches. No key enters output.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const data = new URL('src/data/', root), cache = new URL('.temple-cache/you-world/', root);
await mkdir(cache, { recursive: true });
const key = process.env.YOU_API_KEY;
if (!key) throw new Error('Set YOU_API_KEY in .env.local');
const regions = [...new Set([
'India','Nepal','Sri Lanka','Bangladesh','Pakistan','Bhutan','Afghanistan','Indonesia','Malaysia','Singapore','Thailand','Cambodia','Vietnam','Laos','Myanmar','China','Japan','South Korea','Taiwan','Hong Kong','United States','Canada','Mexico','Brazil','Argentina','Guyana','Suriname','Trinidad and Tobago','Jamaica','Barbados','Guadeloupe','Martinique','United Kingdom','Ireland','France','Germany','Netherlands','Belgium','Switzerland','Austria','Italy','Spain','Portugal','Denmark','Sweden','Norway','Finland','Iceland','Poland','Czech Republic','Hungary','Romania','Russia','Ukraine','Greece','Cyprus','Malta','South Africa','Mauritius','Reunion','Seychelles','Kenya','Uganda','Tanzania','Zambia','Zimbabwe','Botswana','Mozambique','Madagascar','Ghana','Nigeria','United Arab Emirates','Bahrain','Oman','Qatar','Kuwait','Israel','Australia','New Zealand','Fiji','Papua New Guinea',
...['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh','Puducherry','Andaman and Nicobar Islands','Chandigarh'].map(x=>x+', India')
])];
const failures=[];
let nextPublicRequest=0;
const blockedHosts=new Set();
const researchArg=process.argv.find(x=>x.startsWith('--research='))?.slice(11);
async function request(url, body, authenticated=false) {
  const id=createHash('sha256').update(url+JSON.stringify(body||{})).digest('hex');
  const file=new URL(id+'.json',cache);
  if (!process.argv.includes('--refresh')) { try { return JSON.parse(await readFile(file,'utf8')); } catch {} }
  if(blockedHosts.has(new URL(url).hostname)) { failures.push({host:new URL(url).hostname,url,error:"Deferred after upstream rate limit"});return {}; }
  for (let attempt=0;attempt<3;attempt++) {
    try {
      if(!authenticated) { const at=Math.max(Date.now(),nextPublicRequest+1200);nextPublicRequest=at;await new Promise(r=>setTimeout(r,Math.max(0,at-Date.now()))); }
      const response=await fetch(url,{method:body?'POST':'GET',headers:{'User-Agent':'MandirGlobe/1.0 (public temple atlas)',...(body?{'Content-Type':'application/json'}:{}),...(authenticated?{'X-API-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
      if ([401,403,402].includes(response.status)&&authenticated) throw new Error(`You.com authorization/credit error HTTP ${response.status}`);
      if(response.status===429 && !authenticated) {blockedHosts.add(new URL(url).hostname);failures.push({host:new URL(url).hostname,url,error:'HTTP 429; deferred until a later run'});console.log(`Rate limit from ${new URL(url).hostname}; remaining uncached requests deferred.`);return {};}
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const result=await response.json(); if(result.error) throw new Error('Upstream API error');
      await writeFile(file,JSON.stringify(result)); return result;
    } catch(error) {
      if (String(error).includes('authorization/credit')) throw error;
      if(attempt===2) { failures.push({host:new URL(url).hostname,url,error:String(error.message)}); return {}; }
      await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
  }
}
async function each(items, action) {
 let next=0;
 await Promise.all(Array.from({length:3},async()=>{while(next<items.length){const i=next++;await action(items[i],i);}}));
}
const api=(host,params)=>request(`https://${host}/w/api.php?`+new URLSearchParams({action:'query',format:'json',formatversion:'2',...params}));
const searches=[]; const titles=new Set();
const existingCatalog=JSON.parse(await readFile(new URL('temples.json',data),'utf8'));
function addUrl(url) { try { const u=new URL(url);if(u.hostname==='en.wikipedia.org'&&u.pathname.startsWith('/wiki/')) {const title=decodeURIComponent(u.pathname.slice(6)).replaceAll('_',' ');if(!title.includes(':'))titles.add(title);} }catch{} }
if(researchArg) {
 const prior=JSON.parse(await readFile(new URL(researchArg,root),'utf8'));
 searches.push(...prior.searches);for(const s of searches)for(const r of s.results)addUrl(r.url);
} else for(const [i,region] of regions.entries()) {
  const query=`Hindu temples mandir in ${region} list locations`;
  const result=await request('https://ydc-index.io/v1/search',{query,count:50},true);
  const results=(result.results?.web||[]).map(({title,url,description})=>({title,url,description}));
  results.forEach(r=>addUrl(r.url));
  searches.push({region,query,results});
  if((i+1)%10===0||i===regions.length-1) console.log(`You.com regions: ${i+1}/${regions.length}; Wikipedia candidates: ${titles.size}`);
}
if(!researchArg) await writeFile(new URL('you-world-research.json',data),JSON.stringify({provider:'You.com',searchedAt:new Date().toISOString(),completeGlobalInventory:false,searches},null,2)+'\n');
// Expand temple list pages discovered through You.com, following API pagination.
const lists=[...titles].filter(t=>/list of .*temples|hinduism in/i.test(t));
let expanded=0;
await each(lists, async(title)=> {
 let continuation={};
 for(let page=0;page<10;page++) {
  const response=await api('en.wikipedia.org',{prop:'links',titles:title,plnamespace:'0',pllimit:'500',...continuation});
  for(const p of response.query?.pages||[])for(const link of p.links||[])if(/temple|mandir|kovil|devalaya|pura |kuil/i.test(link.title))titles.add(link.title);
  if(!response.continue)break;continuation=response.continue;
 }
 if(++expanded%20===0)console.log(`Temple directories processed: ${expanded}/${lists.length}`);
});
const catalog=existingCatalog;
const identities=new Set(catalog.flatMap(t=>[t.qid,t.wikidataId].filter(Boolean)));
const existingUrls=new Set(catalog.map(t=>t.wikipediaUrl).filter(Boolean));
const knownTitles=new Set(catalog.filter(t=>t.wikipediaUrl?.startsWith('https://en.wikipedia.org/wiki/')).map(t=>decodeURIComponent(t.wikipediaUrl.split('/wiki/')[1]).replaceAll('_',' ')));
const candidates=[];const pending=[];const all=[...titles].filter(t=>!/^list of |^hinduism in/i.test(t)&&!knownTitles.has(t));
console.log(`Verifying ${all.length} article candidates`);
await each(Array.from({length:Math.ceil(all.length/20)},(_,i)=>i*20),async(i)=> {
 const response=await api('en.wikipedia.org',{prop:'coordinates|extracts|pageprops|pageimages|info',titles:all.slice(i,i+20).join('|'),redirects:'1',coprimary:'primary',exintro:'1',explaintext:'1',exlimit:'20',piprop:'name',pilimit:'20',inprop:'url'});
 for(const p of response.query?.pages||[]) {
  const qid=p.pageprops?.wikibase_item, summary=p.extract||'', coord=p.coordinates?.[0];
  if(!qid||identities.has(qid)||existingUrls.has(p.fullurl))continue;
  // Require an explicit Hindu identity in the lead, never infer religion from a search hit.
  if(!/Hindu (?:\w+ ){0,3}(?:temple|shrine)|temple(?:s| complex)? (?:\w+ ){0,5}(?:dedicated to|of) (?:the )?(?:Hindu|Shiva|Vishnu|Ganesha|Murugan|Durga|Kali|Krishna|Rama|Hanuman|Swaminarayan)/i.test(summary)) {pending.push({title:p.title,url:p.fullurl,reason:'Temple identity needs review'});continue;}
  if(!coord||!Number.isFinite(coord.lat)||!Number.isFinite(coord.lon)||Math.abs(coord.lat)>90||Math.abs(coord.lon)>180) {pending.push({title:p.title,url:p.fullurl,reason:'Missing verified coordinates'});continue;}
  identities.add(qid);candidates.push({qid,name:p.title,lat:coord.lat,lon:coord.lon,deity:'Not recorded',description:summary,wikipediaUrl:p.fullurl,sourceUrl:`https://www.wikidata.org/wiki/${qid}`,descriptionSourceUrl:p.fullurl,descriptionLicense:'CC BY-SA 4.0',image:null,imageFile:p.pageimage,discoveredVia:'You.com',updatedAt:new Date().toISOString().slice(0,10)});
 }
 if(i%200===0)console.log(`Article candidates processed: ${Math.min(i+20,all.length)}/${all.length}; new verified temples: ${candidates.length}`);
});
const entities={};
async function getEntities(ids) {for(let i=0;i<ids.length;i+=50){const r=await request('https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:ids.slice(i,i+50).join('|'),props:'claims|labels',languages:'en'}));Object.assign(entities,r.entities||{});}}
await getEntities(candidates.map(t=>t.qid));
const countryIds=[...new Set(candidates.map(t=>entities[t.qid]?.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id).filter(Boolean))];
await getEntities(countryIds);
await each(candidates,async(t)=> {
 const deity=t.description.match(/dedicated to (?:the (?:Hindu )?(?:god|goddess|deity) )?(?:Lord |Goddess )?(Shiva|Vishnu|Krishna|Rama|Ganesha|Ganesh|Murugan|Durga|Kali|Hanuman|Swaminarayan)\b/i)?.[1];
 if(deity){const name=deity[0].toUpperCase()+deity.slice(1).toLowerCase();t.presidingDeity=name;t.deity=({Krishna:'Vishnu',Rama:'Vishnu',Durga:'Devi',Kali:'Devi',Ganesh:'Ganesha'})[name]||name;}
 const countryId=entities[t.qid]?.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id;
 t.country=(entities[countryId]?.labels?.en?.value||'').replace('United States of America','United States');t.location=t.country;
 if(t.imageFile){
  const r=await api('commons.wikimedia.org',{prop:'imageinfo',titles:'File:'+t.imageFile,iiprop:'url|extmetadata',iiurlwidth:'960'});
  const info=r.query?.pages?.[0]?.imageinfo?.[0],meta=info?.extmetadata;
  const clean=x=>(x||'').replace(/<[^>]*>/g,'').trim();
  if(info&&meta?.LicenseShortName?.value&&info.descriptionurl?.startsWith('https://commons.wikimedia.org/'))t.image={url:info.thumburl||info.url,sourceUrl:info.descriptionurl,credit:clean(meta.Artist?.value)||'Wikimedia Commons contributor',license:clean(meta.LicenseShortName.value),licenseUrl:meta.LicenseUrl?.value||'',alt:t.name};
 }
 delete t.imageFile;
});
candidates.sort((a,b)=>a.qid.localeCompare(b.qid));
catalog.push(...candidates);
const meta=JSON.parse(await readFile(new URL('catalog-meta.json',data),'utf8'));
Object.assign(meta,{updatedAt:new Date().toISOString().slice(0,10),count:catalog.length,countries:new Set(catalog.map(t=>t.country).filter(Boolean)).size,withImages:catalog.filter(t=>t.image).length,withWikipediaSummaries:catalog.filter(t=>t.descriptionLicense==='CC BY-SA 4.0').length,classification:'Wikidata Hindu temples and subclasses, curated featured temples, and You.com-discovered Wikipedia articles with explicit Hindu temple identity and verified coordinates',worldDiscovery:{queriesProcessed:searches.length,candidateArticles:all.length,added:candidates.length,pending:pending.length,deferredRequests:failures.length,completeGlobalInventory:false}});
await writeFile(new URL(researchArg?'you-settlement-pending.json':'you-world-pending.json',data),JSON.stringify({pending,failures},null,2)+'\n');
await writeFile(new URL('temples.json',data),JSON.stringify(catalog,null,2)+'\n');
await writeFile(new URL('catalog-meta.json',data),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify({added:candidates.length,total:meta.count,countries:meta.countries,photos:meta.withImages,pending:pending.length,failedRequests:failures.length}));
