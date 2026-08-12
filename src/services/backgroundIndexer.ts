import type { DocumentItem, DocFormat } from '../types/document';
import { KeywordEngine } from './keywordEngine';
import { FastDocIndex } from './fastDocIndex';
import { DocStorageService } from './docStorage';
import { RealDocExtractor } from './realDocExtractor';
import { DocRendererService } from './docRenderer';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TrayWatcherService } from './trayWatcher';

export interface IndexingStatus {
  isIndexing: boolean;
  currentFileName: string;
  scannedCount: number;
  totalFound: number;
  progressPercent: number;
  docsPerSecond: number;
  elapsedMs: number;
  statusMessage: string;
  isMinimized: boolean;
  isHUDOpen: boolean;
}

type StatusListener = (status: IndexingStatus) => void;
type DocStreamListener = (newDoc: DocumentItem) => void;

export class BackgroundIndexer {
  private static status: IndexingStatus = {
    isIndexing: false,
    currentFileName: '',
    scannedCount: 0,
    totalFound: 0,
    progressPercent: 0,
    docsPerSecond: 0,
    elapsedMs: 0,
    statusMessage: '대기 중',
    isMinimized: false,
    isHUDOpen: false,
  };

  private static currentScanId = 0;
  private static lastDirHandle: any = null;
  private static lastFileList: FileList | null = null;
  private static statusListeners = new Set<StatusListener>();
  private static docStreamListeners = new Set<DocStreamListener>();
  private static docBatchListeners = new Set<(batch: DocumentItem[]) => void>();

  private static pendingBatch: DocumentItem[] = [];
  private static batchTimer: any = null;
  private static lastNotifyTime = 0;
  private static notifyTimer: any = null;

  public static getStatus(): IndexingStatus {
    return { ...this.status };
  }

  public static nextScanId(): number {
    return ++this.currentScanId;
  }

  public static getCurrentScanId(): number {
    return this.currentScanId;
  }

  public static setLastScan(handle: any, fileList: FileList | null): void {
    this.lastDirHandle = handle;
    this.lastFileList = fileList;
  }

  public static updateStatus(partial: Partial<IndexingStatus>, force = false): void {
    this.status = { ...this.status, ...partial };
    this.notifyStatus(force);
  }

  public static showHUD(): void {
    this.status.isHUDOpen = true;
    this.status.isMinimized = false;
    this.notifyStatus(true);
  }

  public static hideHUD(): void {
    this.status.isHUDOpen = false;
    this.notifyStatus(true);
  }

  public static toggleHUD(): void {
    if (!this.status.isHUDOpen) {
      this.status.isHUDOpen = true;
      this.status.isMinimized = false;
    } else if (!this.status.isMinimized) {
      this.status.isMinimized = true;
    } else {
      this.status.isMinimized = false;
    }
    this.notifyStatus(true);
  }

  public static setMinimized(minimized: boolean): void {
    this.status.isMinimized = minimized;
    if (!minimized) {
      this.status.isHUDOpen = true;
    }
    this.notifyStatus(true);
  }

  public static cancelCurrentScan(): void {
    this.currentScanId++;
    this.status.isIndexing = false;
    this.status.currentFileName = '🛑 인덱싱 중지됨';
    this.status.statusMessage = '사용자에 의해 인덱싱이 즉시 중지되었습니다.';
    this.flushDocBatch();
    this.notifyStatus(true);
  }

  public static async resumeOrRestartScan(): Promise<void> {
    if (this.lastDirHandle) {
      await this.startIndexingFromHandle(this.lastDirHandle);
    } else if (this.lastFileList && this.lastFileList.length > 0) {
      await this.startIndexingFromFiles(this.lastFileList);
    }
  }

  public static canRestartScan(): boolean {
    return !!this.lastDirHandle || (!!this.lastFileList && this.lastFileList.length > 0);
  }

  public static subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public static subscribeDocStream(listener: DocStreamListener): () => void {
    this.docStreamListeners.add(listener);
    return () => this.docStreamListeners.delete(listener);
  }

