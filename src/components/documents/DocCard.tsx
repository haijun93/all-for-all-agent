import React from 'react';
import type { DocumentItem, DocFormat } from '../../types/document';
import { Star, Eye } from 'lucide-react';

interface DocCardProps {
  doc: DocumentItem;
  isSelected: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onOpenViewer: (doc: DocumentItem) => void;
}

const FORMAT_CONFIG: Record<DocFormat, { label: string; bg: string; color: string }> = {
  pdf: { label: 'PDF', bg: 'rgba(234, 67, 53, 0.9)', color: '#ffffff' },
  docx: { label: 'WORD', bg: 'rgba(43, 87, 154, 0.9)', color: '#ffffff' },
  doc: { label: 'WORD', bg: 'rgba(43, 87, 154, 0.9)', color: '#ffffff' },
  xlsx: { label: 'EXCEL', bg: 'rgba(16, 124, 65, 0.9)', color: '#ffffff' },
  xls: { label: 'EXCEL', bg: 'rgba(16, 124, 65, 0.9)', color: '#ffffff' },
  hwp: { label: '한글(HWP)', bg: 'rgba(0, 85, 170, 0.9)', color: '#ffffff' },
  hwpx: { label: 'HWPX', bg: 'rgba(0, 102, 204, 0.9)', color: '#ffffff' },
  pptx: { label: 'PPT', bg: 'rgba(210, 71, 38, 0.9)', color: '#ffffff' },
  txt: { label: 'TXT', bg: 'rgba(100, 116, 139, 0.9)', color: '#ffffff' },
};

export const DocCard: React.FC<DocCardProps> = ({
  doc,
  isSelected,
  onToggleSelect,
  onToggleStar,
  onOpenViewer,
}) => {
  const formatBadge = FORMAT_CONFIG[doc.format] || FORMAT_CONFIG.txt;

  return (
    <div
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onOpenViewer(doc)}
      style={{ aspectRatio: '3 / 4.2', display: 'flex', flexDirection: 'column' }}
    >
      {/* 1st Page Visual Thumbnail Canvas Preview */}
      <div className="photo-card-img-wrapper" style={{ flex: 1, position: 'relative', background: '#0e121a' }}>
        <img
          src={doc.thumbnailUrl}
          alt={doc.title}
          className="photo-card-img"
          style={{ objectFit: 'contain', padding: 6 }}
          loading="lazy"
        />

        {/* Format Badge Top Left */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: formatBadge.bg,
            color: formatBadge.color,
            fontSize: '0.65rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 4,
            letterSpacing: 0.5,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}
        >
          {formatBadge.label}
        </div>

        {/* Selection Checkbox Top Right Overlay */}
        <div
          className="photo-card-select-overlay"
          onClick={(e) => onToggleSelect(doc.id, e)}
        >
          <div className={`checkbox-custom ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        {/* Hover Quick Actions */}
        <div className="photo-card-actions">
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: '#ffffff', background: 'rgba(0,0,0,0.5)', padding: 6 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenViewer(doc);
            }}
            title="문서 내용 열람"
          >
            <Eye size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: doc.isStarred ? '#fbbc05' : '#ffffff', background: 'rgba(0,0,0,0.5)', padding: 6 }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(doc.id, e);
            }}
            title="즐겨찾기 토글"
          >
            <Star size={15} fill={doc.isStarred ? '#fbbc05' : 'none'} />
          </button>
        </div>
      </div>

      {/* Document Meta Bottom Info Card */}
      <div className="photo-card-bottom-bar" style={{ padding: '8px 10px', background: '#131822' }}>
        <span
          className="photo-card-title"
          title={doc.title}
          style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}
        >
          {doc.title}
        </span>

        {/* Category & Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 500 }}>
            {doc.category.split(' ')[1] || doc.category}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {doc.dateCreated}
          </span>
        </div>

        {/* Extracted Keywords Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, overflow: 'hidden', height: 18 }}>
          {doc.keywords.slice(0, 3).map((kw) => (
            <span
              key={kw}
              style={{
                fontSize: '0.62rem',
                background: 'rgba(255, 255, 255, 0.06)',
                padding: '1px 4px',
                borderRadius: 3,
                color: 'var(--text-secondary)',
              }}
            >
              #{kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
