import React, { useState, useRef } from 'react';
import { DocStorageService } from '../../services/docStorage';
import { fileExplorerName, isWindows } from '../../utils/platform';
import {
  FolderSearch,
  HardDrive,
  AlertCircle,
  X,
  Trash2,
  FolderPlus,
  RefreshCw,
  Check
} from 'lucide-react';

interface DocFolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: () => void;
}

export const DocFolderManagerModal: React.FC<DocFolderManagerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleStartNativeScan = async () => {
    setErrorMessage(null);
    setIsScanning(true);
    setStatusText('문서 폴더 탐색 준비 중...');
    setScannedCount(0);

    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        const rootName = dirHandle.name;
        let count = 0;

        const processDir = async (handle: any, path: string) => {
          for await (const entry of handle.values()) {
            if (entry.kind === 'file') {
              const file = await entry.getFile();
              if (/\.(pdf|docx?|xlsx?|hwp|hwpx|pptx?|txt)$/i.test(file.name)) {
                try {
                  await DocStorageService.importLocalDocument(file, path);
                  count++;
                  setScannedCount(count);
                  setStatusText(`'${file.name}' 1페이지 썸네일 생성 및 키워드 분석 중... (${count}개)`);
                } catch (e) {
                  console.warn('Doc import error:', e);
                }
              }
            } else if (entry.kind === 'directory') {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
              await processDir(entry, `${path}/${entry.name}`);
            }
          }
        };

        await processDir(dirHandle, rootName);

        setIsScanning(false);
        setStatusText(`문서 인덱싱 완료! 총 ${count}개의 문서가 등록되었습니다.`);
        onScanComplete();
      } else {
        fallbackInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage('폴더 접근 권한이 취소되었거나 지원되지 않습니다.');
      }
      setIsScanning(false);
    }
  };

  const handleFallbackFiles = async (files: FileList) => {
    setIsScanning(true);
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (/\.(pdf|docx?|xlsx?|hwp|hwpx|pptx?|txt)$/i.test(file.name)) {
        const folderPath = file.webkitRelativePath
          ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
          : '내 문서 폴더';
        try {
          await DocStorageService.importLocalDocument(file, folderPath);
          count++;
          setScannedCount(count);
          setStatusText(`'${file.name}' 1페이지 썸네일 생성 및 키워드 분석 중... (${count}개)`);
        } catch (e) {
          console.warn(e);
        }
      }
    }

    setIsScanning(false);
    setStatusText(`문서 인덱싱 완료! 총 ${count}개의 문서가 등록되었습니다.`);
    onScanComplete();
  };

  const handleClearSampleDocs = async () => {
    if (confirm('샘플 문서를 비우고 내 컴퓨터 문서만 남기시겠습니까?')) {
      const docs = await DocStorageService.getAllDocuments();
      for (const d of docs) {
        if (d.id.startsWith('doc-') && d.company !== '내 컴퓨터') {
          await DocStorageService.deleteDocument(d.id);
        }
      }
      onScanComplete();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderSearch size={22} color="#4285f4" />
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>
                문서 폴더 관리자 (Doc Scanner)
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                내 컴퓨터의 PDF, Word, Excel, HWP 문서를 자동 스캔하고 1페이지 썸네일과 키워드를 추출합니다.
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              background: 'rgba(66, 133, 244, 0.08)',
              border: '1px solid rgba(66, 133, 244, 0.25)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              gap: 12,
            }}
          >
            <HardDrive size={24} color="#4285f4" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                실제 로컬 문서 폴더 지정 및 시각적 인덱싱
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {fileExplorerName}에서 원하는 문서 폴더(예: <code>{isWindows ? 'C:\\Users\\...\\Documents' : '~/Documents'}</code>, <code>업무폴더</code>)를 지정하면, <b>PDF, Word(.docx), Excel(.xlsx), 한글(.hwp/.hwpx)</b> 문서들을 탐색하여 첫 페이지를 고화질 시각 썸네일로 렌더링하고 본문 키워드를 추출합니다.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="file"
              ref={fallbackInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFallbackFiles(e.target.files)}
            />

            <button
              className="btn btn-primary"
              style={{ padding: '14px 20px', fontSize: '0.95rem', gap: 10 }}
              onClick={handleStartNativeScan}
              disabled={isScanning}
            >
              <FolderPlus size={20} />
              <span>{isScanning ? '문서 스캔 및 썸네일 생성 중...' : `📁 ${fileExplorerName}에서 스캔할 문서 폴더 지정하기`}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearSampleDocs}
              style={{ color: 'var(--text-secondary)', gap: 6 }}
            >
              <Trash2 size={13} color="#ea4335" />
              <span>샘플 문서 비우기 (내 컴퓨터 문서만 보기)</span>
            </button>
          </div>

          {/* Status Display */}
          {statusText && (
            <div
              style={{
                background: '#131822',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#4285f4', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} color="#34a853" />}
                  {isScanning ? '인덱싱 진행 중...' : '스캔 완료'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  발견된 문서: {scannedCount}개
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {statusText}
              </p>
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                background: 'rgba(234, 67, 53, 0.15)',
                border: '1px solid rgba(234, 67, 53, 0.3)',
                padding: '10px 14px',
                borderRadius: 8,
                color: 'var(--accent-red)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
