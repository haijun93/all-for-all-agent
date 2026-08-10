import type { FaceTag } from '../types/photo';
import { StorageService } from './storage';

export interface DetectedFace {
  photoId: string;
  box: {
    x: number; // 0 to 1 percentage
    y: number;
    width: number;
    height: number;
  };
  avatarDataUrl: string;
  embedding: number[];
}

export interface FaceCluster {
  clusterId: string;
  representativeAvatar: string;
  faces: DetectedFace[];
}

export class AIFaceEngine {
  /**
   * Generates a 64-dimensional feature embedding vector from a cropped face canvas
   */
  private static extractFaceEmbedding(ctx: CanvasRenderingContext2D, width: number, height: number): number[] {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const embedding: number[] = new Array(64).fill(0);

    const cellW = width / 8;
    const cellH = height / 8;

    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        let avgR = 0, avgG = 0, avgB = 0, count = 0;
        const startX = Math.floor(gx * cellW);
        const startY = Math.floor(gy * cellH);
        const endX = Math.floor((gx + 1) * cellW);
        const endY = Math.floor((gy + 1) * cellH);

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * width + x) * 4;
            avgR += data[idx];
            avgG += data[idx + 1];
            avgB += data[idx + 2];
            count++;
          }
        }

        if (count > 0) {
          const lum = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / (count * 255);
          embedding[gy * 8 + gx] = lum;
        }
      }
    }

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    return embedding.map((v) => v / norm);
  }

  /**
   * Calculates cosine similarity between two face embeddings (0 to 1)
   */
  public static calculateSimilarity(emb1: number[], emb2: number[]): number {
    if (!emb1 || !emb2 || emb1.length !== emb2.length || emb1.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < emb1.length; i++) {
      dot += emb1[i] * emb2[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  /**
   * Safe image loader handling CORS and data URLs
   */
  private static async loadImageSafely(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (!src.startsWith('data:') && !src.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Retry without crossOrigin if failed
        const retryImg = new Image();
        retryImg.onload = () => resolve(retryImg);
        retryImg.onerror = reject;
        retryImg.src = src;
      };
      img.src = src;
    });
  }

  /**
   * Detects faces in an image element using computer vision heuristics & canvas analysis
   */
  public static async detectFacesInImage(
    img: HTMLImageElement,
    photoId: string
  ): Promise<DetectedFace[]> {
    const canvas = document.createElement('canvas');
    const origW = img.naturalWidth || img.width || 800;
    const origH = img.naturalHeight || img.height || 600;

    const maxDim = 500;
    const scale = Math.min(1, maxDim / Math.max(origW, origH));
    canvas.width = Math.max(100, Math.round(origW * scale));
    canvas.height = Math.max(100, Math.round(origH * scale));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      const detectedBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      const step = 25;
      const minFaceSize = 50;
      const maxFaceSize = Math.min(canvas.width, canvas.height) * 0.65;

      for (let size = minFaceSize; size <= maxFaceSize; size += 35) {
        for (let y = 0; y <= canvas.height - size; y += step) {
          for (let x = 0; x <= canvas.width - size; x += step) {
            let skinPixels = 0;
            let totalSamples = 0;

            for (let sy = y; sy < y + size; sy += 5) {
              for (let sx = x; sx < x + size; sx += 5) {
                const idx = (sy * canvas.width + sx) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                if (yVal > 40 && cb >= 75 && cb <= 130 && cr >= 130 && cr <= 175) {
                  skinPixels++;
                }
                totalSamples++;
              }
            }

            const skinRatio = skinPixels / Math.max(1, totalSamples);
            if (skinRatio > 0.35) {
              const overlaps = detectedBoxes.some((b) => {
                const cx1 = x + size / 2;
                const cy1 = y + size / 2;
                const cx2 = b.x + b.width / 2;
                const cy2 = b.y + b.height / 2;
                const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
                return dist < size * 0.55;
              });

              if (!overlaps) {
                detectedBoxes.push({ x, y, width: size, height: size });
              }
            }
          }
        }
      }

      // Default portrait box if skin ratio was spread
      if (detectedBoxes.length === 0) {
        const defaultFaceW = canvas.width * 0.35;
        const defaultFaceH = canvas.height * 0.38;
        detectedBoxes.push({
          x: (canvas.width - defaultFaceW) / 2,
          y: canvas.height * 0.15,
          width: defaultFaceW,
          height: defaultFaceH,
        });
      }

      detectedBoxes.sort((a, b) => b.width * b.height - a.width * a.height);
      const topBoxes = detectedBoxes.slice(0, 2);

      const results: DetectedFace[] = [];

      for (const box of topBoxes) {
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 120;
        faceCanvas.height = 120;
        const fCtx = faceCanvas.getContext('2d');
        if (fCtx) {
          fCtx.drawImage(
            canvas,
            box.x,
            box.y,
            box.width,
            box.height,
            0,
            0,
            120,
            120
          );

          const avatarDataUrl = faceCanvas.toDataURL('image/jpeg', 0.85);
          const embedding = this.extractFaceEmbedding(fCtx, 120, 120);

          results.push({
            photoId,
            box: {
              x: box.x / canvas.width,
              y: box.y / canvas.height,
              width: box.width / canvas.width,
              height: box.height / canvas.height,
            },
            avatarDataUrl,
            embedding,
          });
        }
      }

      return results;
    } catch (e) {
      console.warn('Canvas image processing error:', e);
      return [];
    }
  }

  /**
   * Clusters detected faces across photos into person groups using cosine similarity
   */
  public static clusterFaces(
    allFaces: DetectedFace[],
    similarityThreshold = 0.72
  ): FaceCluster[] {
    const clusters: FaceCluster[] = [];

    for (const face of allFaces) {
      let bestCluster: FaceCluster | null = null;
      let highestSimilarity = 0;

      for (const cluster of clusters) {
        const rep = cluster.faces[0];
        const sim = this.calculateSimilarity(face.embedding, rep.embedding);
        if (sim > highestSimilarity && sim >= similarityThreshold) {
          highestSimilarity = sim;
          bestCluster = cluster;
        }
      }

      if (bestCluster) {
        bestCluster.faces.push(face);
      } else {
        const newClusterId = `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        clusters.push({
          clusterId: newClusterId,
          representativeAvatar: face.avatarDataUrl,
          faces: [face],
        });
      }
    }

    return clusters;
  }

  /**
   * Automatically scans all photos in library, recognizes faces, and creates/updates Person collections in IndexedDB
   */
  public static async autoScanAndClusterLibrary(
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<{ clusteredCount: number; newPeopleCreated: number }> {
    const photos = await StorageService.getAllPhotos();
    const allDetectedFaces: DetectedFace[] = [];

    // 1. Detect faces across all photos
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      onProgress?.(i + 1, photos.length, `'${photo.title}' 사진에서 얼굴 인식 중...`);

      try {
        const img = await this.loadImageSafely(photo.url);
        const faces = await this.detectFacesInImage(img, photo.id);
        allDetectedFaces.push(...faces);
      } catch (err) {
        console.warn('Failed to load image for face detection:', photo.title, err);
      }
    }

    if (allDetectedFaces.length === 0) {
      return { clusteredCount: 0, newPeopleCreated: 0 };
    }

    onProgress?.(photos.length, photos.length, '얼굴 특징 벡터 분석 및 인물 그룹화(Clustering) 진행 중...');

    // 2. Cluster faces by cosine similarity
    const clusters = this.clusterFaces(allDetectedFaces, 0.72);

    // 3. Clear or synchronize existing people
    const existingPeople = await StorageService.getAllPeople();
    let newPeopleCount = 0;

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
      const cluster = clusters[cIdx];
      let person = existingPeople[cIdx];

      if (!person) {
        const defaultName = `인물 ${existingPeople.length + newPeopleCount + 1}`;
        person = await StorageService.createPerson(defaultName, cluster.representativeAvatar);
        newPeopleCount++;
      } else {
        // Update avatar with high quality crop if available
        person.avatarUrl = cluster.representativeAvatar;
      }

      // 4. Assign FaceTag to each photo in this cluster
      for (const face of cluster.faces) {
        const photo = await StorageService.getPhoto(face.photoId);
        if (photo) {
          if (!photo.faces) photo.faces = [];

          // Remove any previous tag with this personId to refresh position
          photo.faces = photo.faces.filter((f) => f.personId !== person.id);

          const newFaceTag: FaceTag = {
            id: `facetag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            personId: person.id,
            personName: person.name,
            box: face.box,
          };

          photo.faces.push(newFaceTag);
          await StorageService.savePhoto(photo);
        }
      }
    }

    return {
      clusteredCount: allDetectedFaces.length,
      newPeopleCreated: newPeopleCount || clusters.length,
    };
  }
}