  public static subscribeDocBatch(listener: (batch: DocumentItem[]) => void): () => void {
    this.docBatchListeners.add(listener);
    return () => this.docBatchListeners.delete(listener);
  }

  public static enqueueDocStream(doc: DocumentItem): void {
    // Batch stream listener for React state batching (every 120ms or 10 items)
    this.pendingBatch.push(doc);
    if (this.pendingBatch.length >= 10) {
      this.flushDocBatch();
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushDocBatch();
      }, 120);
    }
  }

  public static flushDocBatch(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.pendingBatch.length === 0) return;
    const batch = [...this.pendingBatch];
    this.pendingBatch = [];
    this.docBatchListeners.forEach((fn) => {
      try {
        fn(batch);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  private static notifyStatus(force = false): void {
    const now = performance.now();
    if (force || now - this.lastNotifyTime >= 100) {
      if (this.notifyTimer) {
        clearTimeout(this.notifyTimer);
        this.notifyTimer = null;
      }
      this.lastNotifyTime = now;
      const s = this.getStatus();
      this.statusListeners.forEach((fn) => {
        try {
          fn(s);
        } catch (e) {
          console.warn(e);
        }
      });
    } else if (!this.notifyTimer) {
      this.notifyTimer = setTimeout(() => {
        this.notifyTimer = null;
        this.notifyStatus(true);
      }, 100);
    }
  }

  /**
   * Generates a stable unique ID based on file path and name
   */
  public static generateDocId(folderPath: string, fileName: string): string {
    const raw = `${folderPath}/${fileName}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return `doc-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Infers a DocFormat from a file name's extension.
   */
  public static inferFormat(fileName: string): DocFormat {
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc') return 'docx';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
    if (ext === 'hwp') return 'hwp';
    if (ext === 'hwpx') return 'hwpx';
    if (ext === 'epub') return 'epub';
    if (ext === 'zip') return 'zip';
    if (ext === 'cbz') return 'cbz';
    if (ext === 'pptx' || ext === 'ppt') return 'pptx';
    return 'txt';
  }

  /**
   * Generates document item with REAL 1st page visual thumbnail extracted from actual binary file
   */
  public static async createRealDocItem(file: File, folderPath: string): Promise<DocumentItem> {
    const format = this.inferFormat(file.name);
    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

    const initialAnalysis = KeywordEngine.analyzeDocumentText(title, `${title} ${folderPath}`);

    // Extract REAL 1st page visual thumbnail & text from physical file
    const realData = await RealDocExtractor.extractRealDocumentData(
      file,
      format,
      initialAnalysis.category
    );

    // Re-analyze keywords on real extracted text (truncated to save memory)
    const truncatedText = realData.extractedText.slice(0, 500);
    const deepAnalysis = KeywordEngine.analyzeDocumentText(
      title,
      `${title}\n${truncatedText}`
    );

    return {
      id: this.generateDocId(folderPath, file.name),
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
      folder: folderPath,
      isStarred: false,
      author: '로컬 사용자',
      company: '내 컴퓨터',
    };
  }

  /**
   * Builds a document item using the native Rust extractor (extract_and_analyze),
   * bypassing the WebView JS engine entirely for parsing/keyword analysis.
   * Used by both the deep-scan path and Lightning's native enrichment path.
   */
  public static async createRealDocItemNative(
    filePath: string,
    format: DocFormat,
    folderPath: string,
    fileSize: number,
    modifiedMs: number
  ): Promise<DocumentItem> {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const title = fileName.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(modifiedMs || Date.now()).toISOString().split('T')[0];
    const docId = this.generateDocId(folderPath, fileName);

    const result = await invoke<{
      text: string;
      page_count: number;
      cover_data_url: string | null;
      category: string;
      keywords: string[];
      snippet: string;
    }>('extract_and_analyze', { path: filePath, format });

    const thumbnailUrl =
      result.cover_data_url ||
      DocRendererService.generateDocumentFirstPageThumbnail(
        title,
        format,
        result.category,
        result.snippet || title,
        dateStr,
        '작성자'
      );

    return {
      id: docId,
      title,
      fileName,
      filePath,
      fileSize,
      format,
      dateCreated: dateStr,
      dateModified: dateStr,
      pageCount: result.page_count,
      thumbnailUrl,
      previewSnippet: result.snippet,
      extractedText: result.text,
      keywords: result.keywords,
      category: result.category,
      folder: folderPath,
      isStarred: false,
      author: '로컬 사용자',
      company: '내 컴퓨터',
    };
  }

  /**
   * Starts non-blocking background 1st page deep scanning in Tauri native environment.
   */
  public static async startDeepScanFromPath(folderPath: string): Promise<void> {
    const scanId = ++this.currentScanId;
    this.lastDirHandle = null;
    this.lastFileList = null;

    const folderName = folderPath.split(/[\/\\]/).pop() || folderPath;

    this.status = {
      isIndexing: true,
      currentFileName: '📦 캐시 및 파일 목록 확인 중...',
      scannedCount: 0,
      totalFound: 0,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: `'${folderName}' 정밀 1페이지 색인 준비 중...`,
      isMinimized: false,
      isHUDOpen: true,
    };
    this.notifyStatus(true);

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

    // 1. Collect all files via Rust scanner
    const allFiles: Array<{ path: string; name: string; size: number; modified: number }> = [];

    const unsubBatch = await listen('scan-batch', (event: any) => {
      const batch = event.payload as Array<{ path: string; name: string; size: number; modified: number }>;
      allFiles.push(...batch);
    });

    try {
      await invoke('scan_directory', { path: folderPath });
    } catch (err) {
      console.warn('[BackgroundIndexer] scan_directory error:', err);
    } finally {
      unsubBatch();
    }

    if (this.currentScanId !== scanId) return;

    const totalFiles = allFiles.length;
    this.status.totalFound = totalFiles;
    this.notifyStatus(true);

    const startTime = performance.now();
    let processedCount = 0;
    let skippedCount = 0;
    let newCount = 0;
    let unpersistedBuffer: DocumentItem[] = [];

    for (const fileItem of allFiles) {
      if (this.currentScanId !== scanId) return;

      processedCount++;
      const docId = this.generateDocId(fileItem.path, fileItem.name);
      const dateStr = new Date(fileItem.modified).toISOString().split('T')[0];

      // Incremental cache check
      const cached = indexCache.get(docId);
      if (cached && cached.fileSize === fileItem.size && cached.dateModified === dateStr) {
        skippedCount++;
        const cachedDoc = cachedDocMap.get(docId);
        if (cachedDoc) {
          FastDocIndex.addDocument(cachedDoc);
          this.enqueueDocStream(cachedDoc);
        }
      } else {
        // Full extraction natively in Rust — no bytes cross the IPC bridge,
        // no WebView JS engine involved.
        try {
          const folderStr = fileItem.path.substring(0, fileItem.path.length - fileItem.name.length);
          const format = this.inferFormat(fileItem.name);
          const doc = await this.createRealDocItemNative(
            fileItem.path,
            format,
            folderStr,
            fileItem.size,
            fileItem.modified
          );
          doc.id = docId;

          newCount++;
          unpersistedBuffer.push(doc);
          FastDocIndex.addDocument(doc);
          this.enqueueDocStream(doc);

          if (unpersistedBuffer.length >= 10) {
            const chunk = [...unpersistedBuffer];
            unpersistedBuffer = [];
            await DocStorageService.saveDocumentsBulk(chunk);
          }
        } catch (readErr) {
          console.warn('[BackgroundIndexer] Extraction failed for:', fileItem.name, readErr);
        }
      }

      const elapsed = Math.max(1, performance.now() - startTime);
      const speed = Math.round(processedCount / (elapsed / 1000));
      const percent = totalFiles > 0 ? Math.round((processedCount / totalFiles) * 100) : 0;

      this.updateStatus({
        currentFileName: `📄 [${processedCount}/${totalFiles}] ${fileItem.name}`,
        scannedCount: processedCount,
        progressPercent: percent,
        docsPerSecond: speed,
        elapsedMs: Math.round(elapsed),
        statusMessage: `📄 1페이지 정밀 색인 중: ${processedCount}/${totalFiles} (신규 ${newCount}, 캐시 ${skippedCount})`,
      }, false);

      // Yield UI thread between extractions
      await new Promise((r) => setTimeout(r, 4));
    }

    this.flushDocBatch();
    if (unpersistedBuffer.length > 0) {
      await DocStorageService.saveDocumentsBulk(unpersistedBuffer);
      unpersistedBuffer = [];
    }

    const totalElapsed = Math.max(1, performance.now() - startTime);
    const finalSpeed = Math.round(processedCount / (totalElapsed / 1000));

    this.updateStatus({
      progressPercent: 100,
      docsPerSecond: finalSpeed,
      elapsedMs: Math.round(totalElapsed),
      statusMessage: `✅ 전체 1페이지 정밀 색인 완료! 총 ${processedCount}개 (신규 ${newCount}, 캐시 ${skippedCount})`,
      isIndexing: false,
      isHUDOpen: true,
    }, true);

    // Auto-watch folder in background
    TrayWatcherService.watchFolder(folderPath);
  }

  /**
   * Starts non-blocking background indexing stream from directory handle.
   * Uses incremental indexing: pre-loads an IndexedDB fingerprint cache and
   * skips files that were already indexed with identical size + date.
   * Second scans of the same folder complete in seconds instead of minutes.
   */
  public static async startIndexingFromHandle(dirHandle: any): Promise<void> {
    this.lastDirHandle = dirHandle;
    this.lastFileList = null;

    // Increment scan ID so any previous ongoing scan terminates gracefully
    const scanId = ++this.currentScanId;

    this.status = {
      isIndexing: true,
      currentFileName: '📦 기존 인덱스 캐시 로딩 중...',
      scannedCount: 0,
      totalFound: 0,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: `'${dirHandle.name}' 증분 인덱싱 시작 — 이전 캐시 확인 중...`,
      isMinimized: false,
      isHUDOpen: true,
    };
    this.notifyStatus();

    // 1. Pre-load lightweight fingerprint cache from IndexedDB (O(n) cursor scan, ~50ms for 1000 docs)
    let indexCache: Map<string, { fileSize: number; dateModified: string }>;
    try {
      indexCache = await DocStorageService.buildIndexCache();
    } catch {
      indexCache = new Map();
    }

    // Also pre-load full cached docs to stream to UI immediately
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
    let skippedCount = 0;
    let newCount = 0;
    let unpersistedBuffer: DocumentItem[] = [];

    try {
      const traverse = async (handle: any, path: string) => {
        if (this.currentScanId !== scanId) return;

        for await (const entry of handle.values()) {
          if (this.currentScanId !== scanId) return;

          if (entry.kind === 'file') {
            if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(entry.name)) {
              try {
                const file = await entry.getFile();
                if (this.currentScanId !== scanId) return;

                totalCount++;
                const docId = this.generateDocId(path, file.name);
                const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

                // 2. Incremental check: skip if already indexed with same size + date
                const cached = indexCache.get(docId);
                if (cached && cached.fileSize === file.size && cached.dateModified === dateStr) {
                  skippedCount++;
                  // Stream the cached doc to UI without re-parsing
                  const cachedDoc = cachedDocMap.get(docId);
                  if (cachedDoc) {
                    FastDocIndex.addDocument(cachedDoc);
                    this.enqueueDocStream(cachedDoc);
                  }

                  // Lightweight status update (no heavy extraction)
                  const elapsed = Math.max(1, performance.now() - startTime);
                  this.status.currentFileName = `⏭️ ${file.name} (캐시 히트)`;
                  this.status.scannedCount = totalCount;
                  this.status.totalFound = totalCount;
                  this.status.docsPerSecond = Math.round(totalCount / (elapsed / 1000));
                  this.status.elapsedMs = Math.round(elapsed);
                  this.status.statusMessage = `⚡️ 캐시 히트: '${file.name}' — 스킵 ${skippedCount}개, 신규 ${newCount}개`;
                  this.notifyStatus(false);

                  // Minimal yield for cached files (1ms — no heavy work done)
                  if (totalCount % 20 === 0) {
                    await new Promise((r) => setTimeout(r, 1));
                  }
                  continue;
                }

                // 3. New or modified file — full extraction required
                const doc = await this.createRealDocItem(file, path);
                if (this.currentScanId !== scanId) return;

                newCount++;
                unpersistedBuffer.push(doc);

                // Live stream each document in batches to prevent UI thread lockup
                FastDocIndex.addDocument(doc);
                this.enqueueDocStream(doc);

                // Compute live speedometer
                const elapsed = Math.max(1, performance.now() - startTime);
                const speed = Math.round((totalCount / (elapsed / 1000)));

                this.status.currentFileName = file.name;
                this.status.scannedCount = totalCount;
                this.status.totalFound = totalCount;
                this.status.docsPerSecond = speed;
                this.status.elapsedMs = Math.round(elapsed);
                this.status.statusMessage = `🆕 '${file.name}' 신규 파싱 완료 — 스킵 ${skippedCount}개, 신규 ${newCount}개`;
                this.notifyStatus(false);

                // Periodic incremental save to IndexedDB in lightweight chunks of 20 items
                if (unpersistedBuffer.length >= 20) {
                  const chunk = [...unpersistedBuffer];
                  unpersistedBuffer = [];
                  DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
                }

                // Cooperative event-loop yield (25ms) so UI stays 100% responsive and GC runs cleanly
                await new Promise((r) => setTimeout(r, 25));

                // Give GC a longer breathing window every 50 files to reclaim accumulated garbage
                if (newCount % 50 === 0) {
                  await new Promise((r) => setTimeout(r, 100));
                }
              } catch (fileErr) {
                console.warn('Error reading file:', entry.name, fileErr);
              }
            }
          } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
            await traverse(entry, `${path}/${entry.name}`);
          }
        }
      };

      await traverse(dirHandle, rootName);
      this.flushDocBatch();

      if (this.currentScanId !== scanId) return;

      // Save remaining unpersisted items
      if (unpersistedBuffer.length > 0) {
        await DocStorageService.saveDocumentsBulk(unpersistedBuffer);
        unpersistedBuffer = [];
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round((totalCount / (totalElapsed / 1000)));

      this.status.progressPercent = 100;
      this.status.docsPerSecond = finalSpeed;
      this.status.elapsedMs = Math.round(totalElapsed);
      this.status.statusMessage = `✅ 인덱싱 완료! 총 ${totalCount}개 (캐시 히트 ${skippedCount}개, 신규 파싱 ${newCount}개) — ${(totalElapsed / 1000).toFixed(2)}초 소요`;
      this.notifyStatus(true);
    } catch (err) {
      console.error('Background indexer error:', err);
      this.status.statusMessage = '인덱싱 중 오류가 발생했습니다.';
    } finally {
      this.flushDocBatch();
      if (unpersistedBuffer.length > 0) {
        DocStorageService.saveDocumentsBulk(unpersistedBuffer).catch(console.warn);
      }
      if (this.currentScanId === scanId) {
        this.status.isIndexing = false;
        this.notifyStatus(true);
      }
    }
  }

  /**
   * Starts non-blocking background indexing stream from FileList.
   * Uses incremental indexing: pre-loads an IndexedDB fingerprint cache and
   * skips files that were already indexed with identical size + date.
   */
  public static async startIndexingFromFiles(files: FileList): Promise<void> {
    this.lastFileList = files;
    this.lastDirHandle = null;

    const scanId = ++this.currentScanId;

    this.status = {
      isIndexing: true,
      currentFileName: '📦 기존 인덱스 캐시 로딩 중...',
      scannedCount: 0,
      totalFound: files.length,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: '증분 인덱싱 시작 — 이전 캐시 확인 중...',
      isMinimized: false,
      isHUDOpen: true,
    };
    this.notifyStatus();

    // Pre-load incremental indexing cache
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
    let skippedCount = 0;
    let newCount = 0;
    let unpersistedBuffer: DocumentItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        if (this.currentScanId !== scanId) return;

        const file = files[i];
        if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(file.name)) {
          const folderPath = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
            : '내 문서';

          totalCount++;
          const docId = this.generateDocId(folderPath, file.name);
          const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

          // Incremental check: skip if already indexed
          const cached = indexCache.get(docId);
          if (cached && cached.fileSize === file.size && cached.dateModified === dateStr) {
            skippedCount++;
            const cachedDoc = cachedDocMap.get(docId);
            if (cachedDoc) {
              FastDocIndex.addDocument(cachedDoc);
              this.enqueueDocStream(cachedDoc);
            }

            const elapsed = Math.max(1, performance.now() - startTime);
            this.status.currentFileName = `⏭️ ${file.name} (캐시 히트)`;
            this.status.scannedCount = totalCount;
            this.status.progressPercent = Math.round(((i + 1) / files.length) * 100);
            this.status.docsPerSecond = Math.round(totalCount / (elapsed / 1000));
            this.status.elapsedMs = Math.round(elapsed);
            this.status.statusMessage = `⚡️ 캐시 히트: '${file.name}' — 스킵 ${skippedCount}개, 신규 ${newCount}개`;
            this.notifyStatus(false);

            if (totalCount % 20 === 0) {
              await new Promise((r) => setTimeout(r, 1));
            }
            continue;
          }

          try {
            const doc = await this.createRealDocItem(file, folderPath);
            if (this.currentScanId !== scanId) return;

            newCount++;
            unpersistedBuffer.push(doc);

            FastDocIndex.addDocument(doc);
            this.enqueueDocStream(doc);

            const elapsed = Math.max(1, performance.now() - startTime);
            const speed = Math.round((totalCount / (elapsed / 1000)));

            this.status.currentFileName = file.name;
            this.status.scannedCount = totalCount;
            this.status.progressPercent = Math.round(((i + 1) / files.length) * 100);
            this.status.docsPerSecond = speed;
            this.status.elapsedMs = Math.round(elapsed);
            this.status.statusMessage = `🆕 '${file.name}' 신규 파싱 완료 — 스킵 ${skippedCount}개, 신규 ${newCount}개`;
            this.notifyStatus(false);

            if (unpersistedBuffer.length >= 20) {
              const chunk = [...unpersistedBuffer];
              unpersistedBuffer = [];
              DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
            }

            // Yield to browser event loop (25ms)
            await new Promise((r) => setTimeout(r, 25));

            // Give GC a longer breathing window every 50 new files
            if (newCount % 50 === 0) {
              await new Promise((r) => setTimeout(r, 100));
            }
          } catch (fileErr) {
            console.warn('Error reading file:', file.name, fileErr);
          }
        }
      }

      this.flushDocBatch();

      if (this.currentScanId !== scanId) return;

      if (unpersistedBuffer.length > 0) {
        await DocStorageService.saveDocumentsBulk(unpersistedBuffer);
        unpersistedBuffer = [];
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round((totalCount / (totalElapsed / 1000)));

      this.status.progressPercent = 100;
      this.status.docsPerSecond = finalSpeed;
      this.status.elapsedMs = Math.round(totalElapsed);
      this.status.statusMessage = `✅ 인덱싱 완료! 총 ${totalCount}개 (캐시 히트 ${skippedCount}개, 신규 파싱 ${newCount}개) — ${(totalElapsed / 1000).toFixed(2)}초 소요`;
      this.notifyStatus(true);
    } catch (err) {
      console.error('Background indexer error:', err);
      this.status.statusMessage = '인덱싱 중 오류가 발생했습니다.';
    } finally {
      this.flushDocBatch();
      if (unpersistedBuffer.length > 0) {
        DocStorageService.saveDocumentsBulk(unpersistedBuffer).catch(console.warn);
      }
      if (this.currentScanId === scanId) {
        this.status.isIndexing = false;
        this.notifyStatus(true);
      }
    }
  }
}

