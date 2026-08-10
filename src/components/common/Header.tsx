import React from 'react';
import type { ViewMode } from '../../types/photo';
import { modifierKey } from '../../utils/platform';
import {
  Search,
  Plus,
  Play,
  Grid,
  Layers,
  Users,
  Calendar,
  RotateCcw,
  Sparkles,
  FolderSearch
} from 'lucide-react';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenFolderManager: () => void;
  onOpenImport: () => void;
  onStartSlideshow: () => void;
  onResetDefaults: () => void;
  totalPhotosCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onOpenFolderManager,
  onOpenImport,
  onStartSlideshow,
  onResetDefaults,
  totalPhotosCount,
}) => {
  return (
    <header className="app-header">
      {/* Brand & Logo */}
      <div className="logo-section" onClick={() => onViewModeChange('gallery')}>
        <div className="picasa-logo-badge">
          <Sparkles size={16} color="#ffffff" style={{ position: 'relative', zIndex: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="app-title">
            Picasa <span style={{ color: '#4285f4' }}>Web</span>
            <span className="app-version">v2.5 Cross-Platform</span>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div style={{ display: 'flex', background: '#19202c', padding: 4, borderRadius: 10, gap: 4 }}>
        <button
          className={`btn btn-sm ${viewMode === 'gallery' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onViewModeChange('gallery')}
        >
          <Grid size={14} />
          <span>라이브러리</span>
        </button>
        <button
          className={`btn btn-sm ${viewMode === 'collage' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onViewModeChange('collage')}
        >
          <Layers size={14} />
          <span>콜라주 메이커</span>
        </button>
        <button
          className={`btn btn-sm ${viewMode === 'people' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onViewModeChange('people')}
        >
          <Users size={14} />
          <span>인물 (People)</span>
        </button>
        <button
          className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onViewModeChange('timeline')}
        >
          <Calendar size={14} />
          <span>타임라인</span>
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className="search-input"
            placeholder="사진 제목, 태그, 인물, 폴더 검색..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '0 4px', fontSize: '0.7rem' }}
              onClick={() => onSearchChange('')}
            >
              ✕
            </button>
          ) : (
            <span className="search-shortcut-badge">{modifierKey}K</span>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        <button
          className="btn btn-secondary btn-sm"
          title="기본 샘플 데이터로 복구"
          onClick={onResetDefaults}
        >
          <RotateCcw size={14} />
          <span style={{ fontSize: '0.78rem' }}>샘플 복구</span>
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={onStartSlideshow}
          disabled={totalPhotosCount === 0}
          title="전체화면 슬라이드쇼 재생"
        >
          <Play size={14} />
          <span>슬라이드쇼</span>
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenFolderManager}
          title="내 컴퓨터(Windows / Mac)의 실제 사진 폴더 스캔 및 인덱싱"
          style={{ border: '1px solid rgba(66, 133, 244, 0.4)', background: 'rgba(66, 133, 244, 0.12)', color: '#60a5fa' }}
        >
          <FolderSearch size={15} color="#60a5fa" />
          <span>폴더 관리자 (로컬 스캔)</span>
        </button>

        <button className="btn btn-primary btn-sm" onClick={onOpenImport}>
          <Plus size={15} />
          <span>사진 가져오기</span>
        </button>
      </div>
    </header>
  );
};
