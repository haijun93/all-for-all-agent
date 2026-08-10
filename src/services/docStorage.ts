import type { DocumentItem, DocFormat } from '../types/document';
import { SAMPLE_DOCUMENTS } from './sampleDocs';
import { KeywordEngine } from './keywordEngine';
import { DocRendererService } from './docRenderer';
import { RealDocExtractor } from './realDocExtractor';

const DB_NAME = 'PicasaWebDB';
const DB_VERSION = 2; // Incremented for documents store

export class DocStorageService {
  private static db: IDBDatabase | null = null;

  public static async getDB(): Promise<IDBDatabase> {
    if (this.db && this.db.objectStoreNames.contains('documents')) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('photos')) {
          db.createObjectStore('photos', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('albums')) {
          db.createObjectStore('albums', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
      };

      request.onsuccess = async (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;

        // Seed initial documents if empty
        const docs = await this.getAllDocuments();
        if (docs.length === 0) {
          await this.seedInitialDocuments();
        }

        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private static async seedInitialDocuments(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');

    SAMPLE_DOCUMENTS.forEach((doc) => store.put(doc));

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }

  public static async getAllDocuments(): Promise<DocumentItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const req = store.getAll();
      req.onsuccess = () => {
        const docs = req.result as DocumentItem[];
        const needsUpgrade: DocumentItem[] = [];

        // Upgrade any legacy SVG placeholder thumbnails immediately
        docs.forEach((doc) => {
          if (doc.thumbnailUrl?.startsWith('data:image/svg+xml')) {
            try {
              doc.thumbnailUrl = DocRendererService.generateDocumentFirstPageThumbnail(
                doc.title,
                doc.format,
                doc.category,
                doc.previewSnippet || doc.title,
                doc.dateCreated,
                doc.author
              );
              needsUpgrade.push(doc);
            } catch (e) {
              console.warn(e);
            }
          }
        });

        if (needsUpgrade.length > 0) {
          this.saveDocumentsBulk(needsUpgrade).catch(console.warn);
        }

        docs.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
        resolve(docs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public static async getDocument(id: string): Promise<DocumentItem | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as DocumentItem | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  public static async saveDocument(doc: DocumentItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * High performance bulk document saving in a single IndexedDB transaction
   */
  public static async saveDocumentsBulk(docs: DocumentItem[]): Promise<void> {
    if (docs.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      docs.forEach((doc) => store.put(doc));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async deleteDocument(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public static async toggleStar(id: string): Promise<boolean> {
    const doc = await this.getDocument(id);
    if (!doc) return false;
    doc.isStarred = !doc.isStarred;
    await this.saveDocument(doc);
    return doc.isStarred;
  }

  /**
   * Imports a real local document file (.pdf, .docx, .xlsx, .hwp, .hwpx)
   */
  public static async importLocalDocument(file: File, folderName?: string): Promise<DocumentItem> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    let format: DocFormat = 'txt';
    if (ext === 'pdf') format = 'pdf';
    else if (ext === 'docx' || ext === 'doc') format = 'docx';
    else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') format = 'xlsx';
    else if (ext === 'hwp') format = 'hwp';
    else if (ext === 'hwpx') format = 'hwpx';
    else if (ext === 'epub') format = 'epub';
    else if (ext === 'pptx' || ext === 'ppt') format = 'pptx';

    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
    const folder = folderName || (file.webkitRelativePath ? file.webkitRelativePath.split('/')[0] : '내 문서 (Documents)');

    const initialAnalysis = KeywordEngine.analyzeDocumentText(title, `${title} ${folder}`);

    // Extract REAL 1st page visual thumbnail and text from binary file
    const realData = await RealDocExtractor.extractRealDocumentData(
      file,
      format,
      initialAnalysis.category
    );

    const deepAnalysis = KeywordEngine.analyzeDocumentText(
      title,
      `${title}\n${realData.extractedText}`
    );

    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title,
      fileName: file.name,
      fileSize: file.size,
      format,
      dateCreated: dateStr,
      dateModified: dateStr,
      pageCount: realData.pageCount,
      thumbnailUrl: realData.thumbnailUrl,
      previewSnippet: deepAnalysis.snippet,
      extractedText: realData.extractedText,
      keywords: deepAnalysis.keywords,
      category: deepAnalysis.category,
      folder,
      isStarred: false,
      author: '로컬 사용자',
      company: '내 컴퓨터',
    };

    await this.saveDocument(newDoc);
    return newDoc;
  }

  public static async resetToDefaultDocuments(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction('documents', 'readwrite');
    const store = tx.objectStore('documents');
    store.clear();
    SAMPLE_DOCUMENTS.forEach((doc) => store.put(doc));
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }
}
