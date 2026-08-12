import React, { useEffect, useRef } from 'react';
import type { Photo } from '../../types/photo';
import { Star, Check, Edit3, Zap } from 'lucide-react';
import { PhotoLightningIndexer } from '../../services/photoLightningIndexer';

interface PhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onOpenLightbox: (photo: Photo) => void;
  onOpenEditor: (photo: Photo) => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  isSelected,
  onToggleSelect,
  onToggleStar,
  onOpenLightbox,
  onOpenEditor,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isPlaceholder = photo.thumbnailUrl?.startsWith('data:image/svg+xml');
  const hasPendingEnrich = PhotoLightningIndexer.hasPendingEnrichment(photo.id);

  // Lazy real-image enrichment via IntersectionObserver: once a lightning-
  // scanned placeholder card scrolls into view, read the real file and
  // decode its actual thumbnail.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !hasPendingEnrich) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          const timer = setTimeout(() => {
            PhotoLightningIndexer.enrichPhoto(photo.id);
          }, 200);
          return () => clearTimeout(timer);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [photo.id, hasPendingEnrich]);

  const handleMouseEnter = () => {
    if (hasPendingEnrich) {
      PhotoLightningIndexer.enrichPhoto(photo.id);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`photo-card ${isSelected ? 'selected' : ''}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          onToggleSelect(photo.id, e);
        } else {
          onOpenLightbox(photo);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenEditor(photo);
      }}
      onMouseEnter={handleMouseEnter}
    >
      <img
        src={photo.thumbnailUrl || photo.url}
        alt={photo.title}
        className="photo-card-img"
        loading="lazy"
        style={isPlaceholder ? { objectFit: 'contain', padding: 24, opacity: 0.6 } : undefined}
      />

      {isPlaceholder && (
        <div
          title="Everything 초고속 모드 (스크롤/호버 시 실제 사진 자동 로딩)"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 2,
            background: 'rgba(251, 188, 5, 0.9)',
            color: '#000000',
            padding: '2px 4px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        >
          <Zap size={10} fill="#000000" />
        </div>
      )}

      {/* Overlay controls */}
      <div className="photo-card-overlay">
        <div className="photo-card-top-bar">
          <div
            className="photo-card-select-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(photo.id, e);
            }}
            title="사진 선택"
          >
            {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="photo-card-star-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditor(photo);
              }}
              title="편집 스튜디오 열기"
            >
              <Edit3 size={13} />
            </button>
            <button
              className={`photo-card-star-btn ${photo.isStarred ? 'starred' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(photo.id, e);
              }}
              title="즐겨찾기 토글"
            >
              <Star
                size={14}
                fill={photo.isStarred ? '#fbbc05' : 'none'}
                color={photo.isStarred ? '#fbbc05' : '#ffffff'}
              />
            </button>
          </div>
        </div>

        <div className="photo-card-bottom-bar">
          <span className="photo-card-title">{photo.title}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="photo-card-meta">
              {(photo.exif?.camera || photo.exif?.cameraMake || '사진').split(' ')[0]} • {photo.width || photo.exif?.dimensions?.width || 1920}×{photo.height || photo.exif?.dimensions?.height || 1080}
            </span>
            {photo.editParams && (
              <span
                style={{
                  fontSize: '0.62rem',
                  background: 'rgba(66, 133, 244, 0.6)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  color: '#fff',
                }}
              >
                수정됨
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
