import React, { useState } from 'react';
import type { DocFormat } from '../../types/document';
import {
  FileText,
  Star,
  Folder,
  ChevronDown,
  ChevronRight,
  Calendar,
  Layers,
  FileCheck,
  Hash
} from 'lucide-react';

interface DocSidebarProps {
  activeCategory: string;
  selectedId: string | null;
  onSelectCategory: (category: string, id: string | null) => void;
  categories: string[];
  keywords: string[];
  dates: string[];
  formats: DocFormat[];
  folders: string[];
  totalDocsCount: number;
  starredCount: number;
}

export const DocSidebar: React.FC<DocSidebarProps> = ({
  activeCategory,
  selectedId,
  onSelectCategory,
  categories,
  keywords,
  dates,
  formats,
  folders,
  totalDocsCount,
  starredCount,
}) => {
  const [openSections, setOpenSections] = useState({
    categories: true,
    keywords: true,
    dates: true,
    formats: true,
    folders: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="app-sidebar">
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

      {/* Document Categories Section */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('categories')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.categories ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>📂 문서 주제별 분류</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{categories.length}</span>
        </div>

        {openSections.categories && (
          <ul className="sidebar-nav-list">
            {categories.map((cat) => {
              const isActive = activeCategory === 'category' && selectedId === cat;
              return (
                <li
                  key={cat}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('category', cat)}
                >
                  <div className="sidebar-item-left">
                    <FileCheck size={14} color="#34a853" />
                    <span>{cat}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Extracted Key Keywords Cloud */}
      <div>
        <div
          className="sidebar-section-title"
          style={{ cursor: 'pointer' }}
          onClick={() => toggleSection('keywords')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {openSections.keywords ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>🏷️ 핵심 키워드 (Keywords)</span>
          </div>
          <span style={{ fontSize: '0.7rem' }}>{keywords.length}</span>
        </div>

        {openSections.keywords && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 8px' }}>
            {keywords.map((kw) => {
              const isActive = activeCategory === 'keyword' && selectedId === kw;
              return (
                <button
                  key={kw}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 16 }}
                  onClick={() => onSelectCategory('keyword', kw)}
                >
                  <Hash size={11} />
                  <span>{kw}</span>
                </button>
              );
            })}
          </div>
        )}
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
          <span style={{ fontSize: '0.7rem' }}>{formats.length}</span>
        </div>

        {openSections.formats && (
          <ul className="sidebar-nav-list">
            {formats.map((fmt) => {
              const isActive = activeCategory === 'format' && selectedId === fmt;
              return (
                <li
                  key={fmt}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectCategory('format', fmt)}
                >
                  <div className="sidebar-item-left">
                    <Layers size={14} color="#fbbc05" />
                    <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{fmt} 문서</span>
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
                >
                  <div className="sidebar-item-left">
                    <Folder size={14} color="#fbbc05" />
                    <span title={f}>{f}</span>
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
