import React, { useMemo } from 'react';
import type { Photo, GroupBy } from '../../types/photo';
import { PhotoCard } from './PhotoCard';
import { Folder, Calendar, CheckSquare, Sparkles, MapPin, Globe2 } from 'lucide-react';

interface GalleryViewProps {
  photos: Photo[];
  selectedPhotoIds: Set<string>;
  thumbSize: number;
  groupBy: GroupBy;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onOpenLightbox: (photo: Photo) => void;
  onOpenEditor: (photo: Photo) => void;
  onSelectGroup: (photoIds: string[]) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  photos,
  selectedPhotoIds,
  thumbSize,
  groupBy,
  onToggleSelect,
  onToggleStar,
  onOpenLightbox,
  onOpenEditor,
  onSelectGroup,
}) => {
  // Group photos based on grouping setting
  const groupedData = useMemo(() => {
    const groups: { [key: string]: Photo[] } = {};

    photos.forEach((photo) => {
      let key = '기타';
      if (groupBy === 'folder') {
        key = photo.folder || '기본 폴더';
      } else if (groupBy === 'date') {
        if (photo.dateTaken) {
          const parts = photo.dateTaken.split('-');
          key = parts.length >= 2 ? `${parts[0]}년 ${parseInt(parts[1], 10)}월` : photo.dateTaken;
        } else {
          const d = new Date(photo.dateAdded || photo.date || Date.now());
          key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
        }
      } else if (groupBy === 'place') {
        key = photo.exif?.location?.name || '위치 정보 미지정 스팟';
      } else if (groupBy === 'region') {
        const loc = photo.exif?.location;
        key = loc
          ? `${loc.country ? loc.country + ' • ' : ''}${loc.province || loc.city || '기타 지역'}`
          : '위치 정보 미지정 지역';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    });

    return Object.entries(groups).map(([title, items]) => ({
      title,
      photos: items,
      key: title,
    }));
  }, [photos, groupBy]);

  if (photos.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text-muted)',
        }}
      >
        <Sparkles size={48} color="#4285f4" />
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          사진이 없습니다
        </h3>
        <p style={{ fontSize: '0.9rem' }}>
          상단의 <b>[사진 가져오기]</b> 또는 <b>[폴더 관리자]</b> 버튼을 눌러 컴퓨터에 있는 사진을 추가하거나 샘플을 복구해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div
      className="gallery-content-scroll"
      style={{ ['--thumb-size' as string]: `${thumbSize}px` }}
    >
      {groupedData.map((group) => {
        const groupPhotoIds = group.photos.map((p) => p.id);
        const isAllSelected = groupPhotoIds.every((id) => selectedPhotoIds.has(id));

        return (
          <section key={group.key} className="gallery-group">
            <div className="gallery-group-header">
              <div className="gallery-group-title">
                {groupBy === 'folder' ? (
                  <Folder size={18} color="#fbbc05" />
                ) : groupBy === 'date' ? (
                  <Calendar size={18} color="#4285f4" />
                ) : groupBy === 'place' ? (
                  <MapPin size={18} color="#ea4335" />
                ) : (
                  <Globe2 size={18} color="#34a853" />
                )}
                <span>{group.title}</span>
                <span className="gallery-group-count">({group.photos.length}장)</span>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.76rem', color: isAllSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }}
                onClick={() => onSelectGroup(groupPhotoIds)}
              >
                <CheckSquare size={14} />
                <span>{isAllSelected ? '그룹 선택 해제' : '그룹 선택'}</span>
              </button>
            </div>

            <div className="gallery-grid">
              {group.photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={selectedPhotoIds.has(photo.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleStar={onToggleStar}
                  onOpenLightbox={onOpenLightbox}
                  onOpenEditor={onOpenEditor}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
