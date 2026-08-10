import React, { useState } from 'react';
import type { Album, Person } from '../../types/photo';
import {
  Images,
  Star,
  Folder,
  FolderPlus,
  Tag,
  ChevronDown,
  ChevronRight,
  FolderArchive,
  MapPin,
  Globe2,
  Calendar
} from 'lucide-react';

interface SidebarProps {
  activeCategory: string;
  selectedId: string | null;
  onSelectCategory: (category: string, id: string | null) => void;
  albums: Album[];
  people: Person[];
  folders: string[];
  tags: string[];
  regions: string[];
  places: string[];
  dates: string[];
  totalPhotosCount: number;
  starredCount: number;
  onCreateAlbum: (name: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  selectedId,
  onSelectCategory,
  albums,
  people,
  folders,
  tags,
  regions,
  places,
  dates,
  totalPhotosCount,
  starredCount,
  onCreateAlbum,
}) => {
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [openSections, setOpenSections] = useState({
    albums: true,
    folders: true,
    regions: true,
    places: false,
    dates: false,
    people: true,
    tags: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreateAlbumSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAlbumName.trim()) {
      onCreateAlbum(newAlbumName.trim());
      setNewAlbumName('');
      setIsCreatingAlbum(false);
    }
  };

  return (
    <aside className="app-sidebar">
      {/* Primary Collections */}
      <div>
        <div className="sidebar-section-title">
          <span>라이브러리</span>
        </div>
        <ul className="sidebar-nav-list">
          <li
            className={`sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => onSelectCategory('all', null)}
          >
            <div className="sidebar-item-left">
              <Images size={16} />
              <span>모든 사진</span>
            </div>
            <span className="sidebar-badge">{totalPhotosCount}</span>
          </li>
          <li
            className={`sidebar-item ${activeCategory === 'starred' ? 'active' : ''}`}
            onClick={() => onSelectCategory('starred', null)}
          >
            <div className="sidebar-item-left">
              <Star size={16} color="#fbbc05" />
              <span>즐겨찾기 (Starred)</span>
            </div>
            <span className="sidebar-badge">{starredCount}</span>
          </li>
        </ul>
      </div>

      {/* Regions Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('regions')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.regions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>🗺️ 지역/도시 (Regions)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{regions.length}</span>
        </div>

        {openSections.regions && (
          <ul className="sidebar-nav-list">
            {regions.map((region) => {
              const isActive = activeCategory === 'region' && selectedId === region;
              return (
                <li
                  key={region}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('region', region)}
                >
                  <div className="sidebar-item-left">
                    <Globe2 size={15} color="#34a853" />
                    <span title={region}>{region}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Specific Places Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('places')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.places ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>📍 촬영 장소 (Places)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{places.length}</span>
        </div>

        {openSections.places && (
          <ul className="sidebar-nav-list">
            {places.map((place) => {
              const isActive = activeCategory === 'place' && selectedId === place;
              return (
                <li
                  key={place}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('place', place)}
                >
                  <div className="sidebar-item-left">
                    <MapPin size={15} color="#ea4335" />
                    <span title={place}>{place}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dates by Year/Month */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('dates')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.dates ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>📅 날짜별 (Dates)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{dates.length}</span>
        </div>

        {openSections.dates && (
          <ul className="sidebar-nav-list">
            {dates.map((dateStr) => {
              const isActive = activeCategory === 'date' && selectedId === dateStr;
              return (
                <li
                  key={dateStr}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('date', dateStr)}
                >
                  <div className="sidebar-item-left">
                    <Calendar size={15} color="#4285f4" />
                    <span>{dateStr}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Albums Section */}
      <div>
        <div className="sidebar-section-title">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
            onClick={() => toggleSection('albums')}
          >
            {openSections.albums ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>앨범 (Albums)</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '2px 4px' }}
            title="새 앨범 만들기"
            onClick={() => setIsCreatingAlbum(!isCreatingAlbum)}
          >
            <FolderPlus size={14} />
          </button>
        </div>

        {isCreatingAlbum && (
          <form onSubmit={handleCreateAlbumSubmit} style={{ padding: '6px 8px', marginBottom: 6 }}>
            <input
              type="text"
              className="search-input"
              style={{
                background: '#1e2634',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--accent-blue)',
                width: '100%',
                fontSize: '0.8rem',
              }}
              placeholder="앨범 이름 입력..."
              value={newAlbumName}
              autoFocus
              onChange={(e) => setNewAlbumName(e.target.value)}
              onBlur={() => !newAlbumName && setIsCreatingAlbum(false)}
            />
          </form>
        )}

        {openSections.albums && (
          <ul className="sidebar-nav-list">
            {albums.map((album) => {
              const isActive = activeCategory === 'album' && selectedId === album.id;
              return (
                <li
                  key={album.id}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('album', album.id)}
                >
                  <div className="sidebar-item-left">
                    <FolderArchive size={15} color="#4285f4" />
                    <span>{album.title}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Folders Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('folders')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.folders ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>폴더 (Folders)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{folders.length}</span>
        </div>

        {openSections.folders && (
          <ul className="sidebar-nav-list">
            {folders.map((folder) => {
              const isActive = activeCategory === 'folder' && selectedId === folder;
              return (
                <li
                  key={folder}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('folder', folder)}
                >
                  <div className="sidebar-item-left">
                    <Folder size={15} color="#fbbc05" />
                    <span title={folder}>{folder}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* People / Faces Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('people')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.people ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>인물 (People)</span>
          </div>
        </div>

        {openSections.people && (
          <ul className="sidebar-nav-list">
            {people.map((person) => {
              const isActive = activeCategory === 'person' && selectedId === person.id;
              return (
                <li
                  key={person.id}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('person', person.id)}
                >
                  <div className="sidebar-item-left">
                    <img
                      src={person.avatarUrl}
                      alt={person.name}
                      className="person-avatar-mini"
                    />
                    <span>{person.name}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Popular Tags */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('tags')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.tags ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>태그 (Tags)</span>
          </div>
        </div>

        {openSections.tags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 8px' }}>
            {tags.slice(0, 12).map((tag) => {
              const isActive = activeCategory === 'tag' && selectedId === tag;
              return (
                <button
                  key={tag}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 20 }}
                  onClick={() => onSelectCategory('tag', tag)}
                >
                  <Tag size={10} />
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
