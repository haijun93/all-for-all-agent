import { StorageService } from './storage';

export interface ScanProgress {
  currentFolder: string;
  foundImages: number;
  isScanning: boolean;
  statusText: string;
}

export class FolderScannerService {
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
