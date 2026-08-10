import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Photo, Album, Person, ViewMode, GroupBy } from './types/photo';
import type { DocumentItem, DocFormat, DocGroupBy } from './types/document';
import { StorageService } from './services/storage';
import { DocStorageService } from './services/docStorage';
import { Header, type AppMode } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { BottomBar } from './components/common/BottomBar';
import { GalleryView } from './components/gallery/GalleryView';
import { PlacesView } from './components/places/PlacesView';
import { ImportModal } from './components/gallery/ImportModal';
import { FolderManagerModal } from './components/gallery/FolderManagerModal';
import { EditorModal } from './components/editor/EditorModal';
import { LightboxModal } from './components/lightbox/LightboxModal';
import { Slideshow } from './components/lightbox/Slideshow';
import { CollageMaker } from './components/collage/CollageMaker';
import { PeopleManager } from './components/people/PeopleManager';

import { FastDocIndex } from './services/fastDocIndex';
import { ProgressiveDocWorker } from './services/progressiveDocWorker';

// Document Studio Components
import { DocSidebar } from './components/documents/DocSidebar';
import { DocGalleryView } from './components/documents/DocGalleryView';
import { DocBottomBar } from './components/documents/DocBottomBar';
import { DocLightboxModal } from './components/documents/DocLightboxModal';
import { DocFolderManagerModal } from './components/documents/DocFolderManagerModal';

