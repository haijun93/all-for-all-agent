import React from 'react';
import type { EditParams } from '../../types/photo';
import { Sun, Contrast, Droplets, Thermometer, Moon, Lightbulb } from 'lucide-react';

interface TuningTabProps {
  params: EditParams;
  onChange: (newParams: Partial<EditParams>) => void;
  onResetTuning: () => void;
}

export const TuningTab: React.FC<TuningTabProps> = ({
  params,
  onChange,
  onResetTuning,
}) => {
  return (
    <div className="editor-tab-content">
      {/* Picasa Signature: Fill Light (필 라이트) */}
      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--accent-yellow)' }}>
            <Lightbulb size={14} /> 필 라이트 (Fill Light)
          </span>
          <span className="tuning-control-val">{params.fillLight}%</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={0}
          max={100}
          value={params.fillLight}
          onChange={(e) => onChange({ fillLight: Number(e.target.value) })}
        />
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          어두운 그림자 영역을 밝혀 디테일을 살립니다.
        </span>
      </div>

      {/* Brightness & Contrast */}
      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sun size={14} color="#fbbc05" /> 밝기 (Brightness)
          </span>
          <span className="tuning-control-val">{params.brightness}</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.brightness}
          onChange={(e) => onChange({ brightness: Number(e.target.value) })}
        />
      </div>

      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Contrast size={14} color="#4285f4" /> 대비 (Contrast)
          </span>
          <span className="tuning-control-val">{params.contrast}</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.contrast}
          onChange={(e) => onChange({ contrast: Number(e.target.value) })}
        />
      </div>

      {/* Saturation */}
      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Droplets size={14} color="#ea4335" /> 채도 (Saturation)
          </span>
          <span className="tuning-control-val">{params.saturation}</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.saturation}
          onChange={(e) => onChange({ saturation: Number(e.target.value) })}
        />
      </div>

      {/* Color Temperature (Warm / Cool) */}
      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Thermometer size={14} color="#34a853" /> 색온도 (Color Temp)
          </span>
          <span className="tuning-control-val">
            {params.temperature > 0 ? `Warm +${params.temperature}` : params.temperature < 0 ? `Cool ${params.temperature}` : '0'}
          </span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.temperature}
          onChange={(e) => onChange({ temperature: Number(e.target.value) })}
        />
      </div>

      {/* Highlights & Shadows */}
      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sun size={14} /> 하이라이트 (Highlights)
          </span>
          <span className="tuning-control-val">{params.highlights}</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.highlights}
          onChange={(e) => onChange({ highlights: Number(e.target.value) })}
        />
      </div>

      <div className="tuning-control-row">
        <div className="tuning-control-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Moon size={14} /> 그림자 (Shadows)
          </span>
          <span className="tuning-control-val">{params.shadows}</span>
        </div>
        <input
          type="range"
          className="tuning-slider"
          min={-100}
          max={100}
          value={params.shadows}
          onChange={(e) => onChange({ shadows: Number(e.target.value) })}
        />
      </div>

      {/* Reset Tuning Button */}
      <div style={{ marginTop: 10 }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={onResetTuning}
        >
          튜닝 슬라이더 전체 초기화
        </button>
      </div>
    </div>
  );
};
