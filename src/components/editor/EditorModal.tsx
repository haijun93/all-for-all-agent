import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Photo, EditParams } from '../../types/photo';
import { ImageProcessor, DEFAULT_EDIT_PARAMS } from '../../services/imageProcessor';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { BasicFixesTab } from './BasicFixesTab';
import { TuningTab } from './TuningTab';
import { EffectsTab } from './EffectsTab';
import { SplitView } from './SplitView';
import {
  Wrench,
  Sliders,
  Sparkles,
  Undo2,
  Redo2,
  RotateCcw,
  Save,
  Download,
  X,
  Columns,
  Check,
  Copy
} from 'lucide-react';

interface EditorModalProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePhoto: (photo: Photo, isCopy: boolean) => Promise<void>;
}

export const EditorModal: React.FC<EditorModalProps> = ({
  photo,
  isOpen,
  onClose,
  onSavePhoto,
}) => {
  if (!isOpen || !photo) return null;

  const [activeTab, setActiveTab] = useState<'basic' | 'tuning' | 'effects'>('basic');
  const [params, setParams] = useState<EditParams>(photo.editParams || { ...DEFAULT_EDIT_PARAMS });
  const [history, setHistory] = useState<EditParams[]>([photo.editParams || { ...DEFAULT_EDIT_PARAMS }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isSplitView, setIsSplitView] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fullResUrl, setFullResUrl] = useState<string | null>(null);
  const [isLoadingFullRes, setIsLoadingFullRes] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Natively-scanned photos carry a capped ~1600px preview in url/originalUrl
  // (kept small for low-spec-hardware grid scrolling); the editor needs the
  // true source resolution, so it's fetched on demand the moment a specific
  // photo is actually opened here, and used once it arrives.
  const originalImageSource = fullResUrl || photo.originalUrl || photo.url;

  useEffect(() => {
    let cancelled = false;
    setFullResUrl(null);

    if (photo.sourcePath && isTauri()) {
      setIsLoadingFullRes(true);
      invoke<{ thumbnail_data_url: string; width: number; height: number }>('generate_photo_full_res', {
        path: photo.sourcePath,
      })
        .then((res) => {
          if (!cancelled) setFullResUrl(res.thumbnail_data_url);
        })
        .catch((e) => console.warn('[EditorModal] Failed to load full-resolution photo, using cached preview:', e))
        .finally(() => {
          if (!cancelled) setIsLoadingFullRes(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [photo.id, photo.sourcePath]);

  // Render canvas whenever params change
  const updateCanvas = useCallback(async () => {
    if (canvasRef.current) {
      await ImageProcessor.renderToCanvas(canvasRef.current, originalImageSource, params, 1920);
    }
  }, [originalImageSource, params]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  const handleParamChange = (newValues: Partial<EditParams>) => {
    const updated = { ...params, ...newValues };
    setParams(updated);

    // Push to history
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(updated);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setParams(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setParams(next);
    }
  };

  const handleResetToOriginal = () => {
    const fresh = { ...DEFAULT_EDIT_PARAMS };
    setParams(fresh);
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(fresh);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleSave = async (isCopy: boolean) => {
    setIsSaving(true);
    try {
      // Export high-resolution edited image
      const exportedUrl = await ImageProcessor.exportImage(originalImageSource, params, 'image/jpeg', 0.95);

      const updatedPhoto: Photo = {
        ...photo,
        url: exportedUrl,
        thumbnailUrl: exportedUrl,
        editParams: params,
        updatedAt: new Date().toISOString(),
      };

      await onSavePhoto(updatedPhoto, isCopy);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 600);
    } catch (err) {
      console.error('Failed to save edited photo:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportDownload = async () => {
    const dataUrl = await ImageProcessor.exportImage(originalImageSource, params, 'image/jpeg', 0.98);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `picasa-edit-${photo.title || 'photo'}.jpg`;
    a.click();
  };

  const handleApplyCropRatio = (ratio: number | null) => {
    if (!ratio) {
      handleParamChange({ crop: undefined });
      return;
    }
    // Calculate centered crop box based on ratio
    const imgWidth = photo.width || photo.exif?.dimensions?.width || 1000;
    const imgHeight = photo.height || photo.exif?.dimensions?.height || 1000;
    const currentRatio = imgWidth / imgHeight;

    let cropW = 1;
    let cropH = 1;

    if (currentRatio > ratio) {
      cropW = ratio / currentRatio;
    } else {
      cropH = currentRatio / ratio;
    }

    const cropX = (1 - cropW) / 2;
    const cropY = (1 - cropH) / 2;

    handleParamChange({
      crop: { x: cropX, y: cropY, width: cropW, height: cropH },
    });
  };

  return (
    <div className="editor-fullscreen-container">
      {/* Top Navigation Bar */}
      <div className="editor-top-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon-only" onClick={onClose} title="편집기 닫기 (Esc)">
            <X size={20} />
          </button>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {photo.title}
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {photo.exif?.camera || photo.exif?.cameraMake || '디지털 사진'} • {photo.width || photo.exif?.dimensions?.width || 1920}×{photo.height || photo.exif?.dimensions?.height || 1080}
              {isLoadingFullRes && ' • 원본 화질 불러오는 중...'}
            </span>
          </div>
        </div>

        {/* Center Comparison & History Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn btn-sm ${isSplitView ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setIsSplitView(!isSplitView)}
            title="원본과 보정본 좌우 분할 비교 (Before / After)"
          >
            <Columns size={14} />
            <span>Before / After 분할 비교</span>
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            title="실행 취소 (Undo)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="다시 실행 (Redo)"
          >
            <Redo2 size={15} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleResetToOriginal}
            title="모든 수정을 취소하고 원본으로 복구"
            style={{ color: 'var(--accent-red)' }}
          >
            <RotateCcw size={14} />
            <span>원본 복구</span>
          </button>
        </div>

        {/* Right Save / Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExportDownload} title="고해상도 이미지 다운로드">
            <Download size={14} />
            <span>내보내기</span>
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            title="새로운 사본으로 저장"
          >
            <Copy size={14} />
            <span>사본으로 저장</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            title="기존 사진 덮어쓰기 저장"
          >
            {saveSuccess ? <Check size={14} /> : <Save size={14} />}
            <span>{saveSuccess ? '저장 완료!' : '저장 (Save)'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="editor-main-area">
        {/* Left 3-Tab Tool Panel */}
        <div className="editor-tools-sidebar">
          <div className="editor-tab-bar">
            <button
              className={`editor-tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
              onClick={() => setActiveTab('basic')}
            >
              <Wrench size={16} />
              <span>기본 수정</span>
            </button>
            <button
              className={`editor-tab-btn ${activeTab === 'tuning' ? 'active' : ''}`}
              onClick={() => setActiveTab('tuning')}
            >
              <Sliders size={16} />
              <span>튜닝 & 색상</span>
            </button>
            <button
              className={`editor-tab-btn ${activeTab === 'effects' ? 'active' : ''}`}
              onClick={() => setActiveTab('effects')}
            >
              <Sparkles size={16} />
              <span>특수 효과</span>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'basic' && (
              <BasicFixesTab
                params={params}
                onChange={handleParamChange}
                onApplyCropRatio={handleApplyCropRatio}
              />
            )}
            {activeTab === 'tuning' && (
              <TuningTab
                params={params}
                onChange={handleParamChange}
                onResetTuning={() =>
                  handleParamChange({
                    fillLight: 0,
                    highlights: 0,
                    shadows: 0,
                    temperature: 0,
                    tint: 0,
                    brightness: 0,
                    contrast: 0,
                    saturation: 0,
                    clarity: 0,
                  })
                }
              />
            )}
            {activeTab === 'effects' && (
              <EffectsTab params={params} onChange={handleParamChange} />
            )}
          </div>
        </div>

        {/* Center Stage Preview */}
        <div className="editor-canvas-stage">
          {isSplitView ? (
            <SplitView originalUrl={originalImageSource} canvasRef={canvasRef} />
          ) : (
            <canvas ref={canvasRef} className="editor-canvas-preview" />
          )}
        </div>
      </div>
    </div>
  );
};