export const App: React.FC = () => {
  // App Mode (Photos vs Documents)
  const [appMode, setAppMode] = useState<AppMode>('documents');

  // Photo State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Document State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docThumbSize, setDocThumbSize] = useState<number>(240);
  const [docGroupBy, setDocGroupBy] = useState<DocGroupBy>('category');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [lightboxDoc, setLightboxDoc] = useState<DocumentItem | null>(null);
  const [isDocFolderManagerOpen, setIsDocFolderManagerOpen] = useState(false);

  // Common Navigation & Filtering
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Photo Gallery Display
  const [thumbSize, setThumbSize] = useState<number>(220);
  const [groupBy, setGroupBy] = useState<GroupBy>('folder');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  // Photo Modals
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [editorPhoto, setEditorPhoto] = useState<Photo | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isSlideshowOpen, setIsSlideshowOpen] = useState(false);

  // Load photo data
  const loadPhotoData = useCallback(async () => {
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
      console.error('Failed to load photos:', err);
    }
  }, []);

  // Load document data and populate FastDocIndex
  const loadDocData = useCallback(async () => {
    try {
      const fetchedDocs = await DocStorageService.getAllDocuments();
      setDocuments(fetchedDocs);
      FastDocIndex.clear();
      FastDocIndex.addDocuments(fetchedDocs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  }, []);

  useEffect(() => {
    loadPhotoData();
    loadDocData();

    // Subscribe to Progressive Worker updates for background high-res rendering
    const unsubscribe = ProgressiveDocWorker.subscribe((updatedDoc) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === updatedDoc.id ? { ...d, thumbnailUrl: updatedDoc.thumbnailUrl } : d))
      );
    });

    return () => unsubscribe();
  }, [loadPhotoData, loadDocData]);

  // Reset category selection when mode changes
  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode);
    setActiveCategory('all');
    setSelectedCategoryId(null);
    setSearchQuery('');
  };

  // --- Derived Document Metadata ---
  const docCategories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => d.category && set.add(d.category));
    return Array.from(set);
  }, [documents]);

  const docKeywords = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => d.keywords?.forEach((k) => set.add(k)));
    return Array.from(set).slice(0, 16);
  }, [documents]);

  const docDates = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.dateCreated) {
        const parts = d.dateCreated.split('-');
        if (parts.length >= 2) set.add(`${parts[0]}년 ${parseInt(parts[1], 10)}월`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [documents]);

  const docFormats = useMemo(() => {
    const set = new Set<DocFormat>();
    documents.forEach((d) => d.format && set.add(d.format));
    return Array.from(set);
  }, [documents]);

  const docFolders = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => d.folder && set.add(d.folder));
    return Array.from(set);
  }, [documents]);

  const docStarredCount = useMemo(() => {
    return documents.filter((d) => d.isStarred).length;
  }, [documents]);

  // Filtered Documents (Ultra-Fast Everything In-Memory Search)
  const filteredDocuments = useMemo(() => {
    // 1. Fast Trigram In-Memory Search pass (<0.05ms)
    const baseDocs = searchQuery.trim()
      ? FastDocIndex.search(searchQuery, documents)
      : documents;

    // 2. Category & Metadata Filters
    return baseDocs.filter((doc) => {
      if (activeCategory === 'starred') return doc.isStarred;
      if (activeCategory === 'category' && selectedCategoryId) return doc.category === selectedCategoryId;
      if (activeCategory === 'keyword' && selectedCategoryId) return doc.keywords?.includes(selectedCategoryId);
      if (activeCategory === 'format' && selectedCategoryId) return doc.format === selectedCategoryId;
      if (activeCategory === 'folder' && selectedCategoryId) return doc.folder === selectedCategoryId;
      if (activeCategory === 'date' && selectedCategoryId) {
        const parts = doc.dateCreated.split('-');
        return `${parts[0]}년 ${parseInt(parts[1], 10)}월` === selectedCategoryId;
      }

      return true;
    });
  }, [documents, activeCategory, selectedCategoryId, searchQuery]);

  // Document Selection Handlers
  const handleToggleSelectDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectGroupDocs = (docIds: string[]) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      const isAllInGroupSelected = docIds.every((id) => next.has(id));
      if (isAllInGroupSelected) {
        docIds.forEach((id) => next.delete(id));
      } else {
        docIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleToggleDocStar = async (id: string) => {
    await DocStorageService.toggleStar(id);
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isStarred: !d.isStarred } : d))
    );
  };

  const handleBatchDocStar = async () => {
    for (const id of selectedDocIds) {
      await DocStorageService.toggleStar(id);
    }
    await loadDocData();
  };

  const handleBatchDocDelete = async () => {
    if (!confirm(`선택한 ${selectedDocIds.size}개의 문서를 삭제하시겠습니까?`)) return;
    for (const id of selectedDocIds) {
      await DocStorageService.deleteDocument(id);
    }
    setSelectedDocIds(new Set());
    await loadDocData();
  };

  // --- Derived Photo Metadata ---
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

  const regions = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      const loc = p.exif?.location;
      if (loc) {
        const key = `${loc.country ? loc.country + ' • ' : ''}${loc.province || loc.city || ''}`;
        if (key.trim()) set.add(key.trim());
      }
    });
    return Array.from(set);
  }, [photos]);

  const places = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      const spot = p.exif?.location?.name;
      if (spot) set.add(spot);
    });
    return Array.from(set);
  }, [photos]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    photos.forEach((p) => {
      if (p.dateTaken) {
        const parts = p.dateTaken.split('-');
        if (parts.length >= 2) set.add(`${parts[0]}년 ${parseInt(parts[1], 10)}월`);
      }
    });
    return Array.from(set).sort().reverse();
  }, [photos]);

  const starredCount = useMemo(() => {
    return photos.filter((p) => p.isStarred).length;
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = photo.title.toLowerCase().includes(q);
        const matchesFolder = photo.folder?.toLowerCase().includes(q);
        const matchesTags = photo.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesFaces = photo.faces?.some((f) => f.personName.toLowerCase().includes(q));
        const matchesPlace = photo.exif?.location?.name?.toLowerCase().includes(q);
        const matchesCity = photo.exif?.location?.city?.toLowerCase().includes(q);
        const matchesCountry = photo.exif?.location?.country?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesFolder && !matchesTags && !matchesFaces && !matchesPlace && !matchesCity && !matchesCountry) {
          return false;
        }
      }

      if (activeCategory === 'starred') return photo.isStarred;
      if (activeCategory === 'album' && selectedCategoryId) return photo.albumIds?.includes(selectedCategoryId);
      if (activeCategory === 'folder' && selectedCategoryId) return photo.folder === selectedCategoryId;
      if (activeCategory === 'person' && selectedCategoryId) return photo.faces?.some((f) => f.personId === selectedCategoryId);
      if (activeCategory === 'tag' && selectedCategoryId) return photo.tags?.includes(selectedCategoryId);
      if (activeCategory === 'region' && selectedCategoryId) {
        const loc = photo.exif?.location;
        const key = `${loc?.country ? loc.country + ' • ' : ''}${loc?.province || loc?.city || ''}`;
        return key.trim() === selectedCategoryId;
      }
      if (activeCategory === 'place' && selectedCategoryId) return photo.exif?.location?.name === selectedCategoryId;
      if (activeCategory === 'date' && selectedCategoryId) {
        if (photo.dateTaken) {
          const parts = photo.dateTaken.split('-');
          return `${parts[0]}년 ${parseInt(parts[1], 10)}월` === selectedCategoryId;
        }
      }

      return true;
    });
  }, [photos, activeCategory, selectedCategoryId, searchQuery]);

  // Photo Selection Handlers
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    await loadPhotoData();
  };

  const handleBatchDelete = async () => {
    if (!confirm(`선택한 ${selectedPhotoIds.size}장의 사진을 삭제하시겠습니까?`)) return;
    for (const id of selectedPhotoIds) {
      await StorageService.deletePhoto(id);
    }
    setSelectedPhotoIds(new Set());
    await loadPhotoData();
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
    await loadPhotoData();
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
    if (appMode === 'documents') {
      if (confirm('샘플 문서 라이브러리로 초기화하시겠습니까?')) {
        await DocStorageService.resetToDefaultDocuments();
        await loadDocData();
        setActiveCategory('all');
        setSelectedCategoryId(null);
        setSearchQuery('');
        setSelectedDocIds(new Set());
      }
    } else {
      if (confirm('샘플 사진 라이브러리로 초기화하시겠습니까?')) {
        await StorageService.resetToDefaultCatalog();
        await loadPhotoData();
        setActiveCategory('all');
        setSelectedCategoryId(null);
        setSearchQuery('');
        setSelectedPhotoIds(new Set());
      }
    }
  };

  const selectedPhotosList = useMemo(() => {
    return photos.filter((p) => selectedPhotoIds.has(p.id));
  }, [photos, selectedPhotoIds]);

  return (
    <div className="app-container">
      {/* Top Application Header */}
      <Header
        appMode={appMode}
        onAppModeChange={handleAppModeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenFolderManager={() =>
          appMode === 'documents' ? setIsDocFolderManagerOpen(true) : setIsFolderManagerOpen(true)
        }
        onOpenImport={() =>
          appMode === 'documents' ? setIsDocFolderManagerOpen(true) : setIsImportOpen(true)
        }
        onStartSlideshow={() => setIsSlideshowOpen(true)}
        onResetDefaults={handleResetDefaults}
        totalItemsCount={appMode === 'documents' ? documents.length : photos.length}
      />

      {/* Main App Body */}
      <div className="main-body">
        {/* Left Sidebar */}
        {appMode === 'documents' ? (
          <DocSidebar
            activeCategory={activeCategory}
            selectedId={selectedCategoryId}
            onSelectCategory={(cat, id) => {
              setActiveCategory(cat);
              setSelectedCategoryId(id);
            }}
            categories={docCategories}
            keywords={docKeywords}
            dates={docDates}
            formats={docFormats}
            folders={docFolders}
            totalDocsCount={documents.length}
            starredCount={docStarredCount}
          />
        ) : (
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
            regions={regions}
            places={places}
            dates={dates}
            totalPhotosCount={photos.length}
            starredCount={starredCount}
            onCreateAlbum={handleCreateAlbum}
          />
        )}

        {/* Center Workspace */}
        <main className="gallery-workspace">
          {appMode === 'documents' ? (
            <DocGalleryView
              docs={filteredDocuments}
              selectedDocIds={selectedDocIds}
              thumbSize={docThumbSize}
              groupBy={docGroupBy}
              onToggleSelect={handleToggleSelectDoc}
              onToggleStar={handleToggleDocStar}
              onOpenViewer={(d) => setLightboxDoc(d)}
              onSelectGroup={handleSelectGroupDocs}
            />
          ) : (
            <>
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

              {viewMode === 'places' && (
                <PlacesView
                  photos={photos}
                  onOpenLightbox={(photo) => setLightboxPhoto(photo)}
                  onOpenEditor={(photo) => setEditorPhoto(photo)}
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
                  onLibraryReload={loadPhotoData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Bottom Control Bar */}
      {appMode === 'documents' ? (
        <DocBottomBar
          selectedCount={selectedDocIds.size}
          totalCount={filteredDocuments.length}
          thumbSize={docThumbSize}
          onThumbSizeChange={setDocThumbSize}
          groupBy={docGroupBy}
          onGroupByChange={setDocGroupBy}
          onSelectAll={() => setSelectedDocIds(new Set(filteredDocuments.map((d) => d.id)))}
          onDeselectAll={() => setSelectedDocIds(new Set())}
          onBatchStar={handleBatchDocStar}
          onBatchDelete={handleBatchDocDelete}
        />
      ) : (
        (viewMode === 'gallery' || viewMode === 'timeline') && (
          <BottomBar
            selectedCount={selectedPhotoIds.size}
            totalCount={filteredPhotos.length}
            thumbSize={thumbSize}
            onThumbSizeChange={setThumbSize}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            onSelectAll={() => setSelectedPhotoIds(new Set(filteredPhotos.map((p) => p.id)))}
            onDeselectAll={() => setSelectedPhotoIds(new Set())}
            onOpenEditorForSelected={() => {
              const first = selectedPhotosList[0];
              if (first) setEditorPhoto(first);
            }}
            onOpenCollageForSelected={() => setViewMode('collage')}
            onBatchStar={handleBatchStar}
            onBatchDelete={handleBatchDelete}
          />
        )
      )}

      {/* Fullscreen Modals & Overlays */}
      <DocLightboxModal
        doc={lightboxDoc}
        isOpen={!!lightboxDoc}
        onClose={() => setLightboxDoc(null)}
        onToggleStar={handleToggleDocStar}
      />

      <DocFolderManagerModal
        isOpen={isDocFolderManagerOpen}
        onClose={() => setIsDocFolderManagerOpen(false)}
        onScanComplete={loadDocData}
      />

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
        onScanComplete={loadPhotoData}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportComplete={loadPhotoData}
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
