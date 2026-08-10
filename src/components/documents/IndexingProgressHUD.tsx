import React, { useState, useEffect } from 'react';
import { BackgroundIndexer, type IndexingStatus } from '../../services/backgroundIndexer';
import {
  Zap,
  Gauge,
  Cpu,
  CheckCircle2,
  Minimize2,
  Maximize2,
  X,
  FileText
} from 'lucide-react';

export const IndexingProgressHUD: React.FC = () => {
  const [status, setStatus] = useState<IndexingStatus>(BackgroundIndexer.getStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = BackgroundIndexer.subscribeStatus((newStatus) => {
      setStatus(newStatus);
      if (newStatus.isIndexing) {
        setIsVisible(true);
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isVisible && !status.isIndexing) return null;

  const isComplete = !status.isIndexing && status.scannedCount > 0;

  // Minimized Pill Mode (Bottom Right Floating Badge)
  if (status.isMinimized) {
    return (
      <div
        onClick={() => BackgroundIndexer.setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 70,
          right: 24,
          background: 'rgba(18, 24, 38, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(66, 133, 244, 0.4)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
          borderRadius: 24,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'all 0.2s ease',
        }}
        title="클릭하여 인덱싱 대시보드 확장"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {status.isIndexing ? (
            <Cpu size={16} color="#4285f4" className="animate-spin" />
          ) : (
            <CheckCircle2 size={16} color="#34a853" />
          )}
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
            {status.isIndexing ? '백그라운드 인덱싱 중' : '인덱싱 완료'}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            background: 'rgba(66, 133, 244, 0.2)',
            color: '#60a5fa',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {status.scannedCount}개 ({status.docsPerSecond.toLocaleString()} docs/s)
        </span>

        <Maximize2 size={14} color="#94a3b8" />
      </div>
    );
  }

  // Expanded Visual HUD Card
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        right: 24,
        width: 360,
        background: 'rgba(18, 24, 38, 0.94)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(66, 133, 244, 0.35)',
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: status.isIndexing ? 'rgba(66, 133, 244, 0.2)' : 'rgba(52, 168, 83, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {status.isIndexing ? (
              <Zap size={16} color="#fbbc05" />
            ) : (
              <CheckCircle2 size={16} color="#34a853" />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
              {status.isIndexing ? '백그라운드 인덱서 가동 중' : 'Everything 인덱싱 완료'}
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Non-blocking Real-time Stream
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="btn btn-ghost btn-icon-only"
            style={{ padding: 4 }}
            onClick={() => BackgroundIndexer.setMinimized(true)}
            title="백그라운드 최소화 (HUD 접기)"
          >
            <Minimize2 size={15} color="#94a3b8" />
          </button>
          {!status.isIndexing && (
            <button
              className="btn btn-ghost btn-icon-only"
              style={{ padding: 4 }}
              onClick={() => setIsVisible(false)}
              title="닫기"
            >
              <X size={15} color="#94a3b8" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Speedometer & Counter Banner */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
            처리 속도 (Speedometer)
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Gauge size={16} color="#34a853" />
            <span
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#34a853',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {status.docsPerSecond.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              docs/sec
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
            인덱싱 완료 문서
          </span>
          <span
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#60a5fa',
              fontFamily: 'var(--font-mono)',
              marginTop: 2,
              display: 'block',
            }}
          >
            {status.scannedCount} <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>개</span>
          </span>
        </div>
      </div>

      {/* Real-time Processing File Text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        <FileText size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: '0.74rem',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={status.currentFileName}
        >
          {status.currentFileName || '스트림 대기 중'}
        </span>
      </div>

      {/* Animated Gradient Progress Bar */}
      <div style={{ width: '100%', height: 6, background: '#131822', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: isComplete ? '100%' : '100%',
            height: '100%',
            background: isComplete
              ? '#34a853'
              : 'linear-gradient(90deg, #4285f4, #a855f7, #34a853)',
            animation: status.isIndexing ? 'shimmer 1.5s infinite linear' : 'none',
          }}
        />
      </div>

      {/* Footer Info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span>소요 시간: {(status.elapsedMs / 1000).toFixed(2)}초</span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--accent-blue)' }}
          onClick={() => BackgroundIndexer.setMinimized(true)}
        >
          백그라운드로 숨기기
        </button>
      </div>
    </div>
  );
};
