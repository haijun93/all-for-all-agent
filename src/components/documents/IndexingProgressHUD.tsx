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
  FileText,
  StopCircle,
  EyeOff
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

  if (!isVisible && !status.isIndexing && status.scannedCount === 0) return null;

  const isComplete = !status.isIndexing && status.scannedCount > 0;
  const isCancelled = !status.isIndexing && status.currentFileName.includes('중지');

  // 1. Minimized Floating Status Pill (Bottom Right)
  if (status.isMinimized) {
    return (
      <div
        onClick={() => BackgroundIndexer.setMinimized(false)}
        style={{
          position: 'fixed',
          bottom: 70,
          right: 24,
          background: 'rgba(18, 24, 38, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(66, 133, 244, 0.45)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          borderRadius: 24,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'all 0.2s ease',
          userSelect: 'none',
        }}
        title="클릭하여 인덱싱 대시보드 확장"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {status.isIndexing ? (
            <Cpu size={16} color="#4285f4" className="animate-spin" />
          ) : isCancelled ? (
            <StopCircle size={16} color="#ef4444" />
          ) : (
            <CheckCircle2 size={16} color="#34a853" />
          )}
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
            {status.isIndexing
              ? '백그라운드 인덱싱 가동 중'
              : isCancelled
              ? '인덱싱 중지됨'
              : '인덱싱 완료'}
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

        <button
          onClick={(e) => {
            e.stopPropagation();
            BackgroundIndexer.setMinimized(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            color: '#94a3b8',
          }}
          title="대시보드 펼치기"
        >
          <Maximize2 size={14} />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsVisible(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            color: '#94a3b8',
          }}
          title="완전 닫기"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // 2. Expanded Visual HUD Card
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        right: 24,
        width: 370,
        background: 'rgba(18, 24, 38, 0.96)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(66, 133, 244, 0.35)',
        boxShadow: '0 24px 54px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255,255,255,0.06)',
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
              width: 30,
              height: 30,
              borderRadius: 8,
              background: status.isIndexing
                ? 'rgba(66, 133, 244, 0.2)'
                : isCancelled
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(52, 168, 83, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {status.isIndexing ? (
              <Zap size={16} color="#fbbc05" />
            ) : isCancelled ? (
              <StopCircle size={16} color="#ef4444" />
            ) : (
              <CheckCircle2 size={16} color="#34a853" />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {status.isIndexing
                ? '백그라운드 인덱서 가동 중'
                : isCancelled
                ? '인덱싱 중지됨'
                : 'Everything 인덱싱 완료'}
            </h4>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Non-blocking Real-time Stream Engine
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => BackgroundIndexer.setMinimized(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
              transition: 'all 0.15s ease',
            }}
            title="백그라운드 최소화 (HUD 접기)"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              padding: '4px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
              transition: 'all 0.15s ease',
            }}
            title="HUD 닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Visual Speedometer & Counter Banner */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
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
                fontSize: '1.1rem',
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
              fontSize: '1.1rem',
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
            background: isCancelled
              ? '#ef4444'
              : isComplete
              ? '#34a853'
              : 'linear-gradient(90deg, #4285f4, #a855f7, #34a853)',
            animation: status.isIndexing ? 'shimmer 1.5s infinite linear' : 'none',
          }}
        />
      </div>

      {/* Footer Info & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>소요 시간: {(status.elapsedMs / 1000).toFixed(2)}초</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Stop Scan Button */}
          {status.isIndexing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                BackgroundIndexer.cancelCurrentScan();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#ffffff',
                background: 'rgba(239, 68, 68, 0.85)',
                border: '1px solid rgba(239, 68, 68, 0.9)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="현재 진행 중인 인덱싱을 즉시 중지합니다"
            >
              <StopCircle size={13} />
              <span>스캔 중지</span>
            </button>
          )}

          {/* Hide to Background (Minimize) Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              BackgroundIndexer.setMinimized(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(66, 133, 244, 0.85)',
              border: '1px solid rgba(66, 133, 244, 0.9)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="HUD를 접고 우측 하단 플로팅 뱃지로 최소화합니다"
          >
            <EyeOff size={13} />
            <span>백그라운드로 숨기기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
