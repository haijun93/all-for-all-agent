import { invoke } from '@tauri-apps/api/core';

/**
 * Thin wrapper around the Rust-side pause/cancel flags shared by every
 * scan_directory call. One global pair is enough since only one folder
 * scan (photo or document) runs at a time in practice — both modes'
 * Phase-1 scans invoke the same Rust command, so this single control
 * surface backs the pause/stop/restart buttons in both.
 */
export class ScanControlService {
  private static _isPaused = false;

  public static get isPaused(): boolean {
    return this._isPaused;
  }

  /** Clears local pause state without touching the Rust side — call this
   * when starting a brand-new scan, since scan_directory itself resets its
   * own flags on every call but the JS-side mirror (used by JS-loop
   * checkpoints like the document deep scan) needs the same reset. */
  public static reset(): void {
    this._isPaused = false;
  }

  public static async pause(): Promise<void> {
    this._isPaused = true;
    try {
      await invoke('pause_scan');
    } catch (e) {
      console.warn('[ScanControlService] pause_scan failed:', e);
    }
  }

  public static async resume(): Promise<void> {
    this._isPaused = false;
    try {
      await invoke('resume_scan');
    } catch (e) {
      console.warn('[ScanControlService] resume_scan failed:', e);
    }
  }

  public static async cancel(): Promise<void> {
    this._isPaused = false;
    try {
      await invoke('cancel_scan');
    } catch (e) {
      console.warn('[ScanControlService] cancel_scan failed:', e);
    }
  }

  /** Cooperative pause checkpoint for JS-side per-item loops (e.g. the
   * document deep scan's per-file extraction loop). Await this between
   * items; it resolves immediately when not paused. */
  public static async waitWhilePaused(): Promise<void> {
    while (this._isPaused) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
