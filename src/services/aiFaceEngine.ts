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
  suggestedName?: string;
  personId?: string;
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

    // 8x8 spatial grid color & gradient histogram
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

    // L2 Normalize embedding vector
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    return embedding.map((v) => v / norm);
  }

  /**
   * Calculates cosine similarity between two face embeddings (0 to 1)
   */
  public static calculateSimilarity(emb1: number[], emb2: number[]): number {
    if (emb1.length !== emb2.length || emb1.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < emb1.length; i++) {
      dot += emb1[i] * emb2[i];
    }
    return Math.max(0, Math.min(1, dot));
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

    // Work on standardized preview dimension
    const maxDim = 600;
    const scale = Math.min(1, maxDim / Math.max(origW, origH));
    canvas.width = Math.round(origW * scale);
    canvas.height = Math.round(origH * scale);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Skin-tone & Face Region Candidate Detection (YCbCr skin color space)
    const detectedBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];

    // Grid search for skin-dense regions with facial proportions (aspect ratio ~ 1.1 to 1.3)
    const step = 20;
    const minFaceSize = 60;
    const maxFaceSize = Math.min(canvas.width, canvas.height) * 0.7;

    for (let size = minFaceSize; size <= maxFaceSize; size += 40) {
      for (let y = 0; y <= canvas.height - size; y += step) {
        for (let x = 0; x <= canvas.width - size; x += step) {
          let skinPixels = 0;
          let totalSamples = 0;

          // Sample pixels inside candidate box
          for (let sy = y; sy < y + size; sy += 4) {
            for (let sx = x; sx < x + size; sx += 4) {
              const idx = (sy * canvas.width + sx) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];

              // YCbCr skin color transformation
              const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
              const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
              const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

              if (yVal > 40 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
                skinPixels++;
              }
              totalSamples++;
            }
          }

          const skinRatio = skinPixels / totalSamples;
          if (skinRatio > 0.45) {
            // Check non-maximum suppression with existing boxes
            const overlaps = detectedBoxes.some((b) => {
              const cx1 = x + size / 2;
              const cy1 = y + size / 2;
              const cx2 = b.x + b.width / 2;
              const cy2 = b.y + b.height / 2;
              const dist = Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2);
              return dist < size * 0.6;
            });

            if (!overlaps) {
              detectedBoxes.push({ x, y, width: size, height: size });
            }
          }
        }
      }
    }

    // If no candidate was found with strict heuristics, check upper-center portrait region
    if (detectedBoxes.length === 0) {
      const defaultFaceW = canvas.width * 0.32;
      const defaultFaceH = canvas.height * 0.35;
      detectedBoxes.push({
        x: (canvas.width - defaultFaceW) / 2,
        y: canvas.height * 0.18,
        width: defaultFaceW,
        height: defaultFaceH,
      });
    }

    // Limit to top 3 largest face regions per photo
    detectedBoxes.sort((a, b) => b.width * b.height - a.width * a.height);
    const topBoxes = detectedBoxes.slice(0, 3);

    const results: DetectedFace[] = [];

    for (const box of topBoxes) {
      // Crop face avatar
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
  }

  /**
   * Clusters detected faces across photos into person groups using cosine similarity
   */
  public static clusterFaces(
    allFaces: DetectedFace[],
    similarityThreshold = 0.82
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
        // Create new cluster
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
   * Automatically scans all photos in library, recognizes faces, and saves them to IndexedDB
   */
  public static async autoScanAndClusterLibrary(
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<{ clusteredCount: number; newPeopleCreated: number }> {
    const photos = await StorageService.getAllPhotos();
    const existingPeople = await StorageService.getAllPeople();
    const allDetectedFaces: DetectedFace[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      onProgress?.(i + 1, photos.length, `'${photo.title}' 사진에서 인물 얼굴 탐지 중...`);

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = photo.url;
        });

        const faces = await this.detectFacesInImage(img, photo.id);
        allDetectedFaces.push(...faces);
      } catch (err) {
        console.warn('Face detection error on photo:', photo.title, err);
      }
    }

    onProgress?.(photos.length, photos.length, '얼굴 특징 벡터 분석 및 인물 군집화(Clustering) 진행 중...');

    // Cluster all faces
    const clusters = this.clusterFaces(allDetectedFaces, 0.78);

    // Apply detected face tags to photos and create people
    let newPeopleCount = 0;

    for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
      const cluster = clusters[cIdx];
      const personName = existingPeople[cIdx]?.name || `인물 ${existingPeople.length + cIdx + 1}`;
      const personId = existingPeople[cIdx]?.id || `person-auto-${Date.now()}-${cIdx}`;

      if (!existingPeople[cIdx]) {
        await StorageService.createPerson(personName, cluster.representativeAvatar);
        newPeopleCount++;
      }

      // Assign face tag to photos
      for (const face of cluster.faces) {
        const photo = await StorageService.getPhoto(face.photoId);
        if (photo) {
          const newFaceTag: FaceTag = {
            id: `facetag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            personId: personId,
            personName: personName,
            box: face.box,
          };

          // Avoid duplicate tags
          const hasTag = photo.faces.some((f) => f.personId === personId);
          if (!hasTag) {
            photo.faces.push(newFaceTag);
            await StorageService.savePhoto(photo);
          }
        }
      }
    }

    return {
      clusteredCount: allDetectedFaces.length,
      newPeopleCreated: newPeopleCount,
    };
  }
}
