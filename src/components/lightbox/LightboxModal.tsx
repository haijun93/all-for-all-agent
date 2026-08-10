import React, { useState, useEffect, useCallback } from 'react';
import type { Photo } from '../../types/photo';
import { ExifPanel } from './ExifPanel';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Edit3,
  Star,
  Download,
  ZoomIn,
  ZoomOut,
  UserCheck
} from 'lucide-react';

interface LightboxModalProps {
  photo: Photo | null;
  photosList: Photo[];
  isOpen: boolean;
  onClose: () => void;
  onOpenEditor: (photo: Photo) => void;
  onToggleStar: (id: string) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  photo,
  photosList,
  isOpen,
  onClose,
  onOpenEditor,
  onToggleStar,
}) => {
  if (!isOpen || !photo) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExif, setShowExif] = useState(false);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Sync index when photo opens
  useEffect(() => {
    const idx = photosList.findIndex((p) => p.id === photo.id);
    if (idx !== -1) setCurrentIndex(idx);
    setZoomLevel(1);
  }, [photo, photosList]);

  const currentPhoto = photosList[currentIndex] || photo;

  const handleNext = useCallback(() => {
    if (photosList.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % photosList.length);
    setZoomLevel(1);
  }, [photosList]);

  const handlePrev = useCallback(() => {
    if (photosList.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + photosList.length) % photosList.length);
    setZoomLevel(1);
  }, [photosList]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'i' || e.key === 'I') setShowExif((prev) => !prev);
      if (e.key === 'e' || e.key === 'E') onOpenEditor(currentPhoto);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose, onOpenEditor, currentPhoto]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = currentPhoto.url;
    a.download = `${currentPhoto.title}.jpg`;
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
              {currentPhoto.title}
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)' }}>
              {currentIndex + 1} / {photosList.length} • {currentPhoto.folder}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Zoom controls */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
            title="축소"
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
            title="확대"
          >
            <ZoomIn size={16} />
          </button>

          <div style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.2)' }} />

          {/* Toggle Face Tags */}
          {currentPhoto.faces && currentPhoto.faces.length > 0 && (
            <button
              className={`btn btn-sm ${showFaceBoxes ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFaceBoxes(!showFaceBoxes)}
              title="얼굴 인식 박스 표시/숨김"
            >
              <UserCheck size={14} />
              <span>얼굴 태그 ({currentPhoto.faces.length})</span>
            </button>
          )}

          <button
            className={`btn btn-sm ${currentPhoto.isStarred ? 'btn-lucky' : 'btn-secondary'}`}
            onClick={() => onToggleStar(currentPhoto.id)}
            title="즐겨찾기 토글"
          >
            <Star size={14} fill={currentPhoto.isStarred ? '#fff' : 'none'} />
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onOpenEditor(currentPhoto)}
            title="Picasa 편집 스튜디오 열기 (E)"
          >
            <Edit3 size={14} />
            <span>편집하기</span>
          </button>

          <button
            className={`btn btn-sm ${showExif ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowExif(!showExif)}
            title="EXIF 촬영 정보 보기 (I)"
          >
            <Info size={14} />
            <span>정보</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleDownload} title="다운로드">
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="lightbox-content" onClick={onClose}>
        {/* Navigation Buttons */}
        {photosList.length > 1 && (
          <>
            <button
              className="lightbox-nav-btn prev"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              title="이전 사진 (Left Arrow)"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              className="lightbox-nav-btn next"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              title="다음 사진 (Right Arrow)"
            >
              <ChevronRight size={28} />
            </button>
          </>
        )}

        <div
          style={{ position: 'relative', display: 'inline-block' }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={currentPhoto.url}
            alt={currentPhoto.title}
            className="lightbox-image"
            style={{
              transform: `scale(${zoomLevel})`,
              cursor: zoomLevel > 1 ? 'grab' : 'default',
            }}
          />

          {/* Render Detected Face Bounding Boxes */}
          {showFaceBoxes &&
            currentPhoto.faces?.map((face) => (
              <div
                key={face.id}
                style={{
                  position: 'absolute',
                  left: `${face.box.x * 100}%`,
                  top: `${face.box.y * 100}%`,
                  width: `${face.box.width * 100}%`,
                  height: `${face.box.height * 100}%`,
                  border: '2px solid #4285f4',
                  borderRadius: 6,
                  boxShadow: '0 0 10px rgba(66, 133, 244, 0.6)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    transform: 'translateY(-100%)',
                    background: 'rgba(18, 23, 31, 0.9)',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    border: '1px solid #4285f4',
                    whiteSpace: 'nowrap',
                  }}
                >
                  👤 {face.personName}
                </div>
              </div>
            ))}
        </div>

        {/* EXIF Information Sidebar */}
        {showExif && (
          <div onClick={(e) => e.stopPropagation()}>
            <ExifPanel
              exif={currentPhoto.exif}
              title={currentPhoto.title}
              onClose={() => setShowExif(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
