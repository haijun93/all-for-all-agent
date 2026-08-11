import type { DocumentItem, DocFormat } from '../types/document';
import { KeywordEngine } from './keywordEngine';
import { FastDocIndex } from './fastDocIndex';
import { DocStorageService } from './docStorage';
import { RealDocExtractor } from './realDocExtractor';

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
    // 1. Single stream listener for fast lookup
    this.docStreamListeners.forEach((fn) => {
      try {
        fn(doc);
      } catch (e) {
        console.warn(e);
      }
    });

    // 2. Batch stream listener for React state batching (every 100ms)
    this.pendingBatch.push(doc);
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushDocBatch();
      }, 100);
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
   * Generates document item with REAL 1st page visual thumbnail extracted from actual binary file
   */
  public static async createRealDocItem(file: File, folderPath: string): Promise<DocumentItem> {
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
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

    const initialAnalysis = KeywordEngine.analyzeDocumentText(title, `${title} ${folderPath}`);

    // Extract REAL 1st page visual thumbnail & text from physical file
    const realData = await RealDocExtractor.extractRealDocumentData(
      file,
      format,
      initialAnalysis.category
    );

    // Re-analyze keywords on real extracted text
    const deepAnalysis = KeywordEngine.analyzeDocumentText(
      title,
      `${title}\n${realData.extractedText}`
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
   * Starts non-blocking background indexing stream from directory handle
   */
  public static async startIndexingFromHandle(dirHandle: any): Promise<void> {
    this.lastDirHandle = dirHandle;
    this.lastFileList = null;

    // Increment scan ID so any previous ongoing scan terminates gracefully
    const scanId = ++this.currentScanId;

    this.status = {
      isIndexing: true,
      currentFileName: '폴더 탐색 시작...',
      scannedCount: 0,
      totalFound: 0,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: `'${dirHandle.name}' 실시간 1페이지 파싱 및 인덱싱 시작...`,
      isMinimized: false,
      isHUDOpen: true,
    };
    this.notifyStatus();

    const startTime = performance.now();
    const rootName = dirHandle.name;
    const instantDocs: DocumentItem[] = [];

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

                // Extract real 1st page visual thumbnail
                const doc = await this.createRealDocItem(file, path);
                if (this.currentScanId !== scanId) return;

                instantDocs.push(doc);

                // Live stream each document in batches to prevent UI thread lockup
                FastDocIndex.addDocument(doc);
                this.enqueueDocStream(doc);

                // Compute live speedometer
                const elapsed = Math.max(1, performance.now() - startTime);
                const speed = Math.round((instantDocs.length / (elapsed / 1000)));

                this.status.currentFileName = file.name;
                this.status.scannedCount = instantDocs.length;
                this.status.totalFound = instantDocs.length;
                this.status.docsPerSecond = speed;
                this.status.elapsedMs = Math.round(elapsed);
                this.status.statusMessage = `⚡️ '${file.name}' 실제 1페이지 추출 및 인덱싱 완료`;
                this.notifyStatus(false);

                // Periodic incremental save to IndexedDB every 40 items to keep transactions fast
                if (instantDocs.length % 40 === 0) {
                  const chunk = instantDocs.slice(-40);
                  DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
                }

                // Cooperative event-loop yield (12ms) so UI stays 100% responsive and GC runs cleanly
                await new Promise((r) => setTimeout(r, 12));
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

      // Bulk persist to IndexedDB
      if (instantDocs.length > 0) {
        await DocStorageService.saveDocumentsBulk(instantDocs);
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round((instantDocs.length / (totalElapsed / 1000)));

      this.status.progressPercent = 100;
      this.status.docsPerSecond = finalSpeed;
      this.status.elapsedMs = Math.round(totalElapsed);
      this.status.statusMessage = `인덱싱 완료! 총 ${instantDocs.length}개 실제 1페이지 썸네일 생성 (${(totalElapsed / 1000).toFixed(2)}초 소요, 초당 ${finalSpeed.toLocaleString()}개)`;
      this.notifyStatus(true);
    } catch (err) {
      console.error('Background indexer error:', err);
      this.status.statusMessage = '인덱싱 중 오류가 발생했습니다.';
    } finally {
      this.flushDocBatch();
      if (this.currentScanId === scanId) {
        this.status.isIndexing = false;
        this.notifyStatus(true);
      }
    }
  }

  /**
   * Starts non-blocking background indexing stream from FileList
   */
  public static async startIndexingFromFiles(files: FileList): Promise<void> {
    this.lastFileList = files;
    this.lastDirHandle = null;

    const scanId = ++this.currentScanId;

    this.status = {
      isIndexing: true,
      currentFileName: '파일 분석 시작...',
      scannedCount: 0,
      totalFound: files.length,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: '실제 1페이지 추출 스트림 처리 중...',
      isMinimized: false,
      isHUDOpen: true,
    };
    this.notifyStatus();

    const startTime = performance.now();
    const instantDocs: DocumentItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        if (this.currentScanId !== scanId) return;

        const file = files[i];
        if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|zip|cbz|pptx?|txt)$/i.test(file.name)) {
          const folderPath = file.webkitRelativePath
            ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
            : '내 문서';

          try {
            const doc = await this.createRealDocItem(file, folderPath);
            if (this.currentScanId !== scanId) return;

            instantDocs.push(doc);

            FastDocIndex.addDocument(doc);
            this.enqueueDocStream(doc);

            const elapsed = Math.max(1, performance.now() - startTime);
            const speed = Math.round((instantDocs.length / (elapsed / 1000)));

            this.status.currentFileName = file.name;
            this.status.scannedCount = instantDocs.length;
            this.status.progressPercent = Math.round(((i + 1) / files.length) * 100);
            this.status.docsPerSecond = speed;
            this.status.elapsedMs = Math.round(elapsed);
            this.status.statusMessage = `⚡️ '${file.name}' 실제 1페이지 추출 완료`;
            this.notifyStatus(false);

            if (instantDocs.length % 40 === 0) {
              const chunk = instantDocs.slice(-40);
              DocStorageService.saveDocumentsBulk(chunk).catch(console.warn);
            }

            // Yield to browser event loop (12ms)
            await new Promise((r) => setTimeout(r, 12));
          } catch (fileErr) {
            console.warn('Error reading file:', file.name, fileErr);
          }
        }
      }

      this.flushDocBatch();

      if (this.currentScanId !== scanId) return;

      if (instantDocs.length > 0) {
        await DocStorageService.saveDocumentsBulk(instantDocs);
      }

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round((instantDocs.length / (totalElapsed / 1000)));

      this.status.progressPercent = 100;
      this.status.docsPerSecond = finalSpeed;
      this.status.elapsedMs = Math.round(totalElapsed);
      this.status.statusMessage = `인덱싱 완료! 총 ${instantDocs.length}개 실제 1페이지 썸네일 생성 (${(totalElapsed / 1000).toFixed(2)}초 소요, 초당 ${finalSpeed.toLocaleString()}개)`;
      this.notifyStatus(true);
    } catch (err) {
      console.error('Background indexer error:', err);
      this.status.statusMessage = '인덱싱 중 오류가 발생했습니다.';
    } finally {
      this.flushDocBatch();
      if (this.currentScanId === scanId) {
        this.status.isIndexing = false;
        this.notifyStatus(true);
      }
    }
  }
}
