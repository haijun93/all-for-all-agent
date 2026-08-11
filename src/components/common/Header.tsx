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
  FolderSearch,
  Compass,
  FileText,
  Camera,
  Activity
} from 'lucide-react';
import { BackgroundIndexer } from '../../services/backgroundIndexer';

export type AppMode = 'photos' | 'documents';

interface HeaderProps {
  appMode: AppMode;
  onAppModeChange: (mode: AppMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenFolderManager: () => void;
  onOpenImport: () => void;
  onStartSlideshow?: () => void;
  onResetDefaults: () => void;
  totalItemsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  onAppModeChange,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onOpenFolderManager,
  onOpenImport,
  onStartSlideshow,
  onResetDefaults,
  totalItemsCount,
}) => {
  return (
    <header className="app-header">
      {/* Brand & Mode Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="logo-section" onClick={() => onViewModeChange('gallery')}>
          <div className="picasa-logo-badge">
            <Sparkles size={16} color="#ffffff" style={{ position: 'relative', zIndex: 2 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="app-title">
              Picasa <span style={{ color: appMode === 'documents' ? '#34a853' : '#4285f4' }}>{appMode === 'documents' ? 'Docs' : 'Web'}</span>
              <span className="app-version">v3.0 PRO</span>
            </div>
          </div>
        </div>

        {/* Studio Mode Switcher: Photos vs Documents */}
        <div style={{ display: 'flex', background: '#11151f', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            className={`btn btn-sm ${appMode === 'photos' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            onClick={() => onAppModeChange('photos')}
          >
            <Camera size={13} />
            <span>사진 모드</span>
          </button>
          <button
            className={`btn btn-sm ${appMode === 'documents' ? 'btn-primary' : 'btn-ghost'}`}
            style={{
              fontSize: '0.78rem',
              padding: '4px 10px',
              background: appMode === 'documents' ? 'linear-gradient(135deg, #107c41, #34a853)' : 'transparent',
            }}
            onClick={() => onAppModeChange('documents')}
          >
            <FileText size={13} />
            <span>📄 문서 모드 (Picasa Docs)</span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs (Only when in Photos mode) */}
      {appMode === 'photos' && (
        <div style={{ display: 'flex', background: '#19202c', padding: 4, borderRadius: 10, gap: 4 }}>
          <button
            className={`btn btn-sm ${viewMode === 'gallery' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onViewModeChange('gallery')}
          >
            <Grid size={14} />
            <span>라이브러리</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'places' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onViewModeChange('places')}
          >
            <Compass size={14} />
            <span>장소 & 지역</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onViewModeChange('timeline')}
          >
            <Calendar size={14} />
            <span>날짜/타임라인</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'people' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onViewModeChange('people')}
          >
            <Users size={14} />
            <span>인물 (People)</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'collage' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onViewModeChange('collage')}
          >
            <Layers size={14} />
            <span>콜라주 메이커</span>
          </button>
        </div>
      )}

      {/* Global Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className="search-input"
            placeholder={
              appMode === 'documents'
                ? "문서 제목, 본문 내용, 키워드(#사업계획서, #계약서), 포맷 검색..."
                : "사진 제목, 태그, 인물, 폴더, 장소 검색..."
            }
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

        {appMode === 'photos' && onStartSlideshow && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onStartSlideshow}
            disabled={totalItemsCount === 0}
            title="전체화면 슬라이드쇼 재생"
          >
            <Play size={14} />
            <span>슬라이드쇼</span>
          </button>
        )}

        {appMode === 'documents' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => BackgroundIndexer.toggleHUD()}
            title="인덱싱 작업창 숨기기 / 되살리기 (HUD 토글)"
            style={{
              border: '1px solid rgba(168, 85, 247, 0.4)',
              background: 'rgba(168, 85, 247, 0.12)',
              color: '#c084fc',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Activity size={14} color="#c084fc" />
            <span>작업창 되살리기/숨기기</span>
          </button>
        )}

        <button
          className="btn btn-secondary btn-sm"
          onClick={onOpenFolderManager}
          title={appMode === 'documents' ? '컴퓨터의 실제 문서 폴더 스캔' : '컴퓨터의 실제 사진 폴더 스캔'}
          style={{ border: '1px solid rgba(66, 133, 244, 0.4)', background: 'rgba(66, 133, 244, 0.12)', color: '#60a5fa' }}
        >
          <FolderSearch size={15} color="#60a5fa" />
          <span>{appMode === 'documents' ? '문서 폴더 스캔' : '사진 폴더 스캔'}</span>
        </button>

        <button className="btn btn-primary btn-sm" onClick={onOpenImport}>
          <Plus size={15} />
          <span>{appMode === 'documents' ? '문서 가져오기' : '사진 가져오기'}</span>
        </button>
      </div>
    </header>
  );
};
