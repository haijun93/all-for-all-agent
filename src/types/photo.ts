export interface PhotoExif {
  camera?: string;
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  exposureComp?: string;
  dateTaken?: string;
  fileSize?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  location?: {
    name: string;
    latitude: number;
    longitude: number;
    lat?: number;
    lng?: number;
    city?: string;
    province?: string;
    country?: string;
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
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  fillLight: number; // 0 to 100 (Picasa special)
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  colorTemp?: number; // -100 to 100 (warm/cool)
  temperature: number; // alias for colorTemp
  tint: number; // -100 to 100
  clarity?: number;
  straighten: number; // -45 to 45 deg
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  filter?: string;
  filterIntensity?: number; // 0 to 100
  filterStrength: number;
  vignetteStrength: number;
  grainStrength: number;
  tiltShiftY?: number;
  feelingLucky?: boolean;
  autoLucky?: boolean;
  autoContrast?: boolean;
  autoColor?: boolean;
  redEyes?: Array<{ x: number; y: number; radius: number }>;
}

export interface Photo {
  id: string;
  title: string;
  url: string;
  originalUrl: string;
  thumbnailUrl?: string;
  dateAdded?: number;
  date?: string;
  dateTaken?: string;
  width?: number;
  height?: number;
  fileSize?: number; // in bytes
  isStarred: boolean;
  folder?: string;
  tags: string[];
  exif?: PhotoExif;
  faces: FaceTag[];
  albumIds: string[];
  editParams?: EditParams;
  updatedAt?: string;
}

export interface Album {
  id: string;
  title: string;
  name?: string;
  description?: string;
  coverPhotoId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Person {
  id: string;
  name: string;
  avatarUrl: string;
  photoCount?: number;
}

export type ViewMode = 'gallery' | 'collage' | 'people' | 'timeline' | 'places';
export type GroupBy = 'folder' | 'date' | 'place' | 'region';
