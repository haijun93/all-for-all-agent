import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { DocumentItem, DocGroupBy } from '../../types/document';
import { DocCard } from './DocCard';
import { FileText, Calendar, CheckSquare, Layers, Folder } from 'lucide-react';

interface DocGalleryViewProps {
  docs: DocumentItem[];
  selectedDocIds: Set<string>;
  thumbSize: number;
  groupBy: DocGroupBy;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onToggleStar: (id: string, e: React.MouseEvent) => void;
  onOpenViewer: (doc: DocumentItem) => void;
  onSelectGroup: (docIds: string[]) => void;
}

/**
 * Maximum number of documents to render at once.
 * Documents beyond this limit are loaded incrementally as the user scrolls near the bottom.
 * This prevents React from mounting 800+ DocCard components simultaneously,
 * which causes OOM in DEV mode (Performance.measure DataCloneError) and GC stalls in production.
 */
const INITIAL_RENDER_LIMIT = 60;
const LOAD_MORE_INCREMENT = 40;
const SCROLL_THRESHOLD_PX = 600;

export const DocGalleryView: React.FC<DocGalleryViewProps> = ({
  docs,
  selectedDocIds,
  thumbSize,
  groupBy,
  onToggleSelect,
  onToggleStar,
  onOpenViewer,
  onSelectGroup,
}) => {
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset render limit when docs array identity or groupBy changes
  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT);
  }, [docs, groupBy]);

  // Infinite scroll: load more when user scrolls near bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX) {
      setRenderLimit((prev) => {
        if (prev >= docs.length) return prev;
        return Math.min(prev + LOAD_MORE_INCREMENT, docs.length);
      });
    }
  }, [docs.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Only slice docs up to renderLimit for DOM rendering
  const visibleDocs = useMemo(() => docs.slice(0, renderLimit), [docs, renderLimit]);

  const groupedData = useMemo(() => {
    const groups: { [key: string]: DocumentItem[] } = {};

    visibleDocs.forEach((doc) => {
      let key = '기타 폴더';
      if (groupBy === 'folder') {
        key = doc.folder || '기본 폴더';
      } else if (groupBy === 'format') {
        key = `${doc.format.toUpperCase()} 문서 파일`;
      } else if (groupBy === 'date') {
        if (doc.dateCreated) {
          const parts = doc.dateCreated.split('-');
          key = parts.length >= 2 ? `${parts[0]}년 ${parseInt(parts[1], 10)}월` : doc.dateCreated;
        }
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });

    return Object.entries(groups).map(([title, items]) => ({
      title,
      docs: items,
      key: title,
    }));
  }, [visibleDocs, groupBy]);

  if (docs.length === 0) {
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
          padding: 40,
        }}
      >
        <FileText size={48} color="#4285f4" />
        <h3 style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          등록된 문서가 없습니다
        </h3>
        <p style={{ fontSize: '0.9rem' }}>
          상단의 <b>[문서 폴더 스캔]</b> 또는 <b>[문서 가져오기]</b> 버튼을 눌러 컴퓨터에 있는 PDF, Excel, Word, HWP 문서를 추가해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="gallery-content-scroll"
      style={{ ['--thumb-size' as string]: `${thumbSize}px` }}
    >
      {groupedData.map((group) => {
        const groupDocIds = group.docs.map((d) => d.id);
        const isAllSelected = groupDocIds.every((id) => selectedDocIds.has(id));

        return (
          <section
            key={group.key}
            className="gallery-group"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 350px' }}
          >
            <div className="gallery-group-header">
              <div className="gallery-group-title">
                {groupBy === 'folder' ? (
                  <Folder size={18} color="#fbbc05" />
                ) : groupBy === 'format' ? (
                  <Layers size={18} color="#ea4335" />
                ) : (
                  <Calendar size={18} color="#4285f4" />
                )}
                <span>{group.title}</span>
                <span className="gallery-group-count">({group.docs.length}개)</span>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.76rem', color: isAllSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }}
                onClick={() => onSelectGroup(groupDocIds)}
              >
                <CheckSquare size={14} />
                <span>{isAllSelected ? '그룹 선택 해제' : '그룹 선택'}</span>
              </button>
            </div>

            <div
              className="photos-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`,
                gap: 14,
              }}
            >
              {group.docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  isSelected={selectedDocIds.has(doc.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleStar={onToggleStar}
                  onOpenViewer={onOpenViewer}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Load more indicator */}
      {renderLimit < docs.length && (
        <div
          style={{
            padding: '24px 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          📄 {renderLimit.toLocaleString()} / {docs.length.toLocaleString()} 문서 표시 중 — 스크롤하여 더 불러오기
        </div>
      )}
    </div>
  );
};
