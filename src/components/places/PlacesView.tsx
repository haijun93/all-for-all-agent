import React, { useState, useMemo } from 'react';
import type { Photo } from '../../types/photo';
import {
  MapPin,
  Globe2,
  Navigation,
  Compass,
  ExternalLink,
  Layers
} from 'lucide-react';
import { PhotoCard } from '../gallery/PhotoCard';

interface PlacesViewProps {
  photos: Photo[];
  onOpenLightbox: (photo: Photo) => void;
  onOpenEditor: (photo: Photo) => void;
}

export const PlacesView: React.FC<PlacesViewProps> = ({
  photos,
  onOpenLightbox,
  onOpenEditor,
}) => {
  const [activeTab, setActiveTab] = useState<'region' | 'place'>('region');

  // Group by Region (Province / City / Country)
  const regionGroups = useMemo(() => {
    const groups: { [key: string]: { photos: Photo[]; city?: string; country?: string; province?: string } } = {};

    photos.forEach((photo) => {
      const loc = photo.exif?.location;
      const regionKey = loc
        ? `${loc.country ? loc.country + ' • ' : ''}${loc.province || loc.city || '기타 지역'}`
        : '위치 정보 없음';

      if (!groups[regionKey]) {
        groups[regionKey] = {
          photos: [],
          city: loc?.city,
          country: loc?.country,
          province: loc?.province,
        };
      }
      groups[regionKey].photos.push(photo);
    });

    return Object.entries(groups).sort((a, b) => b[1].photos.length - a[1].photos.length);
  }, [photos]);

  // Group by Specific Place / Spot
  const placeGroups = useMemo(() => {
    const groups: { [key: string]: { photos: Photo[]; lat?: number; lng?: number; city?: string } } = {};

    photos.forEach((photo) => {
      const loc = photo.exif?.location;
      const spotName = loc?.name || '위치 미지정 스팟';

      if (!groups[spotName]) {
        groups[spotName] = {
          photos: [],
          lat: loc?.latitude || loc?.lat,
          lng: loc?.longitude || loc?.lng,
          city: loc?.city,
        };
      }
      groups[spotName].photos.push(photo);
    });

    return Object.entries(groups).sort((a, b) => b[1].photos.length - a[1].photos.length);
  }, [photos]);

  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const currentGroups = activeTab === 'region' ? regionGroups : placeGroups;
  const activeSelectedKey = selectedGroupKey || currentGroups[0]?.[0] || '';
  const activeGroup = currentGroups.find(([k]) => k === activeSelectedKey);

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* Left Places/Regions Navigation Sidebar */}
      <div
        style={{
          width: 320,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Compass size={20} color="#4285f4" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            장소 & 지역 분류 (Places)
          </h3>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: '#19202c', padding: 3, borderRadius: 8, gap: 3 }}>
          <button
            className={`btn btn-sm ${activeTab === 'region' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: '0.78rem' }}
            onClick={() => {
              setActiveTab('region');
              setSelectedGroupKey(null);
            }}
          >
            <Globe2 size={13} />
            <span>지역/도시별 ({regionGroups.length})</span>
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'place' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: '0.78rem' }}
            onClick={() => {
              setActiveTab('place');
              setSelectedGroupKey(null);
            }}
          >
            <MapPin size={13} />
            <span>촬영 스팟별 ({placeGroups.length})</span>
          </button>
        </div>

        {/* Group Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
          {currentGroups.map(([key, data]) => {
            const isSelected = activeSelectedKey === key;
            const coverPhoto = data.photos[0];

            return (
              <div
                key={key}
                onClick={() => setSelectedGroupKey(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-blue-subtle)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {coverPhoto ? (
                  <img
                    src={coverPhoto.thumbnailUrl || coverPhoto.url}
                    alt={key}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      objectFit: 'cover',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapPin size={18} color="#6b7280" />
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '0.86rem',
                      color: '#ffffff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {key}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Layers size={11} />
                    <span>{data.photos.length}장의 사진</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Places Gallery Stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, overflowY: 'auto' }}>
        {activeGroup ? (
          <div>
            {/* Header / Info Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(66, 133, 244, 0.12) 0%, rgba(30, 41, 59, 0.5) 100%)',
                border: '1px solid rgba(66, 133, 244, 0.3)',
                borderRadius: 14,
                padding: 20,
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: 'rgba(66, 133, 244, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(66, 133, 244, 0.4)',
                  }}
                >
                  {activeTab === 'region' ? <Globe2 size={28} color="#4285f4" /> : <MapPin size={28} color="#ea4335" />}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800 }}>
                    {activeGroup[0]}
                  </h2>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    총 {activeGroup[1].photos.length}장의 사진이 이 위치에서 촬영되었습니다.
                  </span>
                </div>
              </div>

              {/* Map Link */}
              {activeGroup[1].photos[0]?.exif?.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${activeGroup[1].photos[0].exif.location.latitude || activeGroup[1].photos[0].exif.location.lat || 37.5665},${activeGroup[1].photos[0].exif.location.longitude || activeGroup[1].photos[0].exif.location.lng || 126.9780}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ gap: 6, color: '#60a5fa' }}
                >
                  <Navigation size={13} />
                  <span>Google 지도에서 보기</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>

            {/* Photos Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              {activeGroup[1].photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  isSelected={false}
                  onToggleSelect={() => {}}
                  onToggleStar={() => {}}
                  onOpenLightbox={onOpenLightbox}
                  onOpenEditor={onOpenEditor}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
            <Compass size={48} color="#4285f4" style={{ marginBottom: 12 }} />
            <h3>장소 또는 지역을 선택해 주세요</h3>
          </div>
        )}
      </div>
    </div>
  );
};
