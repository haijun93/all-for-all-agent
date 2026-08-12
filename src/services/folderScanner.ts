import { StorageService } from './storage';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ScanProgress {
  currentFolder: string;
  foundImages: number;
  isScanning: boolean;
  statusText: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'];

export class FolderScannerService {
  /**
   * Scans a local directory using the Tauri Rust backend (real OS folder
   * picker + filesystem access). Unlike showDirectoryPicker, this has no
   * Chromium "blocked system folder" restriction, since it never goes
   * through the browser's File System Access API at all.
   */
  public static async scanLocalDirectoryNative(
    path: string,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<number> {
    const rootFolderName = path.split(/[\\/]/).pop() || path;
    let foundCount = 0;
    const pendingWork: Promise<void>[] = [];

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: 0,
      isScanning: true,
      statusText: `'${rootFolderName}' 폴더를 검색하는 중...`,
    });

    const unsubBatch = await listen('scan-batch', (event: any) => {
      const files: Array<{ path: string; name: string; size: number; modified: number }> = event.payload;

      const work = (async () => {
        for (const f of files) {
          try {
            const rawBytes: number[] = await invoke('read_file_binary', { path: f.path });
            const blob = new Blob([new Uint8Array(rawBytes)]);
            const file = new File([blob], f.name, { lastModified: f.modified });
            const folderPath = f.path.substring(0, f.path.length - f.name.length) || rootFolderName;

            await StorageService.importLocalFile(file, folderPath);
            foundCount++;
            onProgress?.({
              currentFolder: folderPath,
              foundImages: foundCount,
              isScanning: true,
              statusText: `'${f.name}' 인덱싱 중... (총 ${foundCount}장)`,
            });
          } catch (e) {
            console.warn('Skipping unreadable photo:', f.name, e);
          }
        }
      })();

      pendingWork.push(work);
    });

    try {
      await invoke('scan_directory', { path, extensions: IMAGE_EXTENSIONS });
    } finally {
      unsubBatch();
    }

    await Promise.all(pendingWork);

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: foundCount,
      isScanning: false,
      statusText: `스캔 완료! 총 ${foundCount}장의 실제 로컬 사진이 등록되었습니다.`,
    });

    return foundCount;
  }

  /**
   * Scans a local directory on Mac using the File System Access API (showDirectoryPicker)
   */
  public static async scanLocalDirectoryPicker(
    onProgress?: (progress: ScanProgress) => void
  ): Promise<number> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('FILE_SYSTEM_API_NOT_SUPPORTED');
    }

    // Open native Mac folder selector
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'read',
    });

    const rootFolderName = dirHandle.name;
    let foundCount = 0;

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: 0,
      isScanning: true,
      statusText: `'${rootFolderName}' 폴더를 검색하는 중...`,
    });

    const processDirectory = async (
      handle: any,
      path: string
    ): Promise<void> => {
      for await (const entry of handle.values()) {
        try {
          if (entry.kind === 'file') {
            // A single unreadable file (OneDrive cloud-only placeholder, a
            // locked/permission-denied file, a broken reparse point, etc.)
            // must not abort the entire scan — skip it and keep going.
            const file = await entry.getFile();
            if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name)) {
              await StorageService.importLocalFile(file, path);
              foundCount++;
              onProgress?.({
                currentFolder: path,
                foundImages: foundCount,
                isScanning: true,
                statusText: `'${file.name}' 인덱싱 중... (총 ${foundCount}장)`,
              });
            }
          } else if (entry.kind === 'directory') {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const subPath = `${path}/${entry.name}`;
            await processDirectory(entry, subPath);
          }
        } catch (e) {
          console.warn('Skipping unreadable entry:', entry.name, e);
        }
      }
    };

    await processDirectory(dirHandle, rootFolderName);

    onProgress?.({
      currentFolder: rootFolderName,
      foundImages: foundCount,
      isScanning: false,
      statusText: `스캔 완료! 총 ${foundCount}장의 실제 로컬 사진이 등록되었습니다.`,
    });

    return foundCount;
  }
}
