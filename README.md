# 📸 Picasa Web (Google Picasa Modern Reimagining)

구글의 전설적인 데스크톱 사진 관리 및 편집 소프트웨어 **Picasa**의 고유한 감성과 핵심 기능들을 최신 웹 기술로 완벽히 재현한 모던 웹 애플리케이션입니다.

![Picasa Web Banner](https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80)

---

## ✨ 핵심 기능 (Key Features)

### 1. 🖼️ Picasa 시그니처 갤러리 (Signature Gallery)
- **실시간 썸네일 줌 슬라이더 (Thumbnail Zoom Slider)**: 하단 슬라이더로 120px 극소형 썸네일부터 460px 대형 프리뷰 카드까지 실시간 줌 조절
- **계층형 네비게이션**:
  - 📁 **폴더/타임라인**: 연도/월별 및 폴더별 그룹화와 일괄 선택
  - ⭐ **즐겨찾기 (Starred)**: 원클릭 스타 토글 및 즐겨찾기 모아보기
  - 👥 **인물 (People)**: 얼굴 인식 기반 인물별 사진 갤러리
  - 🏷️ **태그 및 색상 필터**: 태그 및 실시간 키워드 검색 (`⌘K` 지원)
- **로컬 사진/폴더 가져오기 (Import)**: 드래그 앤 드롭 또는 디렉토리 선택으로 브라우저 IndexedDB에 영구 보관

### 2. 🪄 3단계 Picasa 편집 스튜디오 (Edit Suite)
- **Tab 1: 기본 수정 (Basic Fixes)**
  - 🌟 **I'm Feeling Lucky!**: 1-클릭 자동 노출/대비/색상 밸런스 최적화
  - ☀️ **자동 대비 (Auto Contrast)** & 🎨 **자동 색상 (Auto Color)**
  - 🧭 **수평 맞추기 (Straighten)**: -45° ~ +45° 미세 각도 조절 및 90° 회전, 상하/좌우 반전
  - 📐 **자르기 (Crop)**: 1:1, 4:3, 16:9, 3:2, 원본 비율 프리셋
- **Tab 2: 튜닝 및 색상 (Tuning)**
  - 💡 **필 라이트 (Fill Light)**: Picasa 특유의 그림자 디테일 복원 슬라이더
  - 밝기, 대비, 채도, 색온도(Warm/Cool), 틴트, 하이라이트, 섀도우 정밀 조절
- **Tab 3: 특수 효과 및 필터 (Creative Effects)**
  - 흑백(B&W), 세피아(Sepia), 웜톤(Warmify), 비네트(Vignette), 필름 그레인(Film Grain), 로모(Lomo), 1960년대 빈티지, 소프트 포커스(Orton Glow), 시네마 틸&오렌지, 포스터라이즈, 틸트시프트(Tilt-Shift)
- **Before / After 실시간 분할 비교 슬라이더**
- **Undo / Redo 실행 취소 및 고해상도 이미지 내보내기 (Export)**

### 3. 🎨 콜라주 메이커 (Collage Creator)
- **사진 더미 (Picture Pile)**: 자유롭게 캔버스 위에서 사진을 드래그, 회전(각도 조절), 레이어 순서 변경, 더미 뒤섞기(Shuffle)
- **격자 모자이크 (Grid)**: 간격 조절 및 자동 배치
- **PNG 고화질 콜라주 저장 및 다운로드**

### 4. 📽️ 시네마틱 라이트박스 & 슬라이드쇼
- 전체화면 감상 및 키보드 조작 (좌우 방향키, Esc, E 키로 편집기 바로가기)
- 조리개, 셔터스피드, ISO 감도, 렌즈 정보, GPS 위치가 포함된 **EXIF 정보 패널**
- 타이머 프로그레스 바가 탑재된 **자동 슬라이드쇼**

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS (Picasa Graphite Dark Theme, Glassmorphism, Google Palette)
- **Icons**: Lucide React
- **Image Engine**: HTML5 Canvas 2D & WebGL Filter Pipeline (60fps 실시간 렌더링)
- **Storage**: Browser IndexedDB (영구 로컬 스토리지)

---

## 🚀 실행 방법 (Getting Started)

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행
npm run dev

# 3. 브라우저에서 열기
# http://localhost:5173/ 접속
```

---

## 📄 라이선스
MIT License
