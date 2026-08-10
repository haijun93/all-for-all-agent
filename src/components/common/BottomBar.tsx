import React from 'react';
import type { GroupBy } from '../../types/photo';
import {
  Edit3,
  Layers,
  Star,
  Trash2,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
  FolderTree,
  Calendar,
  MapPin,
  Globe2
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
              <CheckSquare size={14} />
              <span>전체 선택</span>
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              총 {totalCount}장의 사진
            </span>
          </>
        )}
      </div>

      {/* Center: Grouping Controls */}
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
            className={`btn btn-sm ${groupBy === 'date' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('date')}
            title="촬영 날짜별 그룹화"
          >
            <Calendar size={12} />
            <span>날짜별</span>
          </button>
          <button
            className={`btn btn-sm ${groupBy === 'region' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('region')}
            title="지역/도시별 그룹화"
          >
            <Globe2 size={12} />
            <span>지역별</span>
          </button>
          <button
            className={`btn btn-sm ${groupBy === 'place' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => onGroupByChange('place')}
            title="촬영 스팟/장소별 그룹화"
          >
            <MapPin size={12} />
            <span>장소별</span>
          </button>
        </div>
      </div>

      {/* Right: Signature Picasa Live Thumbnail Zoom Slider */}
      <div className="zoom-slider-container">
        <button
          className="btn btn-ghost btn-icon-only"
          style={{ padding: 2 }}
          onClick={() => onThumbSizeChange(Math.max(120, thumbSize - 30))}
          title="썸네일 축소"
        >
          <ZoomOut size={14} color="var(--text-muted)" />
        </button>

        <input
          type="range"
          min="120"
          max="460"
          step="10"
          className="zoom-slider"
          value={thumbSize}
          onChange={(e) => onThumbSizeChange(Number(e.target.value))}
          title={`썸네일 크기: ${thumbSize}px`}
        />

        <button
          className="btn btn-ghost btn-icon-only"
          style={{ padding: 2 }}
          onClick={() => onThumbSizeChange(Math.min(460, thumbSize + 30))}
          title="썸네일 확대"
        >
          <ZoomIn size={14} color="var(--text-muted)" />
        </button>
      </div>
    </footer>
  );
};
