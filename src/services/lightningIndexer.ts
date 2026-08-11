import type { DocumentItem, DocFormat } from '../types/document';
import { DocRendererService } from './docRenderer';
import { KeywordEngine } from './keywordEngine';
import { FastDocIndex } from './fastDocIndex';
import { DocStorageService } from './docStorage';
import { BackgroundIndexer } from './backgroundIndexer';

/**
 * ⚡ Lightning Indexer — Everything-style instant file scanning.
 * 
 * Collects ONLY file metadata (name, size, date) without reading file content.
 * No binary parsing, no PDF.js, no JSZip, no Canvas rendering.
 * 
 * Performance: ~878 files in ~1.5 - 2.5 seconds (vs minutes for full extraction).
 * 
 * After the lightning scan completes, a background enrichment pass lazily
 * extracts real thumbnails for files visible in the viewport.
 */
export class LightningIndexer {
  private static fileSystemObserver: any = null;
  private static enrichmentQueue: Map<string, { file: File; folderPath: string }> = new Map();
  private static enrichmentAbortId = 0;
  private static enrichmentListeners = new Set<(doc: DocumentItem) => void>();

  public static subscribeEnrichment(listener: (doc: DocumentItem) => void): () => void {
    this.enrichmentListeners.add(listener);
    return () => this.enrichmentListeners.delete(listener);
  }

