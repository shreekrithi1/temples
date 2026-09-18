"use client";
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, ChevronDown, ChevronRight, Compass, Globe2, Grid2X2, HelpCircle, Landmark, MapPin, Minus, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { featuredTemples, Temple, deityColors } from '@/lib/temples';
import TempleDetails from '@/components/TempleDetails';
import TempleImage from '@/components/TempleImage';
import { useModal } from '@/hooks/useModal';
import { useCompactLayout } from '@/hooks/useCompactLayout';
const GlobeMap=dynamic(()=>import('@/components/Map'),{ssr:false});
export default function Home(){
 const [temples,setTemples]=useState<Temple[]>(featuredTemples),[catalogLoading,setCatalogLoading]=useState(true),[catalogError,setCatalogError]=useState(false),[directoryLimit,setDirectoryLimit]=useState(60),[moreDeities,setMoreDeities]=useState(false),[query,setQuery]=useState(''),[deity,setDeity]=useState('All deities'),[country,setCountry]=useState('All countries'),[heritage,setHeritage]=useState('All temples'),[selected,setSelected]=useState<Temple|null>(null),[saved,setSaved]=useState<string[]>([]),[onlySaved,setOnlySaved]=useState(false),[database,setDatabase]=useState(false),[help,setHelp]=useState(false),[zoom,setZoom]=useState({value:0,kind:'reset'}),[filters,setFilters]=useState(false),[mapMode,setMapMode]=useState<'world'|'globe'>('globe');
 const [catalogUpdatedAt,setCatalogUpdatedAt]=useState('');
 const compact=useCompactLayout();
 useEffect(()=>{ if(selected && compact) window.scrollTo({top:0,behavior:'instant'}); },[selected,compact]);
 const sidebarRef=useRef<HTMLElement>(null),directoryRef=useRef<HTMLElement>(null),helpRef=useRef<HTMLElement>(null);
 useModal(sidebarRef,filters&&compact,()=>setFilters(false));
 useModal(directoryRef,database,()=>setDatabase(false));
 useModal(helpRef,help,()=>setHelp(false));
 useEffect(() => {
  let controller = new AbortController();
  const loadCatalog = () => {
  controller.abort();
  controller = new AbortController();
  fetch('/api/temples', { signal: controller.signal, cache: 'no-store' })
    .then(response => { if (!response.ok) throw new Error('Catalog unavailable'); return response.json(); })
    .then(result => {
      if (!result.success || !Array.isArray(result.data) || !result.data.length) throw new Error('Empty catalog');
      setTemples(result.data);
      setCatalogUpdatedAt(result.metadata?.updatedAt || '');
      setCatalogError(false);
      setCatalogLoading(false);
    })
    .catch(error => { if (error.name !== 'AbortError') { setCatalogError(true); setCatalogLoading(false); } });
  };
  loadCatalog();
  window.addEventListener('focus', loadCatalog);
  Promise.resolve().then(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('mandir-saved') || '[]');
      if (Array.isArray(stored)) setSaved(stored.filter((id: unknown) => typeof id === 'string'));
    } catch {}
  });
  return () => { controller.abort(); window.removeEventListener('focus', loadCatalog); };
 }, []);
 const isSaved = (temple: Temple) => saved.includes(temple.qid) || !!temple.aliases?.some(alias => saved.includes(alias));

 const filtered=useMemo(()=>temples.filter(t=>(deity==='All deities'||t.deity.toLowerCase().includes(deity.toLowerCase()))&&(country==='All countries'||t.country===country)&&(heritage==='All temples'||(heritage==='With photos'?!!t.image:`${t.heritage||''} ${t.description||''}`.toLowerCase().includes(heritage.toLowerCase())))&&(!onlySaved||saved.includes(t.qid)||!!t.aliases?.some(alias=>saved.includes(alias)))&&`${t.name} ${t.location||''} ${t.country||''} ${t.deity} ${t.presidingDeity||''}`.toLowerCase().includes(query.toLowerCase())),[temples,query,deity,country,heritage,onlySaved,saved]);
 const catalogStats=useMemo(()=>{
  const countryCounts:Record<string,number>={},deityCounts:Record<string,number>={};let photos=0;
  for(const temple of temples){if(temple.country)countryCounts[temple.country]=(countryCounts[temple.country]||0)+1;deityCounts[temple.deity]=(deityCounts[temple.deity]||0)+1;if(temple.image)photos++;}
  return {countryCounts,deityCounts,photos,countries:Object.keys(countryCounts).sort()};
 },[temples]);
 const countries=catalogStats.countries;
 const discoveryTemples=useMemo(()=>{
  // Give worldwide browsing a mix of countries instead of eight India-only cards.
  if(country!=='All countries'||query||onlySaved)return filtered.slice(0,8);
  const preferred=['India','United States','United Kingdom','Australia','Nepal','Indonesia','South Africa','Mauritius'].flatMap(name=>{
   const temple=filtered.find(t=>t.country===name&&t.image)||filtered.find(t=>t.country===name);
   return temple?[temple]:[];
  });
  const seen=new Set<string>();
  const diverse=[...preferred,...filtered].filter(temple=>{
   if(!temple.country||seen.has(temple.country))return false;
   seen.add(temple.country);return true;
  }).slice(0,8);
  return [...diverse,...filtered.filter(temple=>!diverse.includes(temple))].slice(0,8);
 },[filtered,country,query,onlySaved]);
 const savedCount=temples.filter(isSaved).length;
 const activeFilterCount=Number(deity!=='All deities')+Number(country!=='All countries')+Number(heritage!=='All temples')+Number(onlySaved);
 const setSearch=(value:string)=>{setQuery(value);setDirectoryLimit(60);};
 const reset=()=>{setQuery('');setDeity('All deities');setCountry('All countries');setHeritage('All temples');setOnlySaved(false);setSelected(null);};
 const chooseCountry=(value:string)=>{setCountry(value);setSelected(null);setDirectoryLimit(60);setFilters(false);};
 const showAllCountries=()=>{reset();setMapMode('world');setZoom(current=>({value:current.value+1,kind:'reset'}));};
 const save=(temple:Temple)=>{const ids=[temple.qid,...(temple.aliases||[])];const next=isSaved(temple)?saved.filter(id=>!ids.includes(id)):[...saved,temple.qid];setSaved(next);try{localStorage.setItem('mandir-saved',JSON.stringify(next));}catch{}};
 return <main className={`explorer ${selected?'has-selection':''}`}>
  {filters&&compact&&<button className="filter-backdrop" aria-label="Dismiss filters" tabIndex={-1} onClick={()=>setFilters(false)}/>}
  <aside ref={sidebarRef} id="temple-filters" inert={database||help} role={compact&&filters?'dialog':undefined} aria-modal={compact&&filters?true:undefined} aria-labelledby={compact&&filters?'filter-title':undefined} className={`sidebar ${filters?'mobile-open':''}`}>
   <div className="sidebar-close-row"><h2 id="filter-title">Refine your journey</h2><button aria-label="Close filters" onClick={()=>setFilters(false)}><X size={20}/></button></div>
   <Link className="brand" href="/"><span className="brand-icon"><Landmark size={23}/></span><span>Mandir<span className="brand-light">Globe</span><small>A WORLD OF SACRED PLACES</small></span></Link>
   <div className="sidebar-intro"><h1>Find a little divinity.<br/>Anywhere on Earth.</h1><p>Explore Hindu temples, living traditions,<br/>and the stories that connect us.</p></div>
   <label className="search-box"><Search size={16}/><input value={query} onChange={e=>setSearch(e.target.value)} placeholder="Search temples, places…" aria-label="Search temples"/><kbd>⌕</kbd></label>
   <div className="filter-heading"><span><SlidersHorizontal size={13}/> REFINE YOUR EXPLORATION</span><button onClick={reset}>Reset</button></div>
   <section className="filter-group"><h2>Deity <ChevronDown size={14}/></h2><button className={`filter-row ${deity==='All deities'?'active':''}`} onClick={()=>setDeity('All deities')}><span><span className="all-dot"/>All deities</span><span>{temples.length.toLocaleString()}</span></button>{Object.entries(deityColors).slice(0,moreDeities?undefined:6).map(([name,color])=><button className={`filter-row ${deity===name?'active':''}`} key={name} onClick={()=>setDeity(deity===name?'All deities':name)}><span><i style={{background:color}}/>{name}</span><span>{(catalogStats.deityCounts[name]||0).toLocaleString()}</span></button>)}<button className="more-deities" onClick={()=>setMoreDeities(!moreDeities)}>{moreDeities?'Show fewer deities':'+ More deities & unrecorded'}</button></section>
   <section className="filter-group"><h2>Location <ChevronDown size={14}/></h2><label className="select-wrap"><Globe2 size={15}/><select aria-label="Country" value={country} onChange={e=>chooseCountry(e.target.value)}><option>All countries</option>{countries.map(c=><option key={c}>{c}</option>)}</select></label></section>
   <section className="filter-group"><h2>Sacred collections <ChevronDown size={14}/></h2><div className="chips">{['All temples','With photos','Jyotirlinga','UNESCO'].map(h=><button key={h} className={heritage===h?'chosen':''} onClick={()=>setHeritage(h)}>{h==='UNESCO'?'◇ UNESCO heritage':h}</button>)}</div></section>
   <button className={`saved-link ${onlySaved?'selected':''}`} onClick={()=>setOnlySaved(!onlySaved)}><Bookmark size={16}/> Saved places <span>{savedCount}</span></button>
   <div className="sidebar-footer"><span className="live-dot"/><b>{filtered.length.toLocaleString()}</b> of {temples.length.toLocaleString()} temples to discover<small>{catalogLoading?'Loading the local temple catalog…':catalogError?'Catalog unavailable · showing featured temples':'Locally stored · sourced with You.com + Wikimedia'}</small></div>
   <div className="filter-apply"><button className="save-button" onClick={()=>setFilters(false)}>Show {filtered.length.toLocaleString()} temples <ArrowUpRight size={16}/></button></div>
  </aside>
  <div className="main-area" inert={database||help||(compact&&filters)}>
   <header className="topbar"><Link className="mobile-brand" href="/"><span className="brand-icon"><Landmark size={20}/></span><span>Mandir<b>Globe</b></span></Link><div className="view-tabs"><button className={!database?'current':''} onClick={()=>setDatabase(false)}><Globe2 size={15}/> Temple explorer</button><button className={database?'current':''} onClick={()=>setDatabase(true)}><Grid2X2 size={15}/> Temple directory</button></div><div className="top-actions"><span><span className="live-dot"/> An atlas of devotion</span><button aria-label="How to explore" onClick={()=>setHelp(true)}><HelpCircle size={18}/></button></div></header>
   <div className="mobile-search-bar"><label className="search-box"><Search size={18}/><input type="search" aria-label="Search temples and places" value={query} onChange={e=>setSearch(e.target.value)} placeholder="Search temples or places…"/></label><button className="mobile-filter" aria-label={activeFilterCount?`Open filters, ${activeFilterCount} active`:"Open filters"} aria-expanded={filters} aria-controls="temple-filters" onClick={()=>setFilters(true)}><SlidersHorizontal size={18}/><span>Filters</span>{activeFilterCount>0&&<b>{activeFilterCount}</b>}</button></div>
   <section className={`map-region ${mapMode==='world'?'world-mode':'globe-mode'}`}>
    <div className="map-heading"><span className="eyebrow">ROOTED IN TRADITION. CONNECTED BY FAITH.</span><h2>One world. Countless sacred stories.</h2><p>A journey through Hindu heritage, one temple at a time.</p></div>
    <div className="world-toolbar"><div className="map-mode-tabs" aria-label="Map view"><button aria-pressed={mapMode==='world'} className={mapMode==='world'?'active':''} onClick={()=>setMapMode('world')}>World map</button><button aria-pressed={mapMode==='globe'} className={mapMode==='globe'?'active':''} onClick={()=>setMapMode('globe')}>3D globe</button></div><button className="show-world" onClick={showAllCountries}>Show all countries <Globe2 size={12}/></button></div>
    <div className="globe-wrap"><GlobeMap temples={filtered} onSelect={setSelected} selected={selected} country={country} mode={mapMode} zoomCommand={zoom}/></div>
    <div className="globe-caption"><Compass size={14}/> <span className="pointer-map-hint">{mapMode==='world'?'All continents · Drag to pan':'Drag to rotate the globe'} · Scroll to zoom</span><span className="touch-map-hint">Use two fingers to move · Pinch to zoom</span><span>·</span> Select a marker</div>
    <div className="map-controls"><button aria-label="Zoom in" onClick={()=>setZoom({value:zoom.value+1,kind:'in'})}><Plus size={17}/></button><button aria-label="Zoom out" onClick={()=>setZoom({value:zoom.value+1,kind:'out'})}><Minus size={17}/></button><span/><button aria-label="Reset map view" onClick={()=>{setSelected(null);setZoom({value:zoom.value+1,kind:'reset'});}}><RotateCcw size={16}/></button></div>
    {mapMode==='globe'&&<div className="globe-rotate"><button aria-label="Rotate globe west" onClick={()=>setZoom({value:zoom.value+1,kind:'west'})}>← Rotate west</button><button aria-label="Rotate globe east" onClick={()=>setZoom({value:zoom.value+1,kind:'east'})}>Rotate east →</button></div>}
    <div className="map-credit"><a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
   </section>
   <section className="results-panel"><div className="results-header"><div><span className="result-icon"><Landmark size={16}/></span><h3>Your next discovery</h3><span className="count-badge">{filtered.length.toLocaleString()}</span></div><button onClick={()=>setDatabase(true)}>View all temples <ArrowUpRight size={14}/></button></div><div className="temple-cards">{discoveryTemples.map((t,i)=><button className="temple-card" key={t.qid} onClick={()=>setSelected(t)}><div className={`temple-art art-${i%4}`}><TempleImage temple={t}/><span style={{background:deityColors[t.deity]||'#c67449'}}>{t.deity}</span><ArrowUpRight size={14}/></div><b>{t.name}</b><small><MapPin size={11}/>{t.location||t.country||'Location not recorded'}</small></button>)}{!filtered.length&&<div className="empty">No temples match these filters. <button onClick={reset}>Clear filters</button></div>}</div></section>
   <aside className="discovery">
    <section className="insight-card overview"><div className="card-label"><Globe2 size={15}/> A GLOBAL TAPESTRY</div><div className="stats"><div><strong>{temples.length.toLocaleString()}</strong><span>Temples & shrines mapped</span></div><div><strong>{countries.length||'—'}</strong><span>Countries</span></div></div><div className="tiny-note"><span className="live-dot"/>{catalogLoading?'Loading the complete collection…':`${catalogStats.photos.toLocaleString()} temples with sourced photographs`}</div>{catalogUpdatedAt&&<small className="catalog-updated">Updated {catalogUpdatedAt} · Partial worldwide catalog</small>}</section>
    <section className="insight-card countries"><h3>Across the world <Globe2 size={15}/></h3><p>Select a country to fly to its temples</p>{[...countries].sort((a,b)=>catalogStats.countryCounts[b]-catalogStats.countryCounts[a]).slice(0,4).map((c,i)=>{const n=catalogStats.countryCounts[c];return <button className="country-row" key={c} onClick={()=>chooseCountry(c)}><span><span className="country-rank">0{i+1}</span>{c}<b>{n.toLocaleString()}</b></span><div><i style={{width:`${Math.max(9,n/temples.length*100)}%`}}/></div></button>;})}</section>
    <section className="journey-card"><span className="journey-symbol">ॐ</span><div className="card-label">PATHS OF PILGRIMAGE</div><h3>Twelve lights.<br/>One timeless journey.</h3><p>Discover the sacred Jyotirlingas,<br/>the radiant abodes of Shiva.</p><button onClick={()=>{reset();setHeritage('Jyotirlinga');}}>Explore Jyotirlingas <ArrowUpRight size={16}/></button></section>
    <button className="surprise" onClick={()=>{const photographed=filtered.filter(t=>t.image);const choices=photographed.length?photographed:filtered;setSelected(choices[Math.floor(Math.random()*choices.length)]||featuredTemples[0]);}}><span className="surprise-icon"><Sparkles size={17}/></span><span><b>Let curiosity guide you</b><small>Discover a temple at random</small></span><ChevronRight size={16}/></button>
   </aside>

  </div>
  {database&&<div className="modal-shade" onClick={()=>setDatabase(false)}><section ref={directoryRef} role="dialog" aria-modal="true" aria-labelledby="directory-title" className="directory modal" onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">THE SACRED ATLAS</span><h2 id="directory-title">Temple directory <span>{filtered.length.toLocaleString()}</span></h2></div><button aria-label="Close directory" onClick={()=>setDatabase(false)}><X size={20}/></button></div><label className="search-box"><Search size={16}/><input aria-label="Search directory" value={query} onChange={e=>setSearch(e.target.value)} placeholder="Find a temple or a place…"/></label><div className="directory-list">{filtered.slice(0,directoryLimit).map(t=><button key={t.qid} onClick={()=>{setSelected(t);setDatabase(false);}}><div className="directory-photo"><TempleImage temple={t}/></div><span><b>{t.name}</b><small>{t.location||t.deity}</small></span><span className="directory-deity">{t.deity}</span><ChevronRight size={16}/></button>)}{!filtered.length&&<p>No matches. Try another search or reset your filters.</p>}{filtered.length>directoryLimit&&<button className="load-more" onClick={()=>setDirectoryLimit(directoryLimit+60)}>Show more temples ({Math.min(directoryLimit,filtered.length)} of {filtered.length.toLocaleString()})</button>}</div></section></div>}
  {selected&&<TempleDetails key={selected.qid} temple={selected} saved={isSaved(selected)} onSave={()=>save(selected)} onClose={()=>setSelected(null)}/>}
  {help&&<div className="modal-shade" onClick={()=>setHelp(false)}><section ref={helpRef} role="dialog" aria-modal="true" aria-labelledby="help-title" className="help modal" onClick={e=>e.stopPropagation()}><button className="close-help" aria-label="Close help" onClick={()=>setHelp(false)}><X size={20}/></button><Compass size={34}/><h2 id="help-title">Follow your curiosity.</h2><p>The world map shows temples across every continent at once. Choose a country to zoom to its temples, or switch to the 3D globe and drag to rotate it. Select a large group to zoom in, then select an individual marker to see its details.</p><p>Filter by deity, country, or sacred collection. Save meaningful places to revisit them on this browser.</p><button className="save-button" onClick={()=>setHelp(false)}>Start exploring <ArrowUpRight size={16}/></button></section></div>}
 </main>;
}
