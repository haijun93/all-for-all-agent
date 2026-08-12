import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DOC_FORMAT_GROUPS, type DocFormatGroup } from '../../types/document';
import { isTauri, invoke } from '@tauri-apps/api/core';
import {
  FileText,
  Star,
  Folder,
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers
} from 'lucide-react';

interface DocSidebarProps {
  activeCategory: string;
  selectedId: string | null;
  onSelectCategory: (category: string, id: string | null) => void;
  dates: string[];
  formatGroupCounts: Record<DocFormatGroup, number>;
  folders: string[];
  totalDocsCount: number;
  starredCount: number;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 260;
const SIDEBAR_WIDTH_STORAGE_KEY = 'picasa_doc_sidebar_width';

export const DocSidebar: React.FC<DocSidebarProps> = ({
  activeCategory,
  selectedId,
  onSelectCategory,
  dates,
  formatGroupCounts,
  folders,
  totalDocsCount,
  starredCount,
}) => {
  const [openSections, setOpenSections] = useState({
    folders: true,
    formats: true,
    dates: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Resizable width, dragged via the handle on the right edge, persisted so
  // the chosen width survives across sessions.
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
      return saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH ? saved : DEFAULT_SIDEBAR_WIDTH;
    } catch {
      return DEFAULT_SIDEBAR_WIDTH;
    }
  });
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, e.clientX));
      setWidth(next);
    };
    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setWidth((current) => {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(current));
        } catch {
          // ignore
        }
        return current;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleOpenFolderInExplorer = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isTauri()) return;
    invoke('open_file_with_default_app', { path: folderPath }).catch((err) => {
      console.error('[DocSidebar] Failed to open folder in file explorer:', err);
    });
  };

  return (
    <aside className="app-sidebar" style={{ width, position: 'relative', flexShrink: 0 }}>
      <div
        onMouseDown={handleResizeStart}
        title="드래그하여 사이드바 폭 조절"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />
      {/* Primary Collections */}
      <div>
        <div className="sidebar-section-title">
          <span>문서 라이브러리</span>
        </div>
        <ul className="sidebar-nav-list">
          <li
            className={`sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => onSelectCategory('all', null)}
          >
            <div className="sidebar-item-left">
              <FileText size={16} color="#4285f4" />
              <span>모든 문서</span>
            </div>
            <span className="sidebar-badge">{totalDocsCount}</span>
          </li>
          <li
            className={`sidebar-item ${activeCategory === 'starred' ? 'active' : ''}`}
            onClick={() => onSelectCategory('starred', null)}
          >
            <div className="sidebar-item-left">
              <Star size={16} color="#fbbc05" />
              <span>중요 문서 (Starred)</span>
            </div>
            <span className="sidebar-badge">{starredCount}</span>
          </li>
        </ul>
      </div>

      {/* Dates Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('dates')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.dates ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>📅 작성일별 (Dates)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{dates.length}</span>
        </div>

        {openSections.dates && (
          <ul className="sidebar-nav-list">
            {dates.map((d) => {
              const isActive = activeCategory === 'date' && selectedId === d;
              return (
                <li
                  key={d}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('date', d)}
                >
                  <div className="sidebar-item-left">
                    <Calendar size={14} color="#4285f4" />
                    <span>{d}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Formats Section (PDF, Word, Excel, HWP) */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('formats')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.formats ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>📄 파일 포맷 (Formats)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{DOC_FORMAT_GROUPS.length}</span>
        </div>

        {openSections.formats && (
          <ul className="sidebar-nav-list">
            {DOC_FORMAT_GROUPS.map((group) => {
              const isActive = activeCategory === 'format' && selectedId === group.key;
              const count = formatGroupCounts[group.key] || 0;
              return (
                <li
                  key={group.key}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('format', group.key)}
                >
                  <div className="sidebar-item-left">
                    <Layers size={14} color="#fbbc05" />
                    <span style={{ fontWeight: 600 }}>{group.label}</span>
                  </div>
                  <span className="sidebar-badge">{count}</span>
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
            <span>📁 폴더 (Folders)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{folders.length}</span>
        </div>

        {openSections.folders && (
          <ul className="sidebar-nav-list">
            {folders.map((f) => {
              const isActive = activeCategory === 'folder' && selectedId === f;
              return (
                <li
                  key={f}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('folder', f)}
                  onDoubleClick={(e) => handleOpenFolderInExplorer(f, e)}
                  title={`${f}\n더블클릭: 파일 탐색기에서 열기`}
                >
                  <div className="sidebar-item-left">
                    <Folder size={14} color="#fbbc05" />
                    <span>{f}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
