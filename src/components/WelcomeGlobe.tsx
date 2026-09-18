"use client";

import { useEffect, useRef } from 'react';
import landPoints from '@/data/globe-points.json';

// Natural Earth land samples, projected onto a rotating sphere without map tiles.
const particles = landPoints.map(([lon, lat]) => {
  const phi = lat * Math.PI / 180, theta = lon * Math.PI / 180;
  return [Math.cos(phi) * Math.sin(theta), -Math.sin(phi), Math.cos(phi) * Math.cos(theta)];
});
const sacredPlaces = [[70.4,20.9],[85.3,27.7],[106.9,-7.6],[-74.6,40.3],[-.3,51.5],[151,-34.2]].map(([lon,lat]) => {
  const phi=lat*Math.PI/180, theta=lon*Math.PI/180;
  return [Math.cos(phi)*Math.sin(theta),-Math.sin(phi),Math.cos(phi)*Math.cos(theta)];
});

export default function WelcomeGlobe() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0, size=0, rotation=-1.05, previous=0, disposed=false;
    const draw = (time:number) => {
      if (disposed) return;
      const dt = previous ? Math.min(time-previous,50) : 0; previous=time;
      if (!motion.matches) rotation += dt*.000075;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      context.setTransform(ratio,0,0,ratio,0,0);
      context.clearRect(0,0,size,size);
      const radius=size*.365, cx=size/2, cy=size*.48;
      const glow=context.createRadialGradient(cx-radius*.3,cy-radius*.3,0,cx,cy,radius*1.12);
      glow.addColorStop(0,'rgba(255,251,242,.9)');glow.addColorStop(.78,'rgba(250,220,193,.3)');glow.addColorStop(1,'rgba(243,177,127,0)');
      context.fillStyle=glow;context.beginPath();context.arc(cx,cy,radius*1.12,0,Math.PI*2);context.fill();
      const project=(p:number[])=>{
        const x=p[0]*Math.cos(rotation)+p[2]*Math.sin(rotation);
        const z=p[2]*Math.cos(rotation)-p[0]*Math.sin(rotation);
        return [cx+x*radius,cy+(p[1]*.98-z*.16)*radius,z];
      };
      // Faint latitude arcs give the point cloud a tangible spherical surface.
      context.strokeStyle='rgba(183,110,67,.09)';context.lineWidth=.7;
      for(let i=-2;i<=2;i++){
        context.beginPath();context.ellipse(cx,cy+i*radius*.27,radius*Math.sqrt(1-(i*.27)**2),radius*.12,0,0,Math.PI*2);context.stroke();
      }
      particles.forEach(p=>{
        const [x,y,z]=project(p);
        context.fillStyle=z>0?`rgba(173,89,43,${.38+z*.55})`:'rgba(189,134,96,.1)';
        context.beginPath();context.arc(x,y,(.7+Math.max(0,z)*.8)*size/520,0,Math.PI*2);context.fill();
      });
      sacredPlaces.forEach((p,i)=>{
        const [x,y,z]=project(p);if(z<.12)return;
        const pulse=motion.matches?.4:(Math.sin(time*.0016+i*1.6)+1)/2;
        context.strokeStyle=`rgba(251,101,30,${(1-pulse)*.45})`;context.lineWidth=1;
        context.beginPath();context.arc(x,y,4+pulse*14,0,Math.PI*2);context.stroke();
        context.fillStyle='#fb651e';context.shadowColor='#fb651e';context.shadowBlur=9;
        context.beginPath();context.arc(x,y,2.7,0,Math.PI*2);context.fill();context.shadowBlur=0;
      });
      if(!motion.matches && !document.hidden)frame=requestAnimationFrame(draw);
    };
    const restart=()=>{cancelAnimationFrame(frame);previous=0;draw(performance.now());};
    const resize=new ResizeObserver(entries=>{
      size=entries[0].contentRect.width;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      element.width=Math.round(size*ratio);element.height=Math.round(size*ratio);restart();
    });
    resize.observe(element);
    motion.addEventListener('change',restart);
    document.addEventListener('visibilitychange',restart);
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();motion.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart);};
  },[]);
  return <canvas ref={canvas} className="welcome-globe" aria-hidden="true"/>;
}
