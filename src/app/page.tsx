import Link from 'next/link';
import { ArrowUpRight, Globe2, Landmark, MoveRight, Sparkles } from 'lucide-react';
import WelcomeGlobe from '@/components/WelcomeGlobe';
import catalog from '@/data/catalog-meta.json';

export default function Welcome() {
  return <main className="welcome-page">
    <div className="welcome-ambient" aria-hidden="true"/>
    <header className="welcome-header">
      <Link href="/" className="welcome-brand" aria-label="MandirGlobe home"><span><Landmark size={23}/></span>Mandir<b>Globe</b></Link>
      <span className="welcome-header-note"><span/> A living atlas of devotion</span>
      <Link href="/explore" className="welcome-nav">Explore the atlas <ArrowUpRight size={15}/></Link>
    </header>
    <section className="welcome-stage" aria-labelledby="welcome-title">
      <div className="welcome-kicker"><Sparkles size={12}/> SACRED PLACES. SHARED HUMANITY.</div>
      <div className="welcome-world">
        <div className="welcome-orbit orbit-one" aria-hidden="true"/><div className="welcome-orbit orbit-two" aria-hidden="true"/>
        <WelcomeGlobe/>
        <div className="welcome-stat stat-temples"><Landmark size={16}/><strong>{catalog.count.toLocaleString('en-US')}</strong><span>temples & shrines mapped</span><i>Every place, a story.</i></div>
        <div className="welcome-stat stat-countries"><Globe2 size={16}/><strong>{catalog.countries}</strong><span>countries to discover</span><i>Devotion knows no borders.</i></div>
        <div className="welcome-stat stat-photos"><span className="stat-spark">✦</span><strong>{catalog.withImages.toLocaleString('en-US')}</strong><span>sourced photographs</span></div>
        <div className="welcome-coordinate" aria-hidden="true">20.8880° N &nbsp; 70.4014° E<br/><span>Somnath · India</span></div>
      </div>
      <div className="welcome-copy">
        <span className="welcome-overline">YOUR JOURNEY BEGINS HERE</span>
        <h1 id="welcome-title">A world of <em>sacred places.</em></h1>
        <p>From the familiar to the faraway.<br/>Discover the temples, traditions, and stories that connect us.</p>
        <Link href="/explore" className="welcome-enter"><span>Continue as guest</span><MoveRight size={21}/></Link>
        <span className="welcome-reassurance">No account needed. Just a little curiosity.</span>
      </div>
    </section>
    <footer className="welcome-footer"><span>ROOTED IN TRADITION. OPEN TO EVERYONE.</span><span>Partial worldwide catalog <i/> Updated {catalog.updatedAt}</span><Link href="/explore">Find your next sacred place <MoveRight size={14}/></Link></footer>
  </main>;
}
