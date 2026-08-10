import React, { useState, useEffect } from 'react';
import type { Person, Photo } from '../../types/photo';
import { AIFaceEngine } from '../../services/aiFaceEngine';
import { StorageService } from '../../services/storage';
import {
  Users,
  UserPlus,
  Image as ImageIcon,
  RefreshCw,
  Edit2,
  Check,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { PhotoCard } from '../gallery/PhotoCard';

interface PeopleManagerProps {
  people: Person[];
  photos: Photo[];
  onSelectPerson: (personId: string) => void;
  onCreatePerson: (name: string) => void;
  onOpenLightbox: (photo: Photo) => void;
  onOpenEditor: (photo: Photo) => void;
  onLibraryReload: () => void;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({
  people,
  photos,
  onSelectPerson,
  onCreatePerson,
  onOpenLightbox,
  onOpenEditor,
  onLibraryReload,
}) => {
  const [activePersonId, setActivePersonId] = useState<string | null>(people[0]?.id || null);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // AI Scan state
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; status: string } | null>(null);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Auto select active person if none selected or if list changed
  useEffect(() => {
    if (!activePersonId && people.length > 0) {
      setActivePersonId(people[0].id);
    } else if (activePersonId && !people.some((p) => p.id === activePersonId) && people.length > 0) {
      setActivePersonId(people[0].id);
    }
  }, [people, activePersonId]);

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

  const handleRenamePerson = async (personId: string) => {
    if (!editNameValue.trim()) return;
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    person.name = editNameValue.trim();
    const allPhotos = await StorageService.getAllPhotos();
    for (const photo of allPhotos) {
      let modified = false;
      photo.faces?.forEach((f) => {
        if (f.personId === personId) {
          f.personName = editNameValue.trim();
          modified = true;
        }
      });
      if (modified) {
        await StorageService.savePhoto(photo);
      }
    }

    setEditingPersonId(null);
    onLibraryReload();
  };

  const handleStartAiFaceScan = async () => {
    setIsAiScanning(true);
    setScanResult(null);
    try {
      const res = await AIFaceEngine.autoScanAndClusterLibrary((curr, tot, status) => {
        setScanProgress({ current: curr, total: tot, status });
      });

      setScanResult(`AI 분석 완료! ${res.clusteredCount}개의 얼굴을 감지하여 인물별로 분류했습니다.`);
      await onLibraryReload();
    } catch (err) {
      console.error('AI scan error:', err);
    } finally {
      setIsAiScanning(false);
      setScanProgress(null);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* People Sidebar */}
      <div
        style={{
          width: 320,
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
              인물 (People) <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({people.length})</span>
            </h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAddingPerson(!isAddingPerson)}
            title="새 인물 추가"
          >
            <UserPlus size={14} />
          </button>
        </div>

        {/* AI Auto Face Scan Button */}
        <button
          className="btn btn-lucky"
          style={{ width: '100%', padding: '10px 14px', fontSize: '0.82rem', gap: 8 }}
          onClick={handleStartAiFaceScan}
          disabled={isAiScanning}
        >
          {isAiScanning ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Zap size={15} color="#ffffff" />
          )}
          <span>{isAiScanning ? '얼굴 인식 AI 분석 중...' : '⚡️ 라이브러리 전체 얼굴 AI 자동 분류'}</span>
        </button>

        {isAiScanning && scanProgress && (
          <div
            style={{
              background: '#161d28',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 10,
              fontSize: '0.74rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4285f4', fontWeight: 600 }}>
              <span>진행률</span>
              <span>{scanProgress.current} / {scanProgress.total}</span>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>{scanProgress.status}</span>
          </div>
        )}

        {scanResult && (
          <div
            style={{
              background: 'rgba(52, 168, 83, 0.15)',
              border: '1px solid rgba(52, 168, 83, 0.3)',
              borderRadius: 8,
              padding: 8,
              color: '#34a853',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} />
            <span>{scanResult}</span>
          </div>
        )}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
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
                  padding: '8px 12px',
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
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {editingPersonId === person.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenamePerson(person.id)}
                        autoFocus
                        style={{
                          background: '#1e2634',
                          border: '1px solid var(--accent-blue)',
                          color: '#fff',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '0.8rem',
                          width: '100%',
                        }}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 2, color: '#34a853' }}
                        onClick={() => handleRenamePerson(person.id)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.name}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '2px 4px', color: 'var(--text-muted)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPersonId(person.id);
                          setEditNameValue(person.name);
                        }}
                        title="이름 수정"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    사진 {count}장
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Person Photo Gallery Stage */}
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
                style={{ width: 68, height: 68, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-blue)' }}
              />
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800 }}>
                  {activePerson.name}
                </h2>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  얼굴 인식으로 자동 분류된 사진 총 {personPhotos.length}장
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
                <p>이 인물로 태그된 사진이 없습니다. 상단의 <b>[⚡️ 라이브러리 전체 얼굴 AI 자동 분류]</b>를 실행해 보세요.</p>
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
