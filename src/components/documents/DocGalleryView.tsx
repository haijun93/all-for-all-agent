import React, { useMemo } from 'react';
import type { DocumentItem, DocGroupBy } from '../../types/document';
import { DocCard } from './DocCard';
import { FileText, Calendar, CheckSquare, Layers, Folder, Hash } from 'lucide-react';

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
  const groupedData = useMemo(() => {
    const groups: { [key: string]: DocumentItem[] } = {};

    docs.forEach((doc) => {
      let key = '기타 문서';
      if (groupBy === 'category') {
        key = doc.category || '일반 문서';
      } else if (groupBy === 'date') {
        if (doc.dateCreated) {
          const parts = doc.dateCreated.split('-');
          key = parts.length >= 2 ? `${parts[0]}년 ${parseInt(parts[1], 10)}월` : doc.dateCreated;
        }
      } else if (groupBy === 'format') {
        key = `${doc.format.toUpperCase()} 문서 파일`;
      } else if (groupBy === 'folder') {
        key = doc.folder || '기본 폴더';
      } else if (groupBy === 'keyword') {
        key = doc.keywords[0] ? `#${doc.keywords[0]} 관련 문서` : '기타 키워드';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });

    return Object.entries(groups).map(([title, items]) => ({
      title,
      docs: items,
      key: title,
    }));
  }, [docs, groupBy]);

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
                {groupBy === 'category' ? (
                  <FileText size={18} color="#34a853" />
                ) : groupBy === 'date' ? (
                  <Calendar size={18} color="#4285f4" />
                ) : groupBy === 'format' ? (
                  <Layers size={18} color="#ea4335" />
                ) : groupBy === 'folder' ? (
                  <Folder size={18} color="#fbbc05" />
                ) : (
                  <Hash size={18} color="#a855f7" />
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
    </div>
  );
};
