import React, { useState, useRef, useEffect } from 'react';
import { FolderScannerService, type ScanProgress } from '../../services/folderScanner';
import { PhotoLightningIndexer } from '../../services/photoLightningIndexer';
import { StorageService } from '../../services/storage';
import { ScanControlService } from '../../services/scanControl';
import { fileExplorerName, isWindows } from '../../utils/platform';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FolderSearch,
  HardDrive,
  AlertCircle,
  X,
  Trash2,
  FolderPlus,
  RefreshCw,
  FolderCheck,
  Check,
  Pause,
  Play,
  StopCircle,
  RotateCcw
} from 'lucide-react';

interface FolderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: () => void;
}

export const FolderManagerModal: React.FC<FolderManagerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
}) => {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedPath, setLastScannedPath] = useState<string | null>(null);
  const [watchedFolders, setWatchedFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('picasa_watched_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('picasa_watched_folders', JSON.stringify(watchedFolders));
  }, [watchedFolders]);

  if (!isOpen) return null;

  const runNativeScan = async (path: string) => {
    setErrorMessage(null);
    setIsScanning(true);
    setIsPaused(false);
    ScanControlService.reset();
    setLastScannedPath(path);
    try {
      await PhotoLightningIndexer.scanLocalDirectoryNative(path, (p) => {
        setProgress(p);
        if (!p.isScanning) {
          setIsScanning(false);
          setIsPaused(false);
          if (!watchedFolders.includes(p.currentFolder)) {
            setWatchedFolders((prev) => [...prev, p.currentFolder]);
          }
          onScanComplete();
        }
      });
    } catch (err: any) {
      setErrorMessage('폴더를 스캔하는 중 오류가 발생했습니다: ' + (err?.message || err));
      setIsScanning(false);
      setIsPaused(false);
      setProgress((prev) => (prev ? { ...prev, isScanning: false } : prev));
    }
  };

  const handleStartNativeScan = async () => {
    setErrorMessage(null);
    setIsScanning(true);
    try {
      if (isTauri()) {
        // Real OS folder picker + Rust filesystem access — no Chromium
        // "blocked system folder" restriction, since this never touches
        // the browser's File System Access API.
        const selected = await open({
          directory: true,
          multiple: false,
          title: `${fileExplorerName}에서 인덱싱할 사진 폴더 선택`,
        });
        if (selected && typeof selected === 'string') {
          await runNativeScan(selected);
        } else {
          setIsScanning(false);
        }
      } else if ('showDirectoryPicker' in window) {
        await FolderScannerService.scanLocalDirectoryPicker((p) => {
          setProgress(p);
          if (!p.isScanning) {
            setIsScanning(false);
            if (!watchedFolders.includes(p.currentFolder)) {
              setWatchedFolders((prev) => [...prev, p.currentFolder]);
            }
            onScanComplete();
          }
        });
      } else {
        fallbackInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(
          isTauri()
            ? '폴더를 스캔하는 중 오류가 발생했습니다: ' + (err?.message || err)
            : '폴더 접근 권한이 취소되었거나 지원되지 않습니다. 아래 폴더 선택 버튼을 이용해 주세요.'
        );
      }
      setIsScanning(false);
      setProgress((prev) => (prev ? { ...prev, isScanning: false } : prev));
    }
  };

  const handleTogglePause = async () => {
    if (isPaused) {
      await ScanControlService.resume();
      setIsPaused(false);
    } else {
      await ScanControlService.pause();
      setIsPaused(true);
    }
  };

  const handleStopScan = async () => {
    await ScanControlService.cancel();
    setIsPaused(false);
    // scan_directory resolves early once cancelled; the onProgress callback
    // in runNativeScan will flip isScanning off once that happens.
  };

  const handleRestartScan = async () => {
    if (!isTauri() || !lastScannedPath) return;
    await runNativeScan(lastScannedPath);
  };

  const handleFallbackFiles = async (files: FileList) => {
    setIsScanning(true);
    let count = 0;
    let mainFolderName = isWindows ? '내 사진 폴더' : '내 로컬 폴더';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name)) {
        const folderPath = file.webkitRelativePath
          ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
          : (isWindows ? 'C:\\Pictures' : '내 로컬 폴더');
        if (i === 0 && file.webkitRelativePath) {
          mainFolderName = file.webkitRelativePath.split('/')[0];
        }
        try {
          await StorageService.importLocalFile(file, folderPath);
          count++;
          setProgress({
            currentFolder: folderPath,
            foundImages: count,
            isScanning: true,
            statusText: `'${file.name}' 인덱싱 중... (총 ${count}장)`,
          });
        } catch (e) {
          console.warn(e);
        }
      }
    }

    setIsScanning(false);
    if (!watchedFolders.includes(mainFolderName)) {
      setWatchedFolders((prev) => [...prev, mainFolderName]);
    }
    setProgress({
      currentFolder: mainFolderName,
      foundImages: count,
      isScanning: false,
      statusText: `스캔 완료! 총 ${count}장의 사진이 라이브러리에 등록되었습니다.`,
    });
    onScanComplete();
  };

  const handleClearSamplePhotos = async () => {
    if (confirm('기본 샘플 사진을 모두 삭제하고 내 컴퓨터 사진만 남기시겠습니까?')) {
      const photos = await StorageService.getAllPhotos();
      for (const p of photos) {
        if (p.id.startsWith('photo-') && !p.tags.includes('로컬')) {
          await StorageService.deletePhoto(p.id);
        }
      }
      onScanComplete();
    }
  };

  const handleRemoveWatchedFolder = async (folderName: string) => {
    if (confirm(`'${folderName}' 폴더의 인덱싱된 사진들을 라이브러리에서 제거하시겠습니까?`)) {
      const photos = await StorageService.getAllPhotos();
      for (const p of photos) {
        if (p.folder?.startsWith(folderName)) {
          await StorageService.deletePhoto(p.id);
        }
      }
      setWatchedFolders((prev) => prev.filter((f) => f !== folderName));
      onScanComplete();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderSearch size={22} color="#4285f4" />
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>
                Picasa 폴더 관리자 (Folder Manager)
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                내 컴퓨터(Windows / Mac)의 폴더를 지정하여 사진을 자동 탐색 및 인덱싱합니다.
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              background: 'rgba(66, 133, 244, 0.08)',
              border: '1px solid rgba(66, 133, 244, 0.25)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              gap: 12,
            }}
          >
            <HardDrive size={24} color="#4285f4" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                내 컴퓨터의 실제 사진 폴더 스캔 및 인덱싱 ({isWindows ? 'Windows' : 'Mac'})
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {fileExplorerName}에서 원하는 폴더(예: <code>{isWindows ? 'C:\\Users\\...\\Pictures' : '~/Pictures'}</code>, <code>D:\\Photos</code>, <code>외장하드/USB</code>)를 지정하면, 하위 디렉토리까지 모든 사진을 고속으로 자동 검색하여 Picasa 라이브러리에 인덱싱합니다.
              </p>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="file"
              ref={fallbackInputRef}
              {...({ webkitdirectory: '', directory: '' } as any)}
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFallbackFiles(e.target.files)}
            />

            <button
              className="btn btn-primary"
              style={{ padding: '14px 20px', fontSize: '0.95rem', gap: 10 }}
              onClick={handleStartNativeScan}
              disabled={isScanning}
            >
              <FolderPlus size={20} />
              <span>{isScanning ? '컴퓨터 스캔 중...' : `📁 ${fileExplorerName}에서 인덱싱할 폴더 지정하기`}</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleClearSamplePhotos}
              style={{ color: 'var(--text-secondary)', gap: 6 }}
            >
              <Trash2 size={13} color="#ea4335" />
              <span>샘플 사진 비우기 (내 컴퓨터 사진만 보기)</span>
            </button>
          </div>

          {/* Watched Folders List */}
          {watchedFolders.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                인덱싱된 내 컴퓨터 폴더 목록:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {watchedFolders.map((f) => (
                  <div
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#161b24',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FolderCheck size={16} color="#34a853" />
                      <span style={{ color: '#ffffff', fontWeight: 500 }}>{f}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--accent-red)', padding: '2px 6px' }}
                      onClick={() => handleRemoveWatchedFolder(f)}
                      title="이 폴더 인덱스 제거"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress / Status display */}
          {progress && (
            <div
              style={{
                background: '#131822',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isPaused ? '#eab308' : '#4285f4', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isPaused ? (
                    <Pause size={14} />
                  ) : progress.isScanning ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} color="#34a853" />
                  )}
                  {isPaused ? '일시 정지됨' : progress.isScanning ? '인덱싱 진행 중...' : '스캔 완료'}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  발견된 사진: {progress.foundImages}장
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                {progress.statusText}
              </p>

              {isTauri() && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {progress.isScanning ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleTogglePause}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: isPaused ? '#16a34a' : '#a16207',
                          border: isPaused ? '1px solid #22c55e' : '1px solid #eab308',
                          color: '#ffffff',
                        }}
                        title={isPaused ? '일시 정지된 인덱싱을 재개합니다' : '진행 중인 인덱싱을 일시 정지합니다'}
                      >
                        {isPaused ? <Play size={13} /> : <Pause size={13} />}
                        <span>{isPaused ? '재개' : '일시 정지'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleStopScan}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dc2626', border: '1px solid #ef4444', color: '#ffffff' }}
                        title="진행 중인 인덱싱을 즉시 중지합니다"
                      >
                        <StopCircle size={13} />
                        <span>정지</span>
                      </button>
                    </>
                  ) : (
                    lastScannedPath && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={handleRestartScan}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16a34a', border: '1px solid #22c55e', color: '#ffffff' }}
                        title="같은 폴더를 다시 스캔합니다"
                      >
                        <RotateCcw size={13} />
                        <span>인덱싱 재시작</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                background: 'rgba(234, 67, 53, 0.15)',
                border: '1px solid rgba(234, 67, 53, 0.3)',
                padding: '10px 14px',
                borderRadius: 8,
                color: 'var(--accent-red)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
