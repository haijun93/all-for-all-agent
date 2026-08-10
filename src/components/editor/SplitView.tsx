import React, { useState, useRef, useEffect } from 'react';
import { Columns } from 'lucide-react';

interface SplitViewProps {
  originalUrl: string;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const SplitView: React.FC<SplitViewProps> = ({ originalUrl, canvasRef }) => {
  const [splitPos, setSplitPos] = useState(50); // percentage 0 - 100
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handlePointerDown = () => {
    isDragging.current = true;
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSplitPos(pct);
    };

    const handlePointerUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="split-view-container"
      onPointerDown={handlePointerDown}
    >
      {/* Background: Edited Canvas */}
      <canvas
        ref={canvasRef}
        className="editor-canvas-preview"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />

      {/* Foreground: Original Image clipped */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: `${splitPos}%`,
          overflow: 'hidden',
          borderRight: '2px solid #ffffff',
        }}
      >
        <img
          src={originalUrl}
          alt="Original"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: containerRef.current?.offsetWidth || '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Floating Dividers & Badges */}
      <div
        className="split-view-divider"
        style={{ left: `calc(${splitPos}% - 1.5px)` }}
      >
        <div className="split-view-handle">
          <Columns size={16} />
        </div>
      </div>

      <div className="split-badge-before">원본 (Before)</div>
      <div className="split-badge-after">보정본 (After)</div>
    </div>
  );
};
