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
  };

  private static statusListeners = new Set<StatusListener>();
  private static docStreamListeners = new Set<DocStreamListener>();

  public static getStatus(): IndexingStatus {
    return { ...this.status };
  }

  public static setMinimized(minimized: boolean): void {
    this.status.isMinimized = minimized;
    this.notifyStatus();
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

  private static notifyStatus(): void {
    const s = this.getStatus();
    this.statusListeners.forEach((fn) => fn(s));
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
    if (this.status.isIndexing) return;

    this.status = {
      isIndexing: true,
      currentFileName: '폴더 탐색 시작...',
      scannedCount: 0,
      totalFound: 0,
      progressPercent: 0,
      docsPerSecond: 0,
      elapsedMs: 0,
      statusMessage: '디렉토리 실시간 1페이지 파싱 및 인덱싱 중...',
      isMinimized: false,
    };
    this.notifyStatus();

    const startTime = performance.now();
    const rootName = dirHandle.name;
    const instantDocs: DocumentItem[] = [];

    try {
      const traverse = async (handle: any, path: string) => {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|pptx?|txt)$/i.test(entry.name)) {
              const file = await entry.getFile();
              
              // Extract real 1st page visual thumbnail
              const doc = await this.createRealDocItem(file, path);
              instantDocs.push(doc);

              // Live stream each document to UI immediately
              FastDocIndex.addDocument(doc);
              this.docStreamListeners.forEach((fn) => fn(doc));

              // Compute live speedometer
              const elapsed = Math.max(1, performance.now() - startTime);
              const speed = Math.round((instantDocs.length / (elapsed / 1000)));

              this.status.currentFileName = file.name;
              this.status.scannedCount = instantDocs.length;
              this.status.totalFound = instantDocs.length;
              this.status.docsPerSecond = speed;
              this.status.elapsedMs = Math.round(elapsed);
              this.status.statusMessage = `⚡️ '${file.name}' 실제 1페이지 추출 및 인덱싱 완료`;
              this.notifyStatus();
            }
          } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            await traverse(entry, `${path}/${entry.name}`);
          }
        }
      };

      await traverse(dirHandle, rootName);

      // Bulk persist to IndexedDB
      await DocStorageService.saveDocumentsBulk(instantDocs);

      const totalElapsed = Math.max(1, performance.now() - startTime);
      const finalSpeed = Math.round((instantDocs.length / (totalElapsed / 1000)));

      this.status.isIndexing = false;
      this.status.progressPercent = 100;
      this.status.docsPerSecond = finalSpeed;
      this.status.elapsedMs = Math.round(totalElapsed);
      this.status.statusMessage = `인덱싱 완료! 총 ${instantDocs.length}개 실제 1페이지 썸네일 생성 (${(totalElapsed / 1000).toFixed(2)}초 소요, 초당 ${finalSpeed.toLocaleString()}개)`;
      this.notifyStatus();
    } catch (err) {
      console.error('Background indexer error:', err);
      this.status.isIndexing = false;
      this.status.statusMessage = '인덱싱 중 오류가 발생했습니다.';
      this.notifyStatus();
    }
  }

  /**
   * Starts non-blocking background indexing stream from FileList
   */
  public static async startIndexingFromFiles(files: FileList): Promise<void> {
    if (this.status.isIndexing) return;

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
    };
    this.notifyStatus();

    const startTime = performance.now();
    const instantDocs: DocumentItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (/\.(pdf|docx?|xlsx?|hwp|hwpx|epub|pptx?|txt)$/i.test(file.name)) {
        const folderPath = file.webkitRelativePath
          ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
          : '내 문서';

        const doc = await this.createRealDocItem(file, folderPath);
        instantDocs.push(doc);

        FastDocIndex.addDocument(doc);
        this.docStreamListeners.forEach((fn) => fn(doc));

        const elapsed = Math.max(1, performance.now() - startTime);
        const speed = Math.round((instantDocs.length / (elapsed / 1000)));

        this.status.currentFileName = file.name;
        this.status.scannedCount = instantDocs.length;
        this.status.progressPercent = Math.round(((i + 1) / files.length) * 100);
        this.status.docsPerSecond = speed;
        this.status.elapsedMs = Math.round(elapsed);
        this.status.statusMessage = `⚡️ '${file.name}' 실제 1페이지 추출 완료`;
        this.notifyStatus();
      }
    }

    await DocStorageService.saveDocumentsBulk(instantDocs);

    const totalElapsed = Math.max(1, performance.now() - startTime);
    const finalSpeed = Math.round((instantDocs.length / (totalElapsed / 1000)));

    this.status.isIndexing = false;
    this.status.progressPercent = 100;
    this.status.docsPerSecond = finalSpeed;
    this.status.elapsedMs = Math.round(totalElapsed);
    this.status.statusMessage = `인덱싱 완료! 총 ${instantDocs.length}개 실제 1페이지 썸네일 생성 (${(totalElapsed / 1000).toFixed(2)}초 소요, 초당 ${finalSpeed.toLocaleString()}개)`;
    this.notifyStatus();
  }
}
