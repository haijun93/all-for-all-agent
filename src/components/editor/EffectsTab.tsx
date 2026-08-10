import React from 'react';
import type { EditParams } from '../../types/photo';
import { Sparkles, Sliders } from 'lucide-react';

interface EffectsTabProps {
  params: EditParams;
  onChange: (newParams: Partial<EditParams>) => void;
}

const PICASA_FILTERS: Array<{
  id: EditParams['filter'];
  name: string;
  desc: string;
  previewBg: string;
}> = [
  { id: 'none', name: '원본', desc: '필터 없음', previewBg: 'linear-gradient(135deg, #64748b, #334155)' },
  { id: 'bw', name: '흑백 (B&W)', desc: '고대비 흑백', previewBg: 'linear-gradient(135deg, #ffffff, #000000)' },
  { id: 'sepia', name: '세피아', desc: '클래식 빈티지 갈색톤', previewBg: 'linear-gradient(135deg, #e4c49b, #69401b)' },
  { id: 'warmify', name: '웜톤 (Warm)', desc: '골든 아워 감성', previewBg: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { id: 'vignette', name: '비네트', desc: '주변부 어둡게 집중', previewBg: 'radial-gradient(circle, #94a3b8 20%, #0f172a 90%)' },
  { id: 'film', name: '필름 그레인', desc: '아날로그 필름 질감', previewBg: 'linear-gradient(135deg, #78716c, #292524)' },
  { id: 'lomo', name: '로모 (Lomo)', desc: '강렬한 채도와 비네트', previewBg: 'linear-gradient(135deg, #3b82f6, #1e1b4b)' },
  { id: 'vintage60', name: '1960년대', desc: '크로스 프로세싱', previewBg: 'linear-gradient(135deg, #ec4899, #14b8a6)' },
  { id: 'softFocus', name: '소프트 포커스', desc: '오튼 효과 몽환적 글로우', previewBg: 'linear-gradient(135deg, #fbcfe8, #a78bfa)' },
  { id: 'cinema', name: '시네마 룩', desc: '틸 & 오렌지 무비 룩', previewBg: 'linear-gradient(135deg, #06b6d4, #f97316)' },
  { id: 'posterize', name: '포스터라이즈', desc: '팝아트 색상 분할', previewBg: 'linear-gradient(135deg, #10b981, #ef4444)' },
  { id: 'tiltShift', name: '틸트시프트', desc: '미니어처 포커스', previewBg: 'linear-gradient(180deg, #38bdf8 0%, #0369a1 50%, #0c4a6e 100%)' },
];

export const EffectsTab: React.FC<EffectsTabProps> = ({ params, onChange }) => {
  return (
    <div className="editor-tab-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Sparkles size={16} color="#a855f7" />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Picasa 특수 효과 및 필터
        </span>
      </div>

      <div className="effects-grid">
        {PICASA_FILTERS.map((f) => {
          const isActive = params.filter === f.id;
          return (
            <div
              key={f.id}
              className={`effect-card ${isActive ? 'active' : ''}`}
              onClick={() => onChange({ filter: f.id })}
              title={f.desc}
            >
              <div className="effect-preview-box" style={{ background: f.previewBg }} />
              <span className="effect-name">{f.name}</span>
            </div>
          );
        })}
      </div>

      {params.filter !== 'none' && (
        <div className="tuning-control-row" style={{ marginTop: 12 }}>
          <div className="tuning-control-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={14} color="#a855f7" /> 효과 강도 (Filter Strength)
            </span>
            <span className="tuning-control-val">{params.filterStrength}%</span>
          </div>
          <input
            type="range"
            className="tuning-slider"
            min={0}
            max={100}
            value={params.filterStrength}
            onChange={(e) => onChange({ filterStrength: Number(e.target.value) })}
          />
        </div>
      )}

      {/* Additional Vignette & Grain Sliders */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="tuning-control-row">
          <div className="tuning-control-header">
            <span>비네트 효과 (Vignette)</span>
            <span className="tuning-control-val">{params.vignetteStrength}%</span>
          </div>
          <input
            type="range"
            className="tuning-slider"
            min={0}
            max={100}
            value={params.vignetteStrength}
            onChange={(e) => onChange({ vignetteStrength: Number(e.target.value) })}
          />
        </div>

        <div className="tuning-control-row">
          <div className="tuning-control-header">
            <span>필름 노이즈 (Film Grain)</span>
            <span className="tuning-control-val">{params.grainStrength}%</span>
          </div>
          <input
            type="range"
            className="tuning-slider"
            min={0}
            max={100}
            value={params.grainStrength}
            onChange={(e) => onChange({ grainStrength: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
};
