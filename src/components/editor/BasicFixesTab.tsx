import React from 'react';
import type { EditParams } from '../../types/photo';
import {
  Wand2,
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Compass,
  Sun,
  Palette
} from 'lucide-react';

interface BasicFixesTabProps {
  params: EditParams;
  onChange: (newParams: Partial<EditParams>) => void;
  onApplyCropRatio: (ratio: number | null) => void;
}

export const BasicFixesTab: React.FC<BasicFixesTabProps> = ({
  params,
  onChange,
  onApplyCropRatio,
}) => {
  return (
    <div className="editor-tab-content">
      {/* Picasa "I'm Feeling Lucky" Hero Button */}
      <div>
        <button
          className="btn btn-lucky"
          style={{ width: '100%', padding: '12px 16px', fontSize: '0.92rem' }}
          onClick={() => onChange({ feelingLucky: !params.feelingLucky })}
        >
          <Wand2 size={18} />
          <span>I'm Feeling Lucky! (원클릭 자동 보정)</span>
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
          색상 균형, 최적 대비 및 노출을 인공지능 스타일로 자동 튜닝합니다.
        </p>
      </div>

      {/* Auto One-Click Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${params.autoContrast ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ flex: 1 }}
          onClick={() => onChange({ autoContrast: !params.autoContrast })}
        >
          <Sun size={14} />
          <span>자동 대비</span>
        </button>
        <button
          className={`btn ${params.autoColor ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ flex: 1 }}
          onClick={() => onChange({ autoColor: !params.autoColor })}
        >
          <Palette size={14} />
          <span>자동 색상</span>
        </button>
      </div>

      {/* Straighten & Rotate Section */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Compass size={15} color="#fbbc05" /> 수평 맞추기 (Straighten)
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {params.straighten > 0 ? `+${params.straighten}°` : `${params.straighten}°`}
          </span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-45}
          max={45}
          step={1}
          value={params.straighten}
          onChange={(e) => onChange({ straighten: Number(e.target.value) })}
        />
        {params.straighten !== 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.7rem', padding: '2px 4px', marginTop: 4 }}
            onClick={() => onChange({ straighten: 0 })}
          >
            수평 초기화 (0°)
          </button>
        )}
      </div>

      {/* 90-degree Rotation & Flipping */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1 }}
          onClick={() => onChange({ rotation: (params.rotation + 270) % 360 })}
          title="반시계 90도 회전"
        >
          <RotateCcw size={14} />
          <span>90° 좌회전</span>
        </button>
        <button
          className="btn btn-secondary btn-sm"
          style={{ flex: 1 }}
          onClick={() => onChange({ rotation: (params.rotation + 90) % 360 })}
          title="시계 90도 회전"
        >
          <RotateCw size={14} />
          <span>90° 우회전</span>
        </button>
        <button
          className={`btn ${params.flipH ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => onChange({ flipH: !params.flipH })}
          title="좌우 반전"
        >
          <FlipHorizontal size={14} />
        </button>
        <button
          className={`btn ${params.flipV ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => onChange({ flipV: !params.flipV })}
          title="상하 반전"
        >
          <FlipVertical size={14} />
        </button>
      </div>

      {/* Crop Aspect Presets */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Crop size={15} color="#4285f4" /> 자르기 비율 (Crop Presets)
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onApplyCropRatio(null)}>
            원본 비율
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onApplyCropRatio(1)}>
            1:1 정방형
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onApplyCropRatio(4 / 3)}>
            4:3 표준
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onApplyCropRatio(16 / 9)}>
            16:9 와이드
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onApplyCropRatio(3 / 2)}>
            3:2 엽서
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onChange({ crop: undefined })}
            style={{ color: 'var(--accent-red)' }}
          >
            자르기 해제
          </button>
        </div>
      </div>
    </div>
  );
};
