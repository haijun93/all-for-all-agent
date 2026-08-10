import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Photo, Album, Person, ViewMode, GroupBy } from './types/photo';
import { StorageService } from './services/storage';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { BottomBar } from './components/common/BottomBar';
import { GalleryView } from './components/gallery/GalleryView';
import { ImportModal } from './components/gallery/ImportModal';
import { FolderManagerModal } from './components/gallery/FolderManagerModal';
import { EditorModal } from './components/editor/EditorModal';
import { LightboxModal } from './components/lightbox/LightboxModal';
import { Slideshow } from './components/lightbox/Slideshow';
import { CollageMaker } from './components/collage/CollageMaker';
import { PeopleManager } from './components/people/PeopleManager';

export const App: React.FC = () => {
  // State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Navigation & Filtering
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Gallery Display
  const [thumbSize, setThumbSize] = useState<number>(220);
  const [groupBy, setGroupBy] = useState<GroupBy>('folder');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Modals & Overlays
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [editorPhoto, setEditorPhoto] = useState<Photo | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);

  // Load data from IndexedDB
  const loadData = useCallback(async () => {
    try {
      const [fetchedPhotos, fetchedAlbums, fetchedPeople] = await Promise.all([
        StorageService.getAllPhotos(),
        StorageService.getAllAlbums(),
        StorageService.getAllPeople(),
      ]);
      setPhotos(fetchedPhotos);
      setAlbums(fetchedAlbums);
      setPeople(fetchedPeople);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived lists
  const folders = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => p.folder && set.add(p.folder));
    return Array.from(set);
  }, [photos]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [photos]);

  const starredCount = useMemo(() => {
    return photos.filter((p) => p.isStarred).length;
  }, [photos]);

  // Filtered photos based on category, search, and selected id
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = photo.title.toLowerCase().includes(q);
        const matchesFolder = photo.folder?.toLowerCase().includes(q);
        const matchesTags = photo.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesFaces = photo.faces?.some((f) => f.personName.toLowerCase().includes(q));
        if (!matchesTitle && !matchesFolder && !matchesTags && !matchesFaces) {
          return false;
        }
      }

      // 2. Category Filter
      if (activeCategory === 'starred') {
        return photo.isStarred;
      }
      if (activeCategory === 'album' && selectedCategoryId) {
        return photo.albumIds?.includes(selectedCategoryId);
      }
      if (activeCategory === 'folder' && selectedCategoryId) {
        return photo.folder === selectedCategoryId;
      }
      if (activeCategory === 'person' && selectedCategoryId) {
        return photo.faces?.some((f) => f.personId === selectedCategoryId);
      }
      if (activeCategory === 'tag' && selectedCategoryId) {
        return photo.tags?.includes(selectedCategoryId);
      }

      return true;
    });
  }, [photos, activeCategory, selectedCategoryId, searchQuery]);

  // Selection handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectGroup = (photoIds: string[]) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      const isAllInGroupSelected = photoIds.every((id) => next.has(id));
      if (isAllInGroupSelected) {
        photoIds.forEach((id) => next.delete(id));
      } else {
        photoIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPhotoIds(new Set(filteredPhotos.map((p) => p.id)));
  };

  const handleDeselectAll = () => {
    setSelectedPhotoIds(new Set());
  };

  // Photo actions
  const handleToggleStar = async (id: string) => {
    await StorageService.toggleStar(id);
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isStarred: !p.isStarred } : p))
    );
  };

  const handleBatchStar = async () => {
    for (const id of selectedPhotoIds) {
      await StorageService.toggleStar(id);
    }
    await loadData();
  };

  const handleBatchDelete = async () => {
    if (!confirm(`선택한 ${selectedPhotoIds.size}장의 사진을 삭제하시겠습니까?`)) return;
    for (const id of selectedPhotoIds) {
      await StorageService.deletePhoto(id);
    }
    setSelectedPhotoIds(new Set());
    await loadData();
  };

  const handleSaveEditedPhoto = async (editedPhoto: Photo, isCopy: boolean) => {
    if (isCopy) {
      const copyPhoto: Photo = {
        ...editedPhoto,
        id: `photo-${Date.now()}`,
        title: `${editedPhoto.title} (수정본)`,
        originalUrl: editedPhoto.url,
      };
      await StorageService.savePhoto(copyPhoto);
    } else {
      await StorageService.savePhoto(editedPhoto);
    }
    await loadData();
  };

  const handleCreateAlbum = async (name: string) => {
    const newAlbum = await StorageService.createAlbum(name, '사용자 맞춤 앨범');
    setAlbums((prev) => [...prev, newAlbum]);
    setActiveCategory('album');
    setSelectedCategoryId(newAlbum.id);
  };

  const handleCreatePerson = async (name: string) => {
    const newPerson = await StorageService.createPerson(name);
    setPeople((prev) => [...prev, newPerson]);
  };

  const handleResetDefaults = async () => {
    if (confirm('샘플 사진 라이브러리로 초기화하시겠습니까?')) {
      await StorageService.resetToDefaultCatalog();
      await loadData();
      setActiveCategory('all');
      setSelectedCategoryId(null);
      setSearchQuery('');
      setSelectedPhotoIds(new Set());
    }
  };

  const selectedPhotosList = useMemo(() => {
    return photos.filter((p) => selectedPhotoIds.has(p.id));
  }, [photos, selectedPhotoIds]);

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenFolderManager={() => setIsFolderManagerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onStartSlideshow={() => setIsSlideshowOpen(true)}
        onResetDefaults={handleResetDefaults}
        totalPhotosCount={photos.length}
      />

      {/* Main App Body */}
      <div className="main-body">
        {/* Left Sidebar */}
        <Sidebar
          activeCategory={activeCategory}
          selectedId={selectedCategoryId}
          onSelectCategory={(cat, id) => {
            setActiveCategory(cat);
            setSelectedCategoryId(id);
            if (viewMode !== 'gallery' && viewMode !== 'timeline') {
              setViewMode('gallery');
            }
          }}
          albums={albums}
          people={people}
          folders={folders}
          tags={tags}
          totalPhotosCount={photos.length}
          starredCount={starredCount}
          onCreateAlbum={handleCreateAlbum}
        />

        {/* Center Workspace */}
        <main className="gallery-workspace">
          {viewMode === 'gallery' && (
            <GalleryView
              photos={filteredPhotos}
              selectedPhotoIds={selectedPhotoIds}
              thumbSize={thumbSize}
              groupBy={groupBy}
              onToggleSelect={handleToggleSelect}
              onToggleStar={handleToggleStar}
              onOpenLightbox={(photo) => setLightboxPhoto(photo)}
              onOpenEditor={(photo) => setEditorPhoto(photo)}
              onSelectGroup={handleSelectGroup}
            />
          )}

          {viewMode === 'timeline' && (
            <GalleryView
              photos={filteredPhotos}
              selectedPhotoIds={selectedPhotoIds}
              thumbSize={thumbSize}
              groupBy="date"
              onToggleSelect={handleToggleSelect}
              onToggleStar={handleToggleStar}
              onOpenLightbox={(photo) => setLightboxPhoto(photo)}
              onOpenEditor={(photo) => setEditorPhoto(photo)}
              onSelectGroup={handleSelectGroup}
            />
          )}

          {viewMode === 'collage' && (
            <CollageMaker
              photos={photos}
              selectedPhotos={selectedPhotosList}
              onClose={() => setViewMode('gallery')}
            />
          )}

          {viewMode === 'people' && (
            <PeopleManager
              people={people}
              photos={photos}
              onSelectPerson={(id) => {
                setActiveCategory('person');
                setSelectedCategoryId(id);
              }}
              onCreatePerson={handleCreatePerson}
              onOpenLightbox={(photo) => setLightboxPhoto(photo)}
              onOpenEditor={(photo) => setEditorPhoto(photo)}
            />
          )}
        </main>
      </div>

      {/* Bottom Picasa Bar (Only shown in gallery/timeline views) */}
      {(viewMode === 'gallery' || viewMode === 'timeline') && (
        <BottomBar
          selectedCount={selectedPhotoIds.size}
          totalCount={filteredPhotos.length}
          thumbSize={thumbSize}
          onThumbSizeChange={setThumbSize}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onOpenEditorForSelected={() => {
            const first = selectedPhotosList[0];
            if (first) setEditorPhoto(first);
          }}
          onOpenCollageForSelected={() => setViewMode('collage')}
          onBatchStar={handleBatchStar}
          onBatchDelete={handleBatchDelete}
        />
      )}

      {/* Fullscreen Modals & Overlays */}
      <LightboxModal
        photo={lightboxPhoto}
        photosList={filteredPhotos}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onOpenEditor={(p) => {
          setLightboxPhoto(null);
          setEditorPhoto(p);
        }}
        onToggleStar={handleToggleStar}
      />

      <EditorModal
        photo={editorPhoto}
        isOpen={!!editorPhoto}
        onClose={() => setEditorPhoto(null)}
        onSavePhoto={handleSaveEditedPhoto}
      />

      <FolderManagerModal
        isOpen={isFolderManagerOpen}
        onClose={() => setIsFolderManagerOpen(false)}
        onScanComplete={loadData}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={loadData}
      />

      <Slideshow
        photos={filteredPhotos}
        isOpen={isSlideshowOpen}
        onClose={() => setIsSlideshowOpen(false)}
      />
    </div>
  );
};

export default App;