  private static notifyEnrichment(doc: DocumentItem): void {
    this.enrichmentListeners.forEach((fn) => {
      try {
        fn(doc);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  /**
   * Phase 1: Lightning Scan from Directory Handle
   */
  public static async lightningscan(dirHandle: any): Promise<void> {
    const scanId = BackgroundIndexer.nextScanId();
    BackgroundIndexer.setLastScan(dirHandle, null);

    console.log(`[LightningIndexer] Starting Lightning Scan for '${dirHandle.name}' (Scan ID: ${scanId})`);

    BackgroundIndexer.updateStatus({
      isIndexing: true,
      currentFileName: '⚡ Everything 초고속 스캔 시작...',
      scannedCount: 0,
      totalFound: 0,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: `⚡ '${dirHandle.name}' Everything 모드 — 초고속 색인 중...`,
      isMinimized: false,
      isHUDOpen: true,
    }, true);

    // 1. Pre-load incremental cache
    let indexCache: Map<string, { fileSize: number; dateModified: string }>;
    try {
      indexCache = await DocStorageService.buildIndexCache();
    } catch {
      indexCache = new Map();
    }

    let cachedDocs: DocumentItem[] = [];
    try {
      cachedDocs = await DocStorageService.getAllDocuments();
    } catch {
      cachedDocs = [];
    }
    const cachedDocMap = new Map<string, DocumentItem>();
    for (const d of cachedDocs) cachedDocMap.set(d.id, d);

    const startTime = performance.now();
    const rootName = dirHandle.name;
    let totalCount = 0;
    let cacheHits = 0;
    let newLightning = 0;
    let unpersistedBuffer: DocumentItem[] = [];

    this.enrichmentQueue.clear();
    this.enrichmentAbortId++;

    try {
      const traverse = async (handle: any, path: string) => {
        if (BackgroundIndexer.getCurrentScanId() !== scanId) return;

        for await (const entry of handle.values()) {
          if (BackgroundIndexer.getCurrentScanId() !== scanId) return;

          if (entry.kind === 'file') {
            if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(entry.name)) {
              try {
                // getFile() retrieves metadata without reading binary content
                const file = await entry.getFile();
                if (BackgroundIndexer.getCurrentScanId() !== scanId) return;

                totalCount++;
                const docId = BackgroundIndexer.generateDocId(path, file.name);
                const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

                // Incremental cache check
                const cached = indexCache.get(docId);
                if (cached && cached.fileSize === file.size && cached.dateModified === dateStr) {
                  cacheHits++;
                  const cachedDoc = cachedDocMap.get(docId);
                  if (cachedDoc) {
                    FastDocIndex.addDocument(cachedDoc);
                    BackgroundIndexer.enqueueDocStream(cachedDoc);
                  }
                } else {
                  newLightning++;
                  // Instant lightweight doc item with zero binary overhead
                  const doc = this.createLightningDocItem(file, path, docId, dateStr);
                  FastDocIndex.addDocument(doc);
                  BackgroundIndexer.enqueueDocStream(doc);
                  unpersistedBuffer.push(doc);

                  // Queue for background lazy enrichment when scrolled into view
                  this.enrichmentQueue.set(docId, { file, folderPath: path });

                  if (unpersistedBuffer.length >= 30) {
                    const chunk = [...unpersistedBuffer];
                    unpersistedBuffer = [];
                    DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
                  }
                }

                // Live status update
                const elapsed = Math.max(1, performance.now() - startTime);
                const speed = Math.round(totalCount / (elapsed / 1000));

                BackgroundIndexer.updateStatus({
                  currentFileName: `⚡ ${file.name}`,
                  scannedCount: totalCount,
                  totalFound: totalCount,
                  docsPerSecond: speed,
                  elapsedMs: Math.round(elapsed),
                  statusMessage: `⚡ Everything 초고속: ${totalCount}개 발견 (캐시 ${cacheHits}, 신규 ${newLightning})`,
                }, false);

                // Tiny cooperative yield to keep UI responsive
                if (totalCount % 20 === 0) {
                  await new Promise((r) => setTimeout(r, 2));
                }
              } catch (fileErr) {
                console.warn('[LightningIndexer] Error reading file:', entry.name, fileErr);
              }
            }
          } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__MACOSX') continue;
            await traverse(entry, `${path}/${entry.name}`);
          }
        }
      };

      await traverse(dirHandle, rootName);
      BackgroundIndexer.flushDocBatch();

      if (unpersistedBuffer.length > 0) {
        await DocStorageService.saveDocumentsBulk(unpersistedBuffer);
        unpersistedBuffer = [];
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round(totalCount / (totalElapsed / 1000));

      BackgroundIndexer.updateStatus({
        progressPercent: 100,
        docsPerSecond: finalSpeed,
        elapsedMs: Math.round(totalElapsed),
        statusMessage: `⚡ Everything 스캔 완료! 총 ${totalCount}개 (캐시 ${cacheHits}, 신규 ${newLightning}) — ${(totalElapsed / 1000).toFixed(2)}초 (초당 ${finalSpeed.toLocaleString()}개)`,
        isIndexing: false,
      }, true);

      console.log(`[LightningIndexer] ✅ Scan completed: ${totalCount} files in ${(totalElapsed / 1000).toFixed(2)}s`);

      // Start FileSystemObserver for real-time monitoring
      this.startFileSystemObserver(dirHandle);

    } catch (err) {
      console.error('[LightningIndexer] Scan failed:', err);
      BackgroundIndexer.updateStatus({
        statusMessage: 'Lightning 인덱싱 중 오류가 발생했습니다.',
        isIndexing: false,
      }, true);
    }
  }

  /**
   * Phase 1: Lightning Scan from FileList
   */
  public static async startScanFromFiles(files: FileList): Promise<void> {
    const scanId = BackgroundIndexer.nextScanId();
    BackgroundIndexer.setLastScan(null, files);

    console.log(`[LightningIndexer] Starting Lightning Scan from FileList (${files.length} files)`);

    BackgroundIndexer.updateStatus({
      isIndexing: true,
      currentFileName: '⚡ Lightning Scan 시작...',
      scannedCount: 0,
      totalFound: files.length,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: `⚡ 파일 ${files.length}개 Everything 모드 초고속 색인 중...`,
      isMinimized: false,
      isHUDOpen: true,
    }, true);

    let indexCache: Map<string, { fileSize: number; dateModified: string }>;
    try {
      indexCache = await DocStorageService.buildIndexCache();
    } catch {
      indexCache = new Map();
    }

    let cachedDocs: DocumentItem[] = [];
    try {
      cachedDocs = await DocStorageService.getAllDocuments();
    } catch {
      cachedDocs = [];
    }
    const cachedDocMap = new Map<string, DocumentItem>();
    for (const d of cachedDocs) cachedDocMap.set(d.id, d);

    const startTime = performance.now();
    let totalCount = 0;
    let cacheHits = 0;
    let newLightning = 0;
    let unpersistedBuffer: DocumentItem[] = [];

    this.enrichmentQueue.clear();
    this.enrichmentAbortId++;

    try {
      for (let i = 0; i < files.length; i++) {
        if (BackgroundIndexer.getCurrentScanId() !== scanId) return;

        const file = files[i];
        if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(file.name)) {
          const folderPath = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
            : '내 문서';

          totalCount++;
          const docId = BackgroundIndexer.generateDocId(folderPath, file.name);
          const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

          const cached = indexCache.get(docId);
          if (cached && cached.fileSize === file.size && cached.dateModified === dateStr) {
            cacheHits++;
            const cachedDoc = cachedDocMap.get(docId);
            if (cachedDoc) {
              FastDocIndex.addDocument(cachedDoc);
              BackgroundIndexer.enqueueDocStream(cachedDoc);
            }
          } else {
            newLightning++;
            const doc = this.createLightningDocItem(file, folderPath, docId, dateStr);
            FastDocIndex.addDocument(doc);
            BackgroundIndexer.enqueueDocStream(doc);
            unpersistedBuffer.push(doc);

            this.enrichmentQueue.set(docId, { file, folderPath });

            if (unpersistedBuffer.length >= 30) {
              const chunk = [...unpersistedBuffer];
              unpersistedBuffer = [];
              DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
            }
          }

          const elapsed = Math.max(1, performance.now() - startTime);
          const speed = Math.round(totalCount / (elapsed / 1000));

          BackgroundIndexer.updateStatus({
            currentFileName: `⚡ ${file.name}`,
            scannedCount: totalCount,
            progressPercent: Math.round(((i + 1) / files.length) * 100),
            docsPerSecond: speed,
            elapsedMs: Math.round(elapsed),
            statusMessage: `⚡ Everything 초고속: ${totalCount}/${files.length}개 (캐시 ${cacheHits}, 신규 ${newLightning})`,
          }, false);

          if (totalCount % 20 === 0) {
            await new Promise((r) => setTimeout(r, 2));
          }
        }
      }

      BackgroundIndexer.flushDocBatch();

      if (unpersistedBuffer.length > 0) {
        await DocStorageService.saveDocumentsBulk(unpersistedBuffer);
        unpersistedBuffer = [];
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round(totalCount / (totalElapsed / 1000));

      BackgroundIndexer.updateStatus({
        progressPercent: 100,
        docsPerSecond: finalSpeed,
        elapsedMs: Math.round(totalElapsed),
        statusMessage: `⚡ Everything 스캔 완료! 총 ${totalCount}개 — ${(totalElapsed / 1000).toFixed(2)}초 (초당 ${finalSpeed.toLocaleString()}개)`,
        isIndexing: false,
      }, true);

    } catch (err) {
      console.error('[LightningIndexer] FileList scan failed:', err);
      BackgroundIndexer.updateStatus({
        statusMessage: 'Lightning 인덱싱 중 오류가 발생했습니다.',
        isIndexing: false,
      }, true);
    }
  }

  /**
   * Creates a lightweight DocumentItem using only file metadata.
   */
  private static createLightningDocItem(
    file: File,
    folderPath: string,
    docId: string,
    dateStr: string
  ): DocumentItem {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
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

    const title = file.name.replace(/\.[^/.]+$/, '');
    const analysis = KeywordEngine.analyzeDocumentText(title, `${title} ${folderPath}`);
    const thumbnailUrl = DocRendererService.generateInstantVectorThumbnail(title, format, analysis.category);

    const sizeStr = file.size > 1048576
      ? `${(file.size / 1048576).toFixed(1)}MB`
      : `${(file.size / 1024).toFixed(0)}KB`;

    return {
      id: docId,
      title,
      fileName: file.name,
      fileSize: file.size,
      format,
      dateCreated: dateStr,
      dateModified: dateStr,
      pageCount: undefined,
      thumbnailUrl,
      previewSnippet: `${title} (${sizeStr})`,
      extractedText: '',
      keywords: analysis.keywords,
      category: analysis.category,
      folder: folderPath,
      isStarred: false,
      author: '로컬 사용자',
      company: '내 컴퓨터',
    };
  }

  /**
   * Phase 2: Background Enrichment — lazily extract real thumbnails.
   */
  public static async enrichDocument(docId: string): Promise<DocumentItem | null> {
    const queued = this.enrichmentQueue.get(docId);
    if (!queued) return null;

    try {
      const doc = await BackgroundIndexer.createRealDocItem(queued.file, queued.folderPath);
      this.enrichmentQueue.delete(docId);

      DocStorageService.saveDocument(doc).catch(console.warn);
      FastDocIndex.addDocument(doc);
      this.notifyEnrichment(doc);

      return doc;
    } catch (err) {
      console.warn('[LightningIndexer] Enrichment failed for', docId, err);
      this.enrichmentQueue.delete(docId);
      return null;
    }
  }

  public static hasPendingEnrichment(docId: string): boolean {
    return this.enrichmentQueue.has(docId);
  }

  public static getEnrichmentQueueSize(): number {
    return this.enrichmentQueue.size;
  }

  /**
   * Phase 3: FileSystemObserver — real-time file change monitoring.
   */
  private static async startFileSystemObserver(dirHandle: any): Promise<void> {
    if (this.fileSystemObserver) {
      try {
        this.fileSystemObserver.disconnect();
      } catch {
        // ignore
      }
      this.fileSystemObserver = null;
    }

    if (!('FileSystemObserver' in globalThis)) {
      console.log('[LightningIndexer] FileSystemObserver not available in browser');
      return;
    }

    try {
      const observer = new (globalThis as any).FileSystemObserver(async (records: any[]) => {
        for (const record of records) {
          try {
            const changeType = record.type;
            const changedHandle = record.changedHandle;

            if (!changedHandle || changedHandle.kind !== 'file') continue;
            if (!/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(changedHandle.name)) continue;

            if (changeType === 'appeared' || changeType === 'modified') {
              const file = await changedHandle.getFile();
              const docId = BackgroundIndexer.generateDocId('watched', file.name);
              const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
              const doc = this.createLightningDocItem(file, 'watched', docId, dateStr);

              FastDocIndex.addDocument(doc);
              BackgroundIndexer.enqueueDocStream(doc);
              BackgroundIndexer.flushDocBatch();
              DocStorageService.saveDocument(doc).catch(console.warn);

              console.log(`[FileSystemObserver] 🆕 ${changeType}: ${changedHandle.name}`);
            } else if (changeType === 'disappeared') {
              console.log(`[FileSystemObserver] 🗑️ disappeared: ${changedHandle.name}`);
            }
          } catch (e) {
            console.warn('[FileSystemObserver] Error processing record:', e);
          }
        }
      });

      await observer.observe(dirHandle, { recursive: true });
      this.fileSystemObserver = observer;
      console.log(`[LightningIndexer] ✅ FileSystemObserver active for '${dirHandle.name}'`);
    } catch (err) {
      console.warn('[LightningIndexer] FileSystemObserver setup failed:', err);
    }
  }

  public static stopObserver(): void {
    if (this.fileSystemObserver) {
      try {
        this.fileSystemObserver.disconnect();
      } catch {
        // ignore
      }
      this.fileSystemObserver = null;
      console.log('[LightningIndexer] FileSystemObserver disconnected');
    }
  }

  public static isObserving(): boolean {
    return this.fileSystemObserver !== null;
  }
}
