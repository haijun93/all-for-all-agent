import React, { useState, useEffect, useRef } from 'react';
import type { ViewMode } from '../../types/photo';
import type { AppMode } from './Header';
import { BackgroundIndexer } from '../../services/backgroundIndexer';

interface MenuItem {
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  divider?: false;
}
interface MenuDivider {
  divider: true;
}
type MenuEntry = MenuItem | MenuDivider;

interface MenuDef {
  label: string;
  entries: MenuEntry[];
}

interface MenuBarProps {
  appMode: AppMode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenFolderManager: () => void;
  onOpenImport: () => void;
  onStartSlideshow?: () => void;
  onResetDefaults: () => void;
  onCreateAlbum: (name: string) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  onToggleStarSelected: () => void;
  onClearSelection: () => void;
}

/**
 * Classic Windows-app menu bar (파일/편집/보기/만들기/도구/도움말), matching
 * Picasa 3's top menu row. Every entry is wired to a real action already
 * present in the app — nothing here is decorative; actions with no
 * backing feature are simply not offered rather than shown as dead links.
 */
export const MenuBar: React.FC<MenuBarProps> = ({
  appMode,
  viewMode,
  onViewModeChange,
  onOpenFolderManager,
  onOpenImport,
  onStartSlideshow,
  onResetDefaults,
  onCreateAlbum,
  selectedCount,
  onDeleteSelected,
  onToggleStarSelected,
  onClearSelection,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const hasSelection = selectedCount > 0;

  const menus: MenuDef[] = [
    {
      label: '파일(F)',
      entries: [
        {
          label: appMode === 'documents' ? '문서 폴더 스캔...' : '사진 폴더 스캔...',
          onSelect: onOpenFolderManager,
        },
        { label: appMode === 'documents' ? '문서 가져오기...' : '사진 가져오기...', onSelect: onOpenImport },
        { divider: true },
        { label: '샘플 라이브러리로 초기화...', onSelect: onResetDefaults },
      ],
    },
    {
      label: '편집(E)',
      entries: [
        {
          label: `선택 항목 삭제 (${selectedCount})`,
          onSelect: onDeleteSelected,
          disabled: !hasSelection,
        },
        {
          label: '선택 항목 즐겨찾기 토글',
          onSelect: onToggleStarSelected,
          disabled: !hasSelection,
        },
        { divider: true },
        { label: '선택 해제', onSelect: onClearSelection, disabled: !hasSelection },
      ],
    },
    {
      label: '보기(V)',
      entries:
        appMode === 'photos'
          ? [
              { label: '라이브러리', onSelect: () => onViewModeChange('gallery'), disabled: viewMode === 'gallery' },
              { label: '장소 & 지역', onSelect: () => onViewModeChange('places'), disabled: viewMode === 'places' },
              { label: '날짜 / 타임라인', onSelect: () => onViewModeChange('timeline'), disabled: viewMode === 'timeline' },
              { label: '인물 (People)', onSelect: () => onViewModeChange('people'), disabled: viewMode === 'people' },
            ]
          : [{ label: '(문서 모드에는 보기 전환이 없습니다)', disabled: true }],
    },
    {
      label: '만들기(C)',
      entries:
        appMode === 'photos'
          ? [
              {
                label: '새 앨범 만들기...',
                onSelect: () => {
                  const name = window.prompt('새 앨범 이름을 입력하세요');
                  if (name && name.trim()) onCreateAlbum(name.trim());
                },
              },
              { label: '콜라주 만들기', onSelect: () => onViewModeChange('collage'), disabled: viewMode === 'collage' },
            ]
          : [{ label: '(문서 모드에는 만들기 메뉴가 없습니다)', disabled: true }],
    },
    {
      label: '도구(T)',
      entries: [
        appMode === 'photos'
          ? { label: '슬라이드쇼 시작', onSelect: onStartSlideshow, disabled: !onStartSlideshow }
          : { label: '인덱싱 작업창 보기/숨기기', onSelect: () => BackgroundIndexer.toggleHUD() },
      ],
    },
    {
      label: '도움말(H)',
      entries: [
        {
          label: 'Picasa Web Studio 정보...',
          onSelect: () =>
            window.alert(
              'Picasa Web Studio\n로컬 사진·문서 인덱싱 및 관리 도구\n\nTauri + Rust 네이티브 백엔드로 동작합니다.'
            ),
        },
      ],
    },
  ];

  return (
    <div className="classic-menu-bar" ref={barRef}>
      {menus.map((menu) => (
        <div key={menu.label} className="classic-menu-item-wrapper">
          <button
            type="button"
            className={`classic-menu-label ${openMenu === menu.label ? 'open' : ''}`}
            onClick={() => setOpenMenu((prev) => (prev === menu.label ? null : menu.label))}
            onMouseEnter={() => {
              if (openMenu !== null) setOpenMenu(menu.label);
            }}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="classic-menu-dropdown">
              {menu.entries.map((entry, i) =>
                entry.divider ? (
                  <div key={i} className="classic-menu-divider" />
                ) : (
                  <button
                    key={entry.label}
                    type="button"
                    className="classic-menu-dropdown-item"
                    disabled={entry.disabled}
                    onClick={() => {
                      entry.onSelect?.();
                      setOpenMenu(null);
                    }}
                  >
                    {entry.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
