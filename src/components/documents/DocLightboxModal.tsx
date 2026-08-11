import React, { useState, useEffect } from 'react';
import type { DocumentItem } from '../../types/document';
import {
  X,
  Download,
  Copy,
  Check,
  Star,
  FileText,
  ZoomIn,
  ZoomOut,
  Hash,
  ExternalLink
} from 'lucide-react';
import { openWithDefaultApp } from '../../utils/fileOpener';

interface DocLightboxModalProps {
  doc: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleStar: (id: string) => void;
}

export const DocLightboxModal: React.FC<DocLightboxModalProps> = ({
  doc,
  isOpen,
  onClose,
  onToggleStar,
}) => {
  if (!isOpen || !doc) return null;

  const [activeTab, setActiveTab] = useState<'visual' | 'text'>('visual');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(doc.extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = doc.thumbnailUrl;
    a.download = doc.fileName;
    a.click();
  };

  return (
    <div className="lightbox-container">
      {/* Top Floating Action Bar */}
      <div className="lightbox-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon-only" onClick={onClose} title="닫기 (Esc)">
            <X size={22} />
          </button>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
              {doc.title}
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              {doc.fileName} • {doc.format.toUpperCase()} • {doc.dateCreated}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Tab switcher: 1st Page Visual vs Extracted Text */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.1)', padding: 3, borderRadius: 8, gap: 3 }}>
            <button
              className={`btn btn-sm ${activeTab === 'visual' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('visual')}
            >
              <FileText size={14} />
              <span>1페이지 시각 프리뷰</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'text' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('text')}
            >
              <Hash size={14} />
              <span>추출된 본문 텍스트</span>
            </button>
          </div>

          <button
            className="btn btn-primary btn-sm"
            style={{
              background: 'linear-gradient(135deg, #107c41, #34a853)',
              boxShadow: '0 2px 10px rgba(52, 168, 83, 0.4)',
              fontWeight: 700,
              gap: 6
            }}
            onClick={() => openWithDefaultApp(doc)}
            title={`운영체제 기본 연결 프로그램으로 열기 (${doc.format.toUpperCase()})`}
          >
            <ExternalLink size={14} />
            <span>연결 앱으로 열기</span>
          </button>

          <button
            className={`btn btn-sm ${doc.isStarred ? 'btn-lucky' : 'btn-secondary'}`}
            onClick={() => onToggleStar(doc.id)}
            title="즐겨찾기 토글"
          >
            <Star size={14} fill={doc.isStarred ? '#fff' : 'none'} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleDownload} title="문서 다운로드">
            <Download size={14} />
            <span>다운로드</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lightbox-content" onClick={onClose} style={{ padding: 40 }}>
        {activeTab === 'visual' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: '90vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Visual Paper Sheet */}
            <div
              style={{
                boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
                borderRadius: 8,
                overflow: 'hidden',
                maxHeight: '80vh',
                display: 'inline-block',
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.15s ease',
              }}
            >
              <img
                src={doc.thumbnailUrl}
                alt={doc.title}
                style={{ maxHeight: '78vh', width: 'auto', display: 'block' }}
              />
            </div>

            {/* Bottom Floating Zoom Bar */}
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(18, 23, 31, 0.85)',
                backdropFilter: 'blur(10px)',
                padding: '6px 14px',
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                title="축소"
              >
                <ZoomOut size={15} />
              </button>
              <span style={{ fontSize: '0.74rem', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                title="확대"
              >
                <ZoomIn size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* Text Inspector Stage */
          <div
            style={{
              width: '100%',
              maxWidth: 860,
              background: '#131822',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {doc.category}
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginTop: 2 }}>
                  {doc.title}
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleCopyText}
                style={{ gap: 6 }}
              >
                {copied ? <Check size={14} color="#34a853" /> : <Copy size={14} />}
                <span>{copied ? '복사됨!' : '본문 텍스트 복사'}</span>
              </button>
            </div>

            {/* Keyword tags */}
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                AI 분석 핵심 키워드 (Keywords):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {doc.keywords.map((kw) => (
                  <span
                    key={kw}
                    style={{
                      fontSize: '0.74rem',
                      background: 'rgba(66, 133, 244, 0.15)',
                      border: '1px solid rgba(66, 133, 244, 0.3)',
                      color: '#60a5fa',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>

            {/* Extracted Text Content Box */}
            <div
              style={{
                background: '#0a0d13',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: 16,
                fontSize: '0.88rem',
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {doc.extractedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
