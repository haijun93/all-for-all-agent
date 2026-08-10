import React, { useState, useRef } from 'react';
import { UploadCloud, FolderUp, Image as ImageIcon, X, CheckCircle2 } from 'lucide-react';
import { StorageService } from '../../services/storage';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [customFolder, setCustomFolder] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    let count = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          await StorageService.importLocalFile(file, customFolder || undefined);
          count++;
          setImportedCount(count);
        } catch (err) {
          console.error('Failed to import file:', file.name, err);
        }
      }
    }

    setIsProcessing(false);
    onImportComplete();
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UploadCloud size={20} color="#4285f4" />
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
              사진 가져오기 (Import Photos)
            </h3>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              저장할 폴더 이름 (선택사항):
            </label>
            <input
              type="text"
              className="search-input"
              style={{
                background: 'var(--bg-input)',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                width: '100%',
              }}
              placeholder="예: 2024 여름 휴가, 가족 모임..."
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
            />
          </div>

          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 12,
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: isDragging ? 'rgba(66, 133, 244, 0.1)' : 'rgba(255, 255, 255, 0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud
              size={48}
              color={isDragging ? '#4285f4' : '#64748b'}
              style={{ marginBottom: 12 }}
            />
            <h4 style={{ fontSize: '1rem', marginBottom: 6 }}>
              사진 파일을 이곳으로 드래그 앤 드롭하세요
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              JPEG, PNG, WebP, GIF 등 모든 이미지 파일 지원
            </p>
          </div>

          {/* Action Buttons for file/folder picker */}
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && processFiles(e.target.files)}
            />
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={16} />
              <span>사진 파일 선택</span>
            </button>

            <input
              type="file"
              ref={folderInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && processFiles(e.target.files)}
            />
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp size={16} />
              <span>전체 폴더 가져오기</span>
            </button>
          </div>

          {isProcessing && (
            <div
              style={{
                background: 'rgba(66, 133, 244, 0.15)',
                padding: '12px 16px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#4285f4',
              }}
            >
              <CheckCircle2 size={18} className="animate-spin" />
              <span>사진을 라이브러리에 등록하는 중입니다... ({importedCount}장 완료)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
