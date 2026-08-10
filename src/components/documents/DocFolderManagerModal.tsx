import React, { useRef } from 'react';
import { BackgroundIndexer } from '../../services/backgroundIndexer';
import { DocStorageService } from '../../services/docStorage';
import { fileExplorerName } from '../../utils/platform';
import {
  FolderSearch,
  X,
  Trash2,
  FolderPlus,
  Zap,
  BookOpen
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
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
        onClose();
        // Start non-blocking background indexer
        await BackgroundIndexer.startIndexingFromHandle(dirHandle);
        onScanComplete();
      } else {
        fallbackInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn(err);
        fallbackInputRef.current?.click();
      }
    }
  };

  const handleFallbackFiles = async (files: FileList) => {
    onClose();
    await BackgroundIndexer.startIndexingFromFiles(files);
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
                Everything 백그라운드 문서 인덱서
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                PDF, Word, Excel, 한글(HWP/HWPX), 전자책(EPUB)을 논블로킹 백그라운드에서 즉시 색인합니다.
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tech Feature Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.15) 0%, rgba(147, 51, 234, 0.12) 100%)',
              border: '1px solid rgba(66, 133, 244, 0.35)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              gap: 12,
            }}
          >
            <Zap size={24} color="#fbbc05" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                  Voidtools Everything 2단계 백그라운드 가속 엔진
                </h4>
                <span style={{ fontSize: '0.68rem', background: '#9333ea', color: '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                  EPUB + HWP + OFFICE
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                스캔을 시작하면 창이 즉시 닫히며 <b>백그라운드에서 실시간 속도계(Speedometer)와 함께 문서들이 갤러리로 라이브 스트리밍</b>됩니다. 인덱싱 중에도 자유롭게 검색하고 문서를 열람하실 수 있습니다.
              </p>
            </div>
          </div>

          {/* Supported Format Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>지원 포맷:</span>
            <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>PDF</span>
            <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>DOCX / DOC</span>
            <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>XLSX / XLS</span>
            <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>한글 HWP / HWPX</span>
            <span style={{ fontSize: '0.72rem', background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              <BookOpen size={11} />
              <span>EPUB 전자책</span>
            </span>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="file"
              ref={fallbackInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              style={{ display: 'none' }}
              onClick={(e) => {
                (e.target as any).value = '';
              }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFallbackFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            <button
              className="btn btn-primary"
              style={{
                padding: '14px 20px',
                fontSize: '0.95rem',
                gap: 10,
                background: 'linear-gradient(135deg, #107c41, #34a853)',
              }}
              onClick={handleStartScan}
            >
              <FolderPlus size={20} />
              <span>⚡️ {fileExplorerName}에서 스캔할 문서/전자책 폴더 지정하기 (백그라운드 실행)</span>
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
        </div>
      </div>
    </div>
  );
};
