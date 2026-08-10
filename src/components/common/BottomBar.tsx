import React from 'react';
import type { GroupBy } from '../../types/photo';
import {
  Grid,
  Edit3,
  Layers,
  Star,
  Trash2,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
  FolderTree,
  Calendar
} from 'lucide-react';

interface BottomBarProps {
  selectedCount: number;
  totalCount: number;
  thumbSize: number;
  onThumbSizeChange: (size: number) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOpenEditorForSelected: () => void;
  onOpenCollageForSelected: () => void;
  onBatchStar: () => void;
  onBatchDelete: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  selectedCount,
  totalCount,
  thumbSize,
  onThumbSizeChange,
  groupBy,
  onGroupByChange,
  onSelectAll,
  onDeselectAll,
  onOpenEditorForSelected,
  onOpenCollageForSelected,
  onBatchStar,
  onBatchDelete,
}) => {
  return (
    <footer className="app-bottombar">
      {/* Left: Selection Status & Quick Batch Actions */}
      <div className="bottombar-selection-info">
        {selectedCount > 0 ? (
          <>
            <span className="bottombar-selection-pill">
              {selectedCount}개 선택됨
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onDeselectAll}
              title="선택 해제"
            >
              <Square size={13} />
              <span>선택 해제</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onOpenEditorForSelected}
              title="선택한 사진 Picasa 스튜디오에서 편집"
            >
              <Edit3 size={13} />
              <span>편집 스튜디오</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenCollageForSelected}
              title="선택한 사진으로 콜라주 생성"
            >
              <Layers size={13} />
              <span>콜라주 만들기</span>
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onBatchStar}
              title="즐겨찾기 토글"
            >
              <Star size={13} color="#fbbc05" />
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={onBatchDelete}
              title="선택한 사진 삭제"
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onSelectAll}
              title="모든 사진 선택"
            >
              <CheckSquare size={13} />
              <span>전체 선택</span>
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              총 {totalCount}장의 사진
            </span>
          </>
        )}
      </div>

      {/* Center: Grouping Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#11151c', padding: '3px 8px', borderRadius: 8 }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>정렬:</span>
        <button
          className={`btn btn-sm ${groupBy === 'folder' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ fontSize: '0.74rem', padding: '3px 8px' }}
          onClick={() => onGroupByChange('folder')}
        >
          <FolderTree size={12} />
          <span>폴더별</span>
        </button>
        <button
          className={`btn btn-sm ${groupBy === 'date' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ fontSize: '0.74rem', padding: '3px 8px' }}
          onClick={() => onGroupByChange('date')}
        >
          <Calendar size={12} />
          <span>날짜별</span>
        </button>
        <button
          className={`btn btn-sm ${groupBy === 'none' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ fontSize: '0.74rem', padding: '3px 8px' }}
          onClick={() => onGroupByChange('none')}
        >
          <Grid size={12} />
          <span>전체</span>
        </button>
      </div>

      {/* Right: Signature Picasa Zoom Slider */}
      <div className="zoom-slider-container">
        <ZoomOut size={15} />
        <input
          type="range"
          className="zoom-range-input"
          min={120}
          max={460}
          step={10}
          value={thumbSize}
          onChange={(e) => onThumbSizeChange(Number(e.target.value))}
          title="썸네일 크기 조절 (Picasa Zoom Slider)"
        />
        <ZoomIn size={16} />
      </div>
    </footer>
  );
};
