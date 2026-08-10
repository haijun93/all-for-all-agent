import React, { useState } from 'react';
import type { Person, Photo } from '../../types/photo';
import { Users, UserPlus, Image as ImageIcon } from 'lucide-react';
import { PhotoCard } from '../gallery/PhotoCard';

interface PeopleManagerProps {
  people: Person[];
  photos: Photo[];
  onSelectPerson: (personId: string) => void;
  onCreatePerson: (name: string) => void;
  onOpenLightbox: (photo: Photo) => void;
  onOpenEditor: (photo: Photo) => void;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({
  people,
  photos,
  onSelectPerson,
  onCreatePerson,
  onOpenLightbox,
  onOpenEditor,
}) => {
  const [activePersonId, setActivePersonId] = useState<string | null>(people[0]?.id || null);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  // Find photos containing this person
  const personPhotos = photos.filter((p) =>
    p.faces?.some((f) => f.personId === activePersonId)
  );

  const activePerson = people.find((p) => p.id === activePersonId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPersonName.trim()) {
      onCreatePerson(newPersonName.trim());
      setNewPersonName('');
      setIsAddingPerson(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* People Sidebar */}
      <div
        style={{
          width: 300,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#4285f4" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              인물 (People)
            </h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAddingPerson(!isAddingPerson)}
          >
            <UserPlus size={14} />
          </button>
        </div>

        {isAddingPerson && (
          <form onSubmit={handleCreate}>
            <input
              type="text"
              className="search-input"
              style={{
                background: 'var(--bg-input)',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--accent-blue)',
                width: '100%',
              }}
              placeholder="새 인물 이름 입력..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              autoFocus
            />
          </form>
        )}

        {/* People Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {people.map((person) => {
            const count = photos.filter((p) =>
              p.faces?.some((f) => f.personId === person.id)
            ).length;
            const isActive = activePersonId === person.id;

            return (
              <div
                key={person.id}
                onClick={() => {
                  setActivePersonId(person.id);
                  onSelectPerson(person.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: isActive ? 'var(--accent-blue-subtle)' : 'rgba(255, 255, 255, 0.03)',
                  border: isActive ? '1px solid var(--accent-blue)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <img
                  src={person.avatarUrl}
                  alt={person.name}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#fff' }}>
                    {person.name}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    사진 {count}장
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Person Photo Gallery */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, overflowY: 'auto' }}>
        {activePerson ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <img
                src={activePerson.avatarUrl}
                alt={activePerson.name}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-blue)' }}
              />
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800 }}>
                  {activePerson.name}
                </h2>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  얼굴 인식으로 분류된 사진 총 {personPhotos.length}장
                </span>
              </div>
            </div>

            {personPhotos.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 14,
                }}
              >
                {personPhotos.map((photo) => (
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
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <ImageIcon size={40} style={{ marginBottom: 10 }} />
                <p>이 인물로 태그된 사진이 없습니다.</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
            <Users size={48} color="#4285f4" style={{ marginBottom: 12 }} />
            <h3>인물을 선택해 주세요</h3>
          </div>
        )}
      </div>
    </div>
  );
};
