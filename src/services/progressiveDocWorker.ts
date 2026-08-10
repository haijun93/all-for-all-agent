import type { DocumentItem } from '../types/document';
import { DocRendererService } from './docRenderer';
import { DocStorageService } from './docStorage';
import { FastDocIndex } from './fastDocIndex';

type UpdateCallback = (updatedDoc: DocumentItem) => void;

/**
 * Background Progressive Worker Queue
 * Enriches documents with high-res 1st page thumbnails and deep analysis in idle time without blocking UI.
 */
export class ProgressiveDocWorker {
  private static queue: DocumentItem[] = [];
  private static isProcessing = false;
  private static listeners = new Set<UpdateCallback>();

  public static subscribe(callback: UpdateCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Enqueues documents for background progressive high-res rendering
   */
  public static enqueueDocuments(docs: DocumentItem[]): void {
    for (const doc of docs) {
      if (doc.thumbnailUrl.startsWith('data:image/svg+xml')) {
        this.queue.push(doc);
      }
    }
    this.startWorker();
  }

  private static startWorker(): void {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const processNext = () => {
      if (this.queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      const doc = this.queue.shift();
      if (doc) {
        try {
          const highResThumb = DocRendererService.generateDocumentFirstPageThumbnail(
            doc.title,
            doc.format,
            doc.category,
            doc.previewSnippet || doc.title,
            doc.dateCreated,
            doc.author
          );

          doc.thumbnailUrl = highResThumb;
          FastDocIndex.addDocument(doc);
          DocStorageService.saveDocument(doc);

          // Notify UI listeners
          this.listeners.forEach((cb) => cb(doc));
        } catch (e) {
          console.warn('Background render error:', e);
        }
      }

      // Schedule next item during browser idle time or next tick
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => processNext(), { timeout: 30 });
      } else {
        setTimeout(processNext, 8);
      }
    };

    processNext();
  }
}
