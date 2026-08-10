import React from 'react';
import type { PhotoExif } from '../../types/photo';
import { Camera, MapPin, X } from 'lucide-react';

interface ExifPanelProps {
  exif?: PhotoExif;
  title: string;
  onClose: () => void;
}

export const ExifPanel: React.FC<ExifPanelProps> = ({ exif, title, onClose }) => {
  if (!exif) {
    return (
      <aside className="exif-sidebar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="exif-header" style={{ margin: 0 }}>
            <Camera size={18} color="#4285f4" />
            <span>사진 정보 (EXIF)</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>이 사진의 메타데이터 정보가 없습니다.</p>
      </aside>
    );
  }

  const cameraName = exif.camera || `${exif.cameraMake || ''} ${exif.cameraModel || ''}`.trim() || '디지털 카메라';
  const width = exif.dimensions?.width || 1920;
  const height = exif.dimensions?.height || 1080;
  const lat = exif.location?.latitude || exif.location?.lat || 0;
  const lng = exif.location?.longitude || exif.location?.lng || 0;

  return (
    <aside className="exif-sidebar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="exif-header" style={{ margin: 0 }}>
          <Camera size={18} color="#4285f4" />
          <span>사진 정보 (EXIF)</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>{title}</h4>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{exif.dateTaken || '날짜 미지정'}</span>
      </div>

      {/* Picasa Exposure Triangle Cards */}
      <div className="exposure-triangle-grid">
        <div>
          <div className="exposure-cell-label">조리개</div>
          <div className="exposure-cell-val">{exif.aperture || 'f/2.8'}</div>
        </div>
        <div>
          <div className="exposure-cell-label">셔터속도</div>
          <div className="exposure-cell-val">{exif.shutterSpeed || '1/250s'}</div>
        </div>
        <div>
          <div className="exposure-cell-label">ISO 감도</div>
          <div className="exposure-cell-val">{exif.iso || 100}</div>
        </div>
      </div>

      {/* Detailed Spec List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="exif-row">
          <span className="exif-label">카메라 기종</span>
          <span className="exif-value">{cameraName}</span>
        </div>

        {exif.lens && (
          <div className="exif-row">
            <span className="exif-label">렌즈 사양</span>
            <span className="exif-value">{exif.lens}</span>
          </div>
        )}

        {exif.focalLength && (
          <div className="exif-row">
            <span className="exif-label">초점 거리</span>
            <span className="exif-value">{exif.focalLength}</span>
          </div>
        )}

        <div className="exif-row">
          <span className="exif-label">해상도</span>
          <span className="exif-value">
            {width} × {height} px
          </span>
        </div>

        {exif.fileSize && (
          <div className="exif-row">
            <span className="exif-label">파일 크기</span>
            <span className="exif-value">{exif.fileSize}</span>
          </div>
        )}

        {exif.location && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#34a853', fontSize: '0.8rem', fontWeight: 600 }}>
              <MapPin size={14} />
              <span>촬영 위치 정보</span>
            </div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              {exif.location.name}
            </div>
            {exif.location.city && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {exif.location.city}, {exif.location.province || ''} {exif.location.country || ''}
              </div>
            )}
            {lat !== 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                위도 {lat.toFixed(4)}°, 경도 {lng.toFixed(4)}°
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
