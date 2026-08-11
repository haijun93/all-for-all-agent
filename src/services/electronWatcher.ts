import type { DocumentItem, DocFormat } from '../types/document';
import { FastDocIndex } from './fastDocIndex';
import { DocStorageService } from './docStorage';
import { KeywordEngine } from './keywordEngine';
import { RealDocExtractor } from './realDocExtractor';

export interface FileChangeEvent {
  eventType: 'added' | 'modified' | 'deleted';
  filePath: string;
  fileName: string;
  folderPath: string;
  size: number;
  lastModified: number;
}

type ChangeListener = (event: FileChangeEvent, doc?: DocumentItem) => void;

export class ElectronWatcherService {
  private static listeners = new Set<ChangeListener>();
  private static isInitialized = false;

  public static isElectronAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  }

  public static subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    if (!this.isInitialized && this.isElectronAvailable()) {
      this.initWatcher();
    }
    return () => this.listeners.delete(listener);
  }

  public static async addWatchFolder(folderPath: string): Promise<boolean> {
    if (this.isElectronAvailable()) {
      return (window as any).electronAPI.addWatchFolder(folderPath);
    }
    return false;
  }

  public static async removeWatchFolder(folderPath: string): Promise<boolean> {
    if (this.isElectronAvailable()) {
      return (window as any).electronAPI.removeWatchFolder(folderPath);
    }
    return false;
  }

  public static async getWatchFolders(): Promise<string[]> {
    if (this.isElectronAvailable()) {
      return (window as any).electronAPI.getWatchFolders();
    }
    return [];
  }

  private static initWatcher(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const api = (window as any).electronAPI;
    if (!api?.onFileChange) return;

    api.onFileChange(async (change: FileChangeEvent) => {
      console.log('[ElectronWatcher] Real-time file change detected:', change);

      const ext = change.fileName.split('.').pop()?.toLowerCase() || 'txt';
      const isSupported = /\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(change.fileName);
      if (!isSupported) return;

      let format: DocFormat = 'txt';
      if (ext === 'pdf') format = 'pdf';
      else if (ext === 'docx' || ext === 'doc') format = 'docx';
      else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') format = 'xlsx';
      else if (ext === 'hwp') format = 'hwp';
      else if (ext === 'hwpx') format = 'hwpx';
      else if (ext === 'epub') format = 'epub';
      else if (ext === 'zip') format = 'zip';
      else if (ext === 'cbz') format = 'cbz';
      else if (ext === 'pptx' || ext === 'ppt') format = 'pptx';

      const docId = `doc-${Math.abs(this.hashCode(`${change.folderPath}/${change.fileName}`)).toString(36)}`;

      if (change.eventType === 'deleted') {
        FastDocIndex.removeDocument(docId);
        await DocStorageService.deleteDocument(docId);
        this.listeners.forEach((fn) => fn(change));
        return;
      }

      // Added or Modified: read file buffer and extract real 1st page thumbnail
      try {
        const arrayBuffer = await api.readLocalFile(change.filePath);
        if (!arrayBuffer) return;

        const blob = new Blob([arrayBuffer]);
        const file = new File([blob], change.fileName, {
          lastModified: change.lastModified,
          type: blob.type,
        });

        const title = change.fileName.replace(/\.[^/.]+$/, '');
        const dateStr = new Date(change.lastModified).toISOString().split('T')[0];

        const initialAnalysis = KeywordEngine.analyzeDocumentText(title, `${title} ${change.folderPath}`);
        const realData = await RealDocExtractor.extractRealDocumentData(file, format, initialAnalysis.category);
        const deepAnalysis = KeywordEngine.analyzeDocumentText(title, `${title}\n${realData.extractedText}`);

        const updatedDoc: DocumentItem = {
          id: docId,
          title,
          fileName: change.fileName,
          fileSize: change.size,
          format,
          dateCreated: dateStr,
          dateModified: dateStr,
          pageCount: realData.pageCount,
          thumbnailUrl: realData.thumbnailUrl,
          previewSnippet: deepAnalysis.snippet,
          extractedText: realData.extractedText,
          keywords: deepAnalysis.keywords,
          category: deepAnalysis.category,
          folder: change.folderPath,
          isStarred: false,
          author: '로컬 사용자',
          company: '내 컴퓨터 (실시간 감시)',
        };

        FastDocIndex.addDocument(updatedDoc);
        await DocStorageService.saveDocument(updatedDoc);

        this.listeners.forEach((fn) => fn(change, updatedDoc));
      } catch (err) {
        console.error('[ElectronWatcher] Failed to process changed file:', err);
      }
    });
  }

  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
