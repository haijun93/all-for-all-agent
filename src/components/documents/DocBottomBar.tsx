import React from 'react';
import type { DocGroupBy } from '../../types/document';
import {
  Star,
  Trash2,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
  FolderTree,
  Calendar,
  Layers
} from 'lucide-react';

interface DocBottomBarProps {
  selectedCount: number;
  totalCount: number;
  thumbSize: number;
  onThumbSizeChange: (size: number) => void;
  groupBy: DocGroupBy;
  onGroupByChange: (groupBy: DocGroupBy) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchStar: () => void;
  onBatchDelete: () => void;
}

export const DocBottomBar: React.FC<DocBottomBarProps> = ({
  selectedCount,
  totalCount,
  thumbSize,
  onThumbSizeChange,
  groupBy,
  onGroupByChange,
  onSelectAll,
  onDeselectAll,
  onBatchStar,
  onBatchDelete,
}) => {
  return (
    <footer className="app-bottombar">
      {/* Left: Selection Status & Batch Actions */}
      <div className="bottombar-selection-info">
        {selectedCount > 0 ? (
          <>
            <span className="bottombar-selection-pill" style={{ background: 'rgba(52, 168, 83, 0.25)', color: '#4ade80' }}>
              {selectedCount}개 문서 선택됨
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onDeselectAll} title="선택 해제">
              <Square size={13} />
              <span>선택 해제</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onBatchStar} title="중요 문서 토글">
              <Star size={13} color="#fbbc05" />
              <span>중요 표시</span>
            </button>
            <button className="btn btn-danger btn-sm" onClick={onBatchDelete} title="선택한 문서 삭제">
              <Trash2 size={13} />
              <span>삭제</span>
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={onSelectAll} title="모든 문서 선택">
              <CheckSquare size={14} />
              <span>전체 선택</span>
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              총 {totalCount}개의 문서
            </span>
          </>
        )}
      </div>

      {/* Center: Document Grouping Switcher */}
      <div className="bottombar-view-controls">
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>정렬:</span>
        <div style={{ display: 'flex', background: '#131822', padding: 2, borderRadius: 6, gap: 2 }}>
          <button
            className={`btn btn-sm ${groupBy === 'folder' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('folder')}
            title="폴더별 그룹화"
          >
            <FolderTree size={12} />
            <span>폴더별</span>
          </button>
          <button
            className={`btn btn-sm ${groupBy === 'format' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('format')}
            title="파일 포맷별 (PDF/HWP/Excel/Word)"
          >
            <Layers size={12} />
            <span>포맷별</span>
          </button>
          <button
            className={`btn btn-sm ${groupBy === 'date' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('date')}
            title="작성일자별 그룹화"
          >
            <Calendar size={12} />
            <span>작성일별</span>
          </button>
        </div>
      </div>

      {/* Right: Signature Picasa Document Zoom Slider */}
      <div className="zoom-slider-container">
        <button
          className="btn btn-ghost btn-icon-only"
          style={{ padding: 2 }}
          onClick={() => onThumbSizeChange(Math.max(160, thumbSize - 30))}
          title="문서 썸네일 축소"
        >
          <ZoomOut size={14} color="var(--text-muted)" />
        </button>

        <input
          type="range"
          min="160"
          max="460"
          step="10"
          className="zoom-slider"
          value={thumbSize}
          onChange={(e) => onThumbSizeChange(Number(e.target.value))}
          title={`문서 썸네일 크기: ${thumbSize}px`}
        />

        <button
          className="btn btn-ghost btn-icon-only"
          style={{ padding: 2 }}
          onClick={() => onThumbSizeChange(Math.min(460, thumbSize + 30))}
          title="문서 썸네일 확대"
        >
          <ZoomIn size={14} color="var(--text-muted)" />
        </button>
      </div>
    </footer>
  );
};
