import React, { useState, useEffect, useRef } from 'react';
import type { Photo } from '../../types/photo';
import {
  Layers,
  Shuffle,
  Download,
  LayoutGrid,
  Sparkles,
  RotateCw,
  X
} from 'lucide-react';

interface CollageMakerProps {
  photos: Photo[];
  selectedPhotos: Photo[];
  onClose: () => void;
}

interface PileItem {
  id: string;
  photo: Photo;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

export const CollageMaker: React.FC<CollageMakerProps> = ({
  photos,
  selectedPhotos,
  onClose,
}) => {
  // Use selected photos if available, otherwise take first 6 photos
  const activePhotos = selectedPhotos.length >= 2 ? selectedPhotos : photos.slice(0, 6);

  const [collageStyle, setCollageStyle] = useState<'pile' | 'grid'>('pile');
  const [bgColor, setBgColor] = useState<string>('#161b24');
  const [pileItems, setPileItems] = useState<PileItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize Picture Pile items
  const generatePile = (items: Photo[]) => {
    const boardWidth = 800;
    const boardHeight = 560;

    const newItems: PileItem[] = items.map((photo, index) => {
      const w = 220;
      const h = 180;
      const marginX = 80;
      const marginY = 60;

      const randomX = marginX + Math.random() * (boardWidth - w - marginX * 2);
      const randomY = marginY + Math.random() * (boardHeight - h - marginY * 2);
      const randomRot = (Math.random() - 0.5) * 35; // -17.5 to +17.5 deg

      return {
        id: `pile-${photo.id}-${index}`,
        photo,
        x: randomX,
        y: randomY,
        width: w,
        height: h,
        rotation: Math.round(randomRot),
        zIndex: index + 1,
      };
    });

    setPileItems(newItems);
  };

  useEffect(() => {
    generatePile(activePhotos);
  }, [activePhotos]);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingId.current = id;

    // Bring to front
    setPileItems((prev) => {
      const maxZ = Math.max(...prev.map((it) => it.zIndex), 1);
      return prev.map((it) => (it.id === id ? { ...it, zIndex: maxZ + 1 } : it));
    });

    const item = pileItems.find((it) => it.id === id);
    if (item && boardRef.current) {
      const boardRect = boardRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - boardRect.left - item.x,
        y: e.clientY - boardRect.top - item.y,
      };
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingId.current || !boardRef.current) return;
      const boardRect = boardRef.current.getBoundingClientRect();
      const newX = e.clientX - boardRect.left - dragOffset.current.x;
      const newY = e.clientY - boardRect.top - dragOffset.current.y;

      setPileItems((prev) =>
        prev.map((it) => (it.id === draggingId.current ? { ...it, x: newX, y: newY } : it))
      );
    };

    const handlePointerUp = () => {
      draggingId.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handleRotateItem = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPileItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, rotation: it.rotation + delta } : it))
    );
  };

  const handleExportCollage = async () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (collageStyle === 'pile') {
        const sortedItems = [...pileItems].sort((a, b) => a.zIndex - b.zIndex);
        const scale = 2; // scale up to 1600x1120

        for (const item of sortedItems) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
            img.src = item.photo.url;
          });

          ctx.save();
          ctx.translate((item.x + item.width / 2) * scale, (item.y + item.height / 2) * scale);
          ctx.rotate((item.rotation * Math.PI) / 180);

          // Draw white photo border and shadow
          const pw = item.width * scale;
          const ph = item.height * scale;
          const pad = 12 * scale;

          ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
          ctx.shadowBlur = 20 * scale;
          ctx.shadowOffsetY = 10 * scale;

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-pw / 2 - pad, -ph / 2 - pad, pw + pad * 2, ph + pad * 3);

          ctx.shadowColor = 'transparent';
          ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph);

          ctx.restore();
        }
      } else if (collageStyle === 'grid') {
        const cols = Math.ceil(Math.sqrt(activePhotos.length));
        const rows = Math.ceil(activePhotos.length / cols);
        const spacing = 12;
        const cellW = (canvas.width - spacing * 2 * (cols + 1)) / cols;
        const cellH = (canvas.height - spacing * 2 * (rows + 1)) / rows;

        for (let i = 0; i < activePhotos.length; i++) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const x = spacing * 2 + c * (cellW + spacing * 2);
          const y = spacing * 2 + r * (cellH + spacing * 2);

          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
            img.src = activePhotos[i].url;
          });

          ctx.drawImage(img, x, y, cellW, cellH);
        }
      }

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `picasa-collage-${Date.now()}.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="collage-workspace">
      {/* Top Toolbar */}
      <div className="collage-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon-only" onClick={onClose} title="콜라주 닫기">
            <X size={18} />
          </button>
          <Layers size={18} color="#4285f4" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            Picasa 콜라주 메이커 (Collage Creator)
          </h3>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            ({activePhotos.length}장의 사진으로 제작)
          </span>
        </div>

        {/* Collage Style Selection */}
        <div style={{ display: 'flex', background: '#111620', padding: 4, borderRadius: 8, gap: 4 }}>
          <button
            className={`btn btn-sm ${collageStyle === 'pile' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCollageStyle('pile')}
          >
            <Sparkles size={13} />
            <span>사진 더미 (Picture Pile)</span>
          </button>
          <button
            className={`btn btn-sm ${collageStyle === 'grid' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setCollageStyle('grid')}
          >
            <LayoutGrid size={13} />
            <span>격자 모자이크 (Grid)</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {collageStyle === 'pile' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => generatePile(activePhotos)}
              title="사진 위치 및 각도 무작위 재배치"
            >
              <Shuffle size={14} />
              <span>더미 뒤섞기 (Shuffle)</span>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>배경색:</span>
            {['#161b24', '#000000', '#ffffff', '#2b1b17', '#172554'].map((col) => (
              <div
                key={col}
                onClick={() => setBgColor(col)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: col,
                  cursor: 'pointer',
                  border: bgColor === col ? '2px solid #4285f4' : '1px solid rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportCollage}
            disabled={isExporting}
          >
            <Download size={14} />
            <span>{isExporting ? '생성 중...' : '콜라주 다운로드'}</span>
          </button>
        </div>
      </div>

      {/* Main Board Stage */}
      <div className="collage-canvas-container">
        <div
          ref={boardRef}
          className="collage-board"
          style={{ backgroundColor: bgColor }}
        >
          {collageStyle === 'pile' ? (
            pileItems.map((item) => (
              <div
                key={item.id}
                className="collage-item-pile"
                style={{
                  transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,
                  width: item.width,
                  height: item.height,
                  zIndex: item.zIndex,
                }}
                onPointerDown={(e) => handlePointerDown(item.id, e)}
              >
                <img
                  src={item.photo.url}
                  alt={item.photo.title}
                  className="collage-item-img"
                  draggable={false}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>
                    {item.photo.title.slice(0, 16)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 2, color: '#334155' }}
                    onClick={(e) => handleRotateItem(item.id, 15, e)}
                    title="15도 회전"
                  >
                    <RotateCw size={10} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(activePhotos.length))}, 1fr)`,
                gap: 12,
                padding: 12,
                width: '100%',
                height: '100%',
              }}
            >
              {activePhotos.map((photo) => (
                <div
                  key={photo.id}
                  style={{
                    overflow: 'hidden',
                    borderRadius: 6,
                    background: '#000',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
