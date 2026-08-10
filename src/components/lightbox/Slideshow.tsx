import React, { useState, useEffect } from 'react';
import type { Photo } from '../../types/photo';
import { Play, Pause, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideshowProps {
  photos: Photo[];
  startIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const Slideshow: React.FC<SlideshowProps> = ({
  photos,
  startIndex = 0,
  isOpen,
  onClose,
}) => {
  if (!isOpen || photos.length === 0) return null;

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalMs, setIntervalMs] = useState(3500);
  const [progress, setProgress] = useState(0);

  const currentPhoto = photos[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setProgress(0);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setProgress(0);
  };

  useEffect(() => {
    if (!isPlaying) return;

    const stepMs = 50;
    const progressInc = (stepMs / intervalMs) * 100;

    const timer = setInterval(() => {
      setProgress((old) => {
        if (old >= 100) {
          handleNext();
          return 0;
        }
        return old + progressInc;
      });
    }, stepMs);

    return () => clearInterval(timer);
  }, [isPlaying, intervalMs, currentIndex, photos.length]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Top Progress Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'rgba(255, 255, 255, 0.1)',
          zIndex: 320,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #ea4335, #fbbc05, #34a853, #4285f4)',
            transition: 'width 0.05s linear',
          }}
        />
      </div>

      {/* Control Overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          background: 'rgba(18, 23, 31, 0.85)',
          backdropFilter: 'blur(12px)',
          padding: '8px 20px',
          borderRadius: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 320,
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <button className="btn btn-ghost btn-sm" onClick={handlePrev}>
          <ChevronLeft size={18} />
        </button>
        <button
          className="btn btn-primary btn-sm"
          style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleNext}>
          <ChevronRight size={18} />
        </button>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {currentIndex + 1} / {photos.length}
        </span>

        <select
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            fontSize: '0.78rem',
            padding: '4px 8px',
            borderRadius: 6,
            outline: 'none',
          }}
        >
          <option value={2000}>2초 간격</option>
          <option value={3500}>3.5초 간격</option>
          <option value={5000}>5초 간격</option>
        </select>

        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Slideshow Image */}
      <img
        key={currentPhoto.id}
        src={currentPhoto.url}
        alt={currentPhoto.title}
        style={{
          maxWidth: '92vw',
          maxHeight: '88vh',
          objectFit: 'contain',
          animation: 'fadeIn 0.5s ease-out',
        }}
      />

      {/* Image Title caption */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          padding: '6px 16px',
          borderRadius: 20,
          color: '#ffffff',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        {currentPhoto.title}
      </div>
    </div>
  );
};
