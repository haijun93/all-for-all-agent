import type { Photo } from '../types/photo';
import { StorageService } from './storage';
import { ExifExtractor } from './exifExtractor';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface PhotoScanProgress {
  currentFolder: string;
  foundImages: number;
  isScanning: boolean;
  statusText: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'];

// Generic placeholder shown instantly for lightning-scanned photos before
// their real thumbnail is lazily decoded (mirrors the vector placeholder
// LightningIndexer uses for documents).
const PLACEHOLDER_THUMBNAIL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect width="400" height="300" fill="#1a1f2b"/>
      <path d="M140 190 L180 140 L220 175 L250 145 L290 200 Z" fill="#2a3142"/>
      <circle cx="150" cy="120" r="18" fill="#2a3142"/>
    </svg>`
  );

interface PhotoEnrichmentEntry {
  path: string;
  folderPath: string;
  modified: number;
}

/**
 * Native (Tauri) two-phase photo indexer: an instant metadata-only scan
 * streams lightweight placeholder Photo records to the UI immediately,
 * then each photo's real thumbnail/dimensions/EXIF are lazily decoded
 * only once its card actually scrolls into view.
 */
export class PhotoLightningIndexer {
  private static enrichmentQueue: Map<string, PhotoEnrichmentEntry> = new Map();
  private static streamListeners = new Set<(photo: Photo) => void>();
  private static enrichmentListeners = new Set<(photo: Photo) => void>();

  public static subscribeStream(listener: (photo: Photo) => void): () => void {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }

  public static subscribeEnrichment(listener: (photo: Photo) => void): () => void {
    this.enrichmentListeners.add(listener);
    return () => this.enrichmentListeners.delete(listener);
  }

  private static notifyStream(photo: Photo): void {
    this.streamListeners.forEach((fn) => {
      try {
        fn(photo);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  private static notifyEnrichment(photo: Photo): void {
    this.enrichmentListeners.forEach((fn) => {
      try {
        fn(photo);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  public static hasPendingEnrichment(photoId: string): boolean {
    return this.enrichmentQueue.has(photoId);
  }

  private static generatePhotoId(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = (hash << 5) - hash + path.charCodeAt(i);
      hash |= 0;
    }
    return `photo-native-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Phase 1: instant metadata-only scan via the Rust scan_directory command
   * (no file bytes read, no decoding) — photos stream into the UI as fast
   * as the filesystem can be walked.
   */
  public static async scanLocalDirectoryNative(
    path: string,
    onProgress?: (progress: PhotoScanProgress) => void
  ): Promise<number> {
    const rootFolderName = path.split(/[\\/]/).pop() || path;
    let foundCount = 0;

    this.enrichmentQueue.clear();

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: 0,
      isScanning: true,
      statusText: `'${rootFolderName}' 폴더를 초고속 검색하는 중...`,
    });

    const unsubBatch = await listen('scan-batch', (event: any) => {
      const files: Array<{ path: string; name: string; size: number; modified: number }> = event.payload;

      for (const f of files) {
        const folderPath = f.path.substring(0, f.path.length - f.name.length) || rootFolderName;
        const dateStr = new Date(f.modified || Date.now()).toISOString().split('T')[0];
        const id = this.generatePhotoId(f.path);

        const photo: Photo = {
          id,
          title: f.name.replace(/\.[^/.]+$/, ''),
          url: PLACEHOLDER_THUMBNAIL,
          originalUrl: PLACEHOLDER_THUMBNAIL,
          thumbnailUrl: PLACEHOLDER_THUMBNAIL,
          dateAdded: f.modified || Date.now(),
          dateTaken: dateStr,
          fileSize: f.size,
          folder: folderPath,
          albumIds: [],
          isStarred: false,
          tags: ['로컬', '가져옴'],
          faces: [],
        };

        this.enrichmentQueue.set(id, { path: f.path, folderPath, modified: f.modified });
        foundCount++;

        StorageService.savePhoto(photo).catch((e) => console.warn('Failed to save photo placeholder:', e));
        this.notifyStream(photo);
      }

      onProgress?.({
        currentFolder: rootFolderName,
        foundImages: foundCount,
        isScanning: true,
        statusText: `⚡ 초고속 검색 중... (총 ${foundCount}장 발견)`,
      });
    });

    try {
      await invoke('scan_directory', { path, extensions: IMAGE_EXTENSIONS });
    } finally {
      unsubBatch();
    }

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: foundCount,
      isScanning: false,
      statusText: `⚡ 초고속 스캔 완료! 총 ${foundCount}장 — 화면에 보이는 사진부터 실제 이미지를 자동으로 불러옵니다.`,
    });

    return foundCount;
  }

  /**
   * Phase 2: reads the real file bytes for one photo, decodes it, and
   * fills in its true thumbnail/dimensions/EXIF. Called when the photo's
   * card scrolls into view (see PhotoCard's IntersectionObserver).
   */
  public static async enrichPhoto(photoId: string): Promise<Photo | null> {
    const queued = this.enrichmentQueue.get(photoId);
    if (!queued) return null;
    this.enrichmentQueue.delete(photoId);

    try {
      const rawBytes: number[] = await invoke('read_file_binary', { path: queued.path });
      const fileName = queued.path.split(/[\\/]/).pop() || queued.path;
      const blob = new Blob([new Uint8Array(rawBytes)]);
      const file = new File([blob], fileName, { lastModified: queued.modified });
      const objectUrl = URL.createObjectURL(blob);

      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 });
        img.onerror = () => resolve({ width: 1920, height: 1080 });
        img.src = objectUrl;
      });

      const exif = await ExifExtractor.extractMetadata(file);

      const existing = await StorageService.getPhoto(photoId);
      const updated: Photo = {
        ...(existing as Photo),
        id: photoId,
        title: fileName.replace(/\.[^/.]+$/, ''),
        url: objectUrl,
        originalUrl: objectUrl,
        thumbnailUrl: objectUrl,
        width: dimensions.width,
        height: dimensions.height,
        exif,
      };

      await StorageService.savePhoto(updated);
      this.notifyEnrichment(updated);
      return updated;
    } catch (e) {
      console.warn('[PhotoLightningIndexer] Enrichment failed for', queued.path, e);
      return null;
    }
  }
}
