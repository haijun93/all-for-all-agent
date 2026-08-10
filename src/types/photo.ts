export interface PhotoExif {
  camera: string;
  lens: string;
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  iso: number;
  dimensions: { width: number; height: number };
  fileSize: string;
  dateTaken: string;
  location?: {
    name: string;
    lat: number;
    lng: number;
  };
}

export interface FaceTag {
  id: string;
  personId: string;
  personName: string;
  box: {
    x: number; // 0 to 1 percentage
    y: number;
    width: number;
    height: number;
  };
}

export interface EditParams {
  // Basic Fixes
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  rotation: number; // 0, 90, 180, 270
  straighten: number; // -45 to 45 deg
  flipH: boolean;
  flipV: boolean;
  feelingLucky: boolean;
  autoContrast: boolean;
  autoColor: boolean;
  redEyes: Array<{ x: number; y: number; radius: number }>;

  // Tuning
  fillLight: number; // 0 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  temperature: number; // -100 to 100 (Cool to Warm)
  tint: number; // -100 to 100 (Green to Magenta)
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  clarity: number; // 0 to 100

  // Creative Effects / Filters
  filter: 'none' | 'bw' | 'sepia' | 'warmify' | 'vignette' | 'film' | 'lomo' | 'vintage60' | 'softFocus' | 'posterize' | 'cinema' | 'tiltShift' | 'inverted' | 'infrared';
  filterStrength: number; // 0 to 100
  vignetteStrength: number; // 0 to 100
  grainStrength: number; // 0 to 100
  tiltShiftY: number; // 0 to 100 percentage
}

export interface Photo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  originalUrl?: string;
  date: string; // ISO format
  folder: string;
  albumIds: string[];
  isStarred: boolean;
  tags: string[];
  faces: FaceTag[];
  exif: PhotoExif;
  editParams?: EditParams;
  updatedAt: string;
}

export interface Album {
  id: string;
  name: string;
  description: string;
  coverPhotoId?: string;
  photoCount?: number;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  avatarUrl: string;
  photoCount: number;
}

export type ViewMode = 'gallery' | 'collage' | 'people' | 'timeline';
export type GroupBy = 'folder' | 'date' | 'none';
export type ActiveTab = 'library' | 'album' | 'person' | 'folder' | 'starred' | 'search';
