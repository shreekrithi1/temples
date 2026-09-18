import featuredData from '@/data/featured-temples.json';

export type TempleImageData = {
  url: string;
  localPath?: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  alt: string;
  width?: number;
  height?: number;
};

export type Temple = {
  qid: string;
  name: string;
  deity: string;
  lat: number;
  lon: number;
  country?: string;
  location?: string;
  architecture?: string;
  heritage?: string;
  type?: string;
  description?: string;
  presidingDeity?: string;
  wikipediaUrl?: string;
  websiteUrl?: string;
  descriptionSourceName?: string;
  sourceUrl?: string;
  descriptionSourceUrl?: string;
  descriptionLicense?: string;
  updatedAt?: string;
  image?: TempleImageData | null;
  aliases?: string[];
  featured?: boolean;
  coordinateSource?: string;
  dataLicenseUrl?: string;
};

// Only the first twenty records are bundled with the client for an instant initial view.
// The complete local JSON catalog is served by /api/temples.
export const featuredTemples = featuredData as Temple[];

export const deityColors: Record<string, string> = {
  Shiva: '#c67449', Vishnu: '#6e8e83', Devi: '#bb7990', Ganesha: '#c69d48',
  Murugan: '#8982ae', Surya: '#dcb367', Swaminarayan: '#88a0b3',
  Hanuman: '#d17b57', Ayyappan: '#779779', Other: '#9b927b', 'Not recorded': '#a6a49a',
};
