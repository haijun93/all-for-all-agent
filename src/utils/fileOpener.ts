import { isTauri, invoke } from '@tauri-apps/api/core';
import type { DocumentItem } from '../types/document';

/**
 * Opens the given document with the system's default application
 * (e.g., EPUB in Apple Books, PDF in Preview/Acrobat, DOCX in Word, etc.)
 */
export async function openWithDefaultApp(doc: DocumentItem): Promise<void> {
  const targetPath = doc.filePath || (doc.folder && doc.fileName ? `${doc.folder}/${doc.fileName}` : doc.id);
  
  if (isTauri()) {
    try {
      await invoke('open_file_with_default_app', { path: targetPath });
      console.log(`[FileOpener] Opened '${doc.fileName}' with default app (${targetPath})`);
    } catch (err: any) {
      console.error('[FileOpener] Failed to open file:', err);
      alert(`연결 프로그램으로 파일을 열 수 없습니다:\n${err?.message || err}`);
    }
  } else {
    alert(`웹 브라우저 보안 정책상 운영체제 연결 앱(Apple Books 등)을 직접 실행할 수 없습니다.\nTauri 데스크톱 앱에서 사용해 주세요.`);
  }
}
