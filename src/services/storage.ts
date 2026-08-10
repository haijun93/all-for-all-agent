import type { Photo, Album, Person, FaceTag } from '../types/photo';
import { SAMPLE_PHOTOS, SAMPLE_ALBUMS, SAMPLE_PEOPLE } from './sampleData';

const DB_NAME = 'PicasaWebDB';
const DB_VERSION = 1;

export class StorageService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('folder', 'folder', { unique: false });
          photoStore.createIndex('isStarred', 'isStarred', { unique: false });
          photoStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('albums')) {
          db.createObjectStore('albums', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        // Check if database needs initial seeding
        const tx = db.transaction(['photos', 'albums', 'people'], 'readwrite');
        const photoStore = tx.objectStore('photos');
        const countReq = photoStore.count();

        countReq.onsuccess = () => {
          if (countReq.result === 0) {
            // Seed initial data
            const pStore = tx.objectStore('photos');
            const aStore = tx.objectStore('albums');
            const peStore = tx.objectStore('people');

            SAMPLE_PHOTOS.forEach((p) => pStore.put(p));
            SAMPLE_ALBUMS.forEach((a) => aStore.put(a));
            SAMPLE_PEOPLE.forEach((pe) => peStore.put(pe));
          }
        };

        resolve(db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Photo Operations ---

  public static async getAllPhotos(): Promise<Photo[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const store = tx.objectStore('photos');
      const req = store.getAll();
      req.onsuccess = () => {
        const photos = req.result as Photo[];
        // Sort by date descending by default
        photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        resolve(photos);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async getPhoto(id: string): Promise<Photo | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readonly');
      const store = tx.objectStore('photos');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as Photo | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  public static async savePhoto(photo: Photo): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.put({ ...photo, updatedAt: new Date().toISOString() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async deletePhoto(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async toggleStar(id: string): Promise<boolean> {
    const photo = await this.getPhoto(id);
    if (!photo) return false;
    const newStar = !photo.isStarred;
    photo.isStarred = newStar;
    await this.savePhoto(photo);
    return newStar;
  }

  // --- Album Operations ---

  public static async getAllAlbums(): Promise<Album[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('albums', 'readonly');
      const store = tx.objectStore('albums');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Album[]);
      req.onerror = () => reject(req.error);
    });
  }

  public static async createAlbum(name: string, description: string): Promise<Album> {
    const db = await this.getDB();
    const newAlbum: Album = {
      id: `album-${Date.now()}`,
      name,
      description,
      createdAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('albums', 'readwrite');
      const store = tx.objectStore('albums');
      const req = store.add(newAlbum);
      req.onsuccess = () => resolve(newAlbum);
      req.onerror = () => reject(req.error);
    });
  }

  public static async deleteAlbum(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('albums', 'readwrite');
      const store = tx.objectStore('albums');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<void> {
    for (const photoId of photoIds) {
      const photo = await this.getPhoto(photoId);
      if (photo) {
        if (!photo.albumIds.includes(albumId)) {
          photo.albumIds.push(albumId);
          await this.savePhoto(photo);
        }
      }
    }
  }

  // --- People Operations ---

  public static async getAllPeople(): Promise<Person[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('people', 'readonly');
      const store = tx.objectStore('people');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Person[]);
      req.onerror = () => reject(req.error);
    });
  }

  public static async createPerson(name: string, avatarUrl?: string): Promise<Person> {
    const db = await this.getDB();
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      name,
      avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      photoCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('people', 'readwrite');
      const store = tx.objectStore('people');
      const req = store.add(newPerson);
      req.onsuccess = () => resolve(newPerson);
      req.onerror = () => reject(req.error);
    });
  }

  public static async addFaceTag(photoId: string, face: FaceTag): Promise<void> {
    const photo = await this.getPhoto(photoId);
    if (!photo) return;
    photo.faces.push(face);
    await this.savePhoto(photo);
  }

  // --- Local File Import ---

  public static async importLocalFile(file: File, folderName?: string): Promise<Photo> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;

        // Calculate file dimensions using Image
        const img = new Image();
        img.onload = async () => {
          const width = img.naturalWidth || 1920;
          const height = img.naturalHeight || 1080;
          const folder = folderName || (file.webkitRelativePath ? file.webkitRelativePath.split('/')[0] : '📥 가져온 사진 (Imported)');
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
          const dateTaken = new Date(file.lastModified).toISOString().slice(0, 16).replace('T', ' ');

          const newPhoto: Photo = {
            id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            url: dataUrl,
            thumbnailUrl: dataUrl,
            date: new Date(file.lastModified).toISOString(),
            folder: folder,
            albumIds: [],
            isStarred: false,
            tags: ['로컬', '가져옴'],
            faces: [],
            exif: {
              camera: '디지털 카메라 / 스마트폰',
              lens: '기본 렌즈',
              focalLength: '28mm',
              aperture: 'f/2.8',
              shutterSpeed: '1/250s',
              iso: 100,
              dimensions: { width, height },
              fileSize: fileSizeMB,
              dateTaken: dateTaken,
            },
            updatedAt: new Date().toISOString(),
          };

          await StorageService.savePhoto(newPhoto);
          resolve(newPhoto);
        };
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // Reset to default sample catalog
  public static async resetToDefaultCatalog(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['photos', 'albums', 'people'], 'readwrite');
    const pStore = tx.objectStore('photos');
    const aStore = tx.objectStore('albums');
    const peStore = tx.objectStore('people');

    pStore.clear();
    aStore.clear();
    peStore.clear();

    SAMPLE_PHOTOS.forEach((p) => pStore.put(p));
    SAMPLE_ALBUMS.forEach((a) => aStore.put(a));
    SAMPLE_PEOPLE.forEach((pe) => peStore.put(pe));

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }
}
