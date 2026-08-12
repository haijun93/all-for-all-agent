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
  EyeOff,
  RotateCcw,
  Pause,
  Play
} from 'lucide-react';

export const IndexingProgressHUD: React.FC = () => {
  const [status, setStatus] = useState<IndexingStatus>(BackgroundIndexer.getStatus());

  useEffect(() => {
    const unsubscribe = BackgroundIndexer.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => unsubscribe();
  }, []);

  // If HUD is not open, do not render
  if (!status.isHUDOpen) return null;

  const isComplete = !status.isIndexing && status.scannedCount > 0 && !status.currentFileName.includes('중지');
  const isCancelled = !status.isIndexing && status.currentFileName.includes('중지');

  // Handle Stop Scan
  const handleStopScan = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    BackgroundIndexer.cancelCurrentScan();
  };

  // Handle Restart / Resume Scan
  const handleRestartScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await BackgroundIndexer.resumeOrRestartScan();
  };

  // Handle Pause / Resume Toggle (only meaningful while actively indexing)
  const handleTogglePause = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status.isPaused) {
      await BackgroundIndexer.resumeCurrentScan();
    } else {
      await BackgroundIndexer.pauseCurrentScan();
    }
  };

  // Handle Hide / Minimize (작업창 숨기기)
  const handleHideToPill = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    BackgroundIndexer.setMinimized(true);
  };

  // Handle Restore (작업창 되살리기 / 펼치기)
  const handleRestoreFull = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    BackgroundIndexer.showHUD();
  };

  // Handle Complete Dismiss (완전히 닫기)
  const handleCloseCompletely = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    BackgroundIndexer.hideHUD();
  };

  // 1. Minimized Floating Status Pill Mode (Bottom Right)
  if (status.isMinimized) {
    return (
      <div
        onClick={handleRestoreFull}
        style={{
          position: 'fixed',
          bottom: 72,
          right: 24,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.08)',
          borderRadius: 30,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          zIndex: 100000,
          pointerEvents: 'auto',
          userSelect: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title="클릭하여 작업창 되살리기 (대시보드 확장)"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {status.isPaused ? (
            <Pause size={16} color="#eab308" />
          ) : status.isIndexing ? (
            <Cpu size={16} color="#3b82f6" className="animate-spin" />
          ) : isCancelled ? (
            <StopCircle size={16} color="#ef4444" />
          ) : (
            <CheckCircle2 size={16} color="#22c55e" />
          )}
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
            {status.isPaused
              ? '인덱싱 일시 정지됨'
              : status.isIndexing
              ? '백그라운드 인덱싱 가동 중'
              : isCancelled
              ? '인덱싱 중지됨'
              : '인덱싱 완료'}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {status.scannedCount}개 ({status.docsPerSecond.toLocaleString()} docs/s)
        </span>

        {/* Restore Button */}
        <button
          type="button"
          onClick={handleRestoreFull}
          style={{
            background: 'rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: 12,
            cursor: 'pointer',
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: '#ffffff',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}
          title="작업창 되살리기"
        >
          <Maximize2 size={12} />
          <span>되살리기</span>
        </button>

        {/* Complete Close Button */}
        <button
          type="button"
          onClick={handleCloseCompletely}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}
          title="작업창 완전히 닫기"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  // 2. Expanded Visual HUD Card (작업창)
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 72,
        right: 24,
        width: 370,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        boxShadow: '0 24px 54px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        zIndex: 100000,
        pointerEvents: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: status.isPaused
                ? 'rgba(234, 179, 8, 0.2)'
                : status.isIndexing
                ? 'rgba(59, 130, 246, 0.2)'
                : isCancelled
                ? 'rgba(239, 68, 68, 0.2)'
                : 'rgba(34, 197, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {status.isPaused ? (
              <Pause size={16} color="#eab308" />
            ) : status.isIndexing ? (
              <Zap size={16} color="#eab308" />
            ) : isCancelled ? (
              <StopCircle size={16} color="#ef4444" />
            ) : (
              <CheckCircle2 size={16} color="#22c55e" />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {status.isPaused
                ? '인덱싱 일시 정지됨'
                : status.isIndexing
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

        {/* Top Actions: Hide (Minimize) & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={handleHideToPill}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
              transition: 'all 0.15s ease',
            }}
            title="작업창 숨기기 (플로팅 뱃지로 최소화)"
          >
            <Minimize2 size={14} />
          </button>
          <button
            type="button"
            onClick={handleCloseCompletely}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: '5px 7px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: '#94a3b8',
              transition: 'all 0.15s ease',
            }}
            title="작업창 완전히 닫기"
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
            <Gauge size={16} color="#22c55e" />
            <span
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#22c55e',
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
      <div style={{ width: '100%', height: 6, background: '#090d16', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: isComplete ? '100%' : '100%',
            height: '100%',
            background: isCancelled
              ? '#ef4444'
              : isComplete
              ? '#22c55e'
              : 'linear-gradient(90deg, #3b82f6, #a855f7, #22c55e)',
            animation: status.isIndexing ? 'shimmer 1.5s infinite linear' : 'none',
          }}
        />
      </div>

      {/* Footer Info & Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span>소요 시간: {(status.elapsedMs / 1000).toFixed(2)}초</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pause / Resume Toggle + Stop, shown together while indexing */}
          {status.isIndexing ? (
            <>
              <button
                type="button"
                onClick={handleTogglePause}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: status.isPaused ? '#16a34a' : '#a16207',
                  border: status.isPaused ? '1px solid #22c55e' : '1px solid #eab308',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: status.isPaused
                    ? '0 2px 8px rgba(22, 163, 74, 0.4)'
                    : '0 2px 8px rgba(161, 98, 7, 0.4)',
                }}
                title={status.isPaused ? '일시 정지된 인덱싱을 재개합니다' : '진행 중인 인덱싱을 일시 정지합니다'}
              >
                {status.isPaused ? <Play size={13} /> : <Pause size={13} />}
                <span>{status.isPaused ? '재개' : '일시 정지'}</span>
              </button>
              <button
                type="button"
                onClick={handleStopScan}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: '#dc2626',
                  border: '1px solid #ef4444',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4)',
                }}
                title="진행 중인 인덱싱을 즉시 중지합니다"
              >
                <StopCircle size={13} />
                <span>스캔 중지</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleRestartScan}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#ffffff',
                background: '#16a34a',
                border: '1px solid #22c55e',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.4)',
              }}
              title="스캔을 다시 시작하거나 최신 변경사항을 재색인합니다"
            >
              <RotateCcw size={13} />
              <span>스캔 재시작</span>
            </button>
          )}

          {/* Hide to Background (작업창 숨기기) Button */}
          <button
            type="button"
            onClick={handleHideToPill}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              color: '#ffffff',
              background: '#2563eb',
              border: '1px solid #3b82f6',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
            }}
            title="작업창을 숨기고 우측 하단 플로팅 알약 뱃지로 최소화합니다"
          >
            <EyeOff size={13} />
            <span>작업창 숨기기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
