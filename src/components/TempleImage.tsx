"use client";

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { Temple } from '@/lib/temples';

/** Images come from the catalog, never from a name-based image search at runtime. */
export default function TempleImage({ temple, priority = false }: { temple: Temple; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const image = temple.image;

  if (!image || failed) {
    return (
      <div className="temple-photo-placeholder" role="img" aria-label={`Photo unavailable for ${temple.name}`}>
        <ImageOff size={28} strokeWidth={1.2} />
        <span>{failed ? 'Photo could not be loaded' : 'Photo not available yet'}</span>
      </div>
    );
  }

  // Native img supports locally cached and attributed Commons images without a proxy request.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="temple-photo" src={image.localPath || image.url} alt={image.alt || temple.name}
    loading={priority ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer"
    onError={() => setFailed(true)} />;
}
