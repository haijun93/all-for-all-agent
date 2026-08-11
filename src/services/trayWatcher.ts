import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { DocumentItem, DocFormat } from '../types/document';
import { FastDocIndex } from './fastDocIndex';
import { DocStorageService } from './docStorage';
import { KeywordEngine } from './keywordEngine';
import { DocRendererService } from './docRenderer';
import { BackgroundIndexer } from './backgroundIndexer';

interface FileChangeEventPayload {
  event_type: 'create' | 'modify' | 'remove';
  path: string;
  name: string;
  size: number;
  modified: number;
}

type LiveChangeCallback = (change: { type: 'add' | 'update' | 'delete'; docId: string; doc?: DocumentItem }) => void;

const WATCHED_FOLDERS_KEY = 'picasa_watched_folders';

export class TrayWatcherService {
  private static listeners = new Set<LiveChangeCallback>();
  private static isInitialized = false;
  private static unlistenFn: (() => void) | null = null;

  public static subscribe(callback: LiveChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public static destroy(): void {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.isInitialized = false;
  }

  private static notify(change: { type: 'add' | 'update' | 'delete'; docId: string; doc?: DocumentItem }) {
    this.listeners.forEach((fn) => {
      try {
        fn(change);
      } catch (err) {
        console.warn('[TrayWatcher] Listener error:', err);
      }
    });
  }

  /**
   * Initializes background OS kernel file watching listener.
   */
  public static async init(): Promise<void> {
    if (this.isInitialized || !isTauri()) return;
    this.isInitialized = true;

    console.log('[TrayWatcher] Initializing OS kernel real-time file watcher');

    this.unlistenFn = await listen<FileChangeEventPayload>('file-change-event', async (event) => {
      const payload = event.payload;
      console.log(`[TrayWatcher] ⚡ Real-time event: [${payload.event_type}] ${payload.name} (${payload.path})`);

      const folderStr = payload.path.substring(0, payload.path.length - payload.name.length);
      const docId = BackgroundIndexer.generateDocId(payload.path, payload.name);

      if (payload.event_type === 'remove') {
        // File Deleted
        FastDocIndex.removeDocument(docId);
        await DocStorageService.deleteDocument(docId);
        this.notify({ type: 'delete', docId });
      } else {
        // File Created or Modified
        const dateStr = new Date(payload.modified || Date.now()).toISOString().split('T')[0];
        const ext = payload.name.split('.').pop()?.toLowerCase() || 'txt';
        let format: DocFormat = 'txt';
        if (ext === 'pdf') format = 'pdf';
        else if (ext === 'docx' || ext === 'doc') format = 'docx';
        else if (ext === 'xlsx' || ext === 'xls') format = 'xlsx';
        else if (ext === 'hwp') format = 'hwp';
        else if (ext === 'hwpx') format = 'hwpx';
        else if (ext === 'epub') format = 'epub';
        else if (ext === 'zip') format = 'zip';
        else if (ext === 'cbz') format = 'cbz';
        else if (ext === 'pptx' || ext === 'ppt') format = 'pptx';

        const title = payload.name.replace(/\.[^/.]+$/, '');
        const analysis = KeywordEngine.analyzeDocumentText(title, `${title} ${folderStr}`);
        const thumbnailUrl = DocRendererService.generateInstantVectorThumbnail(title, format, analysis.category);

        const sizeStr = payload.size > 1048576
          ? `${(payload.size / 1048576).toFixed(1)}MB`
          : `${(payload.size / 1024).toFixed(0)}KB`;

        const doc: DocumentItem = {
          id: docId,
          title,
          fileName: payload.name,
          filePath: payload.path,
          fileSize: payload.size,
          format,
          dateCreated: dateStr,
          dateModified: dateStr,
          pageCount: undefined,
          thumbnailUrl,
          previewSnippet: `${title} (${sizeStr})`,
          extractedText: '',
          keywords: analysis.keywords,
          category: analysis.category,
          folder: folderStr,
          isStarred: false,
          author: '로컬 사용자',
          company: '내 컴퓨터',
        };

        FastDocIndex.addDocument(doc);
        await DocStorageService.saveDocument(doc);
        this.notify({ type: payload.event_type === 'create' ? 'add' : 'update', docId, doc });
      }
    });

    // Re-watch persisted folders
    this.restoreWatchedFolders();
  }

  /**
   * Registers a folder to be watched by Rust kernel file watcher.
   */
  public static async watchFolder(folderPath: string): Promise<void> {
    if (!isTauri() || !folderPath) return;

    try {
      await invoke('start_watching', { path: folderPath });
      const watched = this.getWatchedFolders();
      if (!watched.includes(folderPath)) {
        watched.push(folderPath);
        localStorage.setItem(WATCHED_FOLDERS_KEY, JSON.stringify(watched));
      }
      console.log(`[TrayWatcher] ✅ Registered watch on: ${folderPath}`);
    } catch (err) {
      console.warn(`[TrayWatcher] Failed to watch ${folderPath}:`, err);
    }
  }

  /**
   * Unregisters a folder from watching.
   */
  public static async unwatchFolder(folderPath: string): Promise<void> {
    if (!isTauri() || !folderPath) return;

    try {
      await invoke('stop_watching', { path: folderPath });
      const watched = this.getWatchedFolders().filter((p) => p !== folderPath);
      localStorage.setItem(WATCHED_FOLDERS_KEY, JSON.stringify(watched));
    } catch (err) {
      console.warn(`[TrayWatcher] Failed to unwatch ${folderPath}:`, err);
    }
  }

  public static getWatchedFolders(): string[] {
    try {
      const raw = localStorage.getItem(WATCHED_FOLDERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static async restoreWatchedFolders(): Promise<void> {
    const folders = this.getWatchedFolders();
    for (const f of folders) {
      try {
        await invoke('start_watching', { path: f });
      } catch (e) {
        console.warn('[TrayWatcher] Could not restore watch on', f, e);
      }
    }
  }
}
