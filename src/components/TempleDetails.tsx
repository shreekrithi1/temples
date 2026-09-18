"use client";

import { useEffect } from 'react';
import { ArrowUpRight, Bookmark, Check, MapPin, X } from 'lucide-react';
import type { Temple } from '@/lib/temples';
import TempleImage from './TempleImage';

export default function TempleDetails({ temple, saved, onSave, onClose }: {
  temple: Temple; saved: boolean; onSave: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const photo = temple.image;
  return (
    <section className="detail-panel" role="region" aria-labelledby="temple-detail-title">
      <header className="detail-toolbar"><span>{temple.name}</span><button aria-label="Close temple details" onClick={onClose}><X size={20}/></button></header>
      <div className="detail-art detail-photo">
        <TempleImage key={temple.qid} temple={temple} priority />
        <span>{temple.deity === 'Not recorded' ? 'Hindu temple' : temple.deity}</span>
      </div>
      {photo && <div className="photo-credit">
        <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Photo: {photo.credit}</a>
        {photo.licenseUrl
          ? <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
          : <span>{photo.license}</span>}
      </div>}
      <div className="detail-content">
        <span className="eyebrow">A SACRED PLACE TO DISCOVER</span>
        <h2 id="temple-detail-title">{temple.name}</h2>
        <p className="detail-location"><MapPin size={14} />{temple.location || temple.country || 'Location name not recorded'}</p>
        <div className="detail-facts">
          <div><small>PRESIDING DEITY</small>{temple.presidingDeity || (temple.deity !== 'Not recorded' ? temple.deity : 'Not recorded')}</div>
          <div><small>COUNTRY</small>{temple.country || 'Not recorded'}</div>
          <div><small>ARCHITECTURE</small>{temple.architecture || 'Not recorded'}</div>
          <div><small>HERITAGE</small>{temple.heritage || 'Not recorded'}</div>
        </div>
        <h3 className="detail-section-title">History & significance</h3>
        <p className="temple-description">{temple.description || 'A detailed history is not available in the current sources.'}</p>
        {temple.descriptionSourceUrl && <p className="description-credit">
          <a href={temple.descriptionSourceUrl} target="_blank" rel="noreferrer">
            {temple.descriptionSourceName || (temple.descriptionSourceUrl.includes('wikipedia.org') ? 'Wikipedia contributors' : 'Wikidata contributors')}
          </a>
          {temple.descriptionLicense && <> · {temple.descriptionLicense}</>}
        </p>}
        <div className="detail-coordinates"><MapPin size={13} /> {temple.lat.toFixed(5)}°, {temple.lon.toFixed(5)}°</div>
        <button className="save-button" onClick={onSave}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}
          {saved ? 'Saved to your places' : 'Save this sacred place'}
        </button>
        <div className="detail-links">
          {(temple.wikipediaUrl || temple.websiteUrl) && <a href={temple.wikipediaUrl || temple.websiteUrl} target="_blank" rel="noreferrer">Full history <ArrowUpRight size={13} /></a>}
          <a href={`https://www.google.com/maps/search/?api=1&query=${temple.lat},${temple.lon}`} target="_blank" rel="noreferrer">View on map <ArrowUpRight size={13} /></a>
          {temple.sourceUrl && <a href={temple.sourceUrl} target="_blank" rel="noreferrer">Data source <ArrowUpRight size={13} /></a>}
        </div>
        {temple.coordinateSource==='OSM feature bounding-box center'&&<p className="detail-updated">Map marker shows the approximate center of the mapped site.</p>}
        {temple.dataLicenseUrl&&<p className="description-credit"><a href={temple.dataLicenseUrl} target="_blank" rel="noreferrer">OpenStreetMap data license & attribution</a></p>}
        <p className="detail-updated">Stored locally · Updated {temple.updatedAt || 'September 2026'}</p>
      </div>
    </section>
  );
}
