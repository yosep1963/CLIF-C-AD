# CLIF-C AD 점수 계산기 - Netlify 배포 가이드

## 배포 방법

### 방법 1: Netlify 드래그 앤 드롭 (가장 쉬움)

1. **Netlify 접속**: https://app.netlify.com 에 접속하여 로그인
2. **드래그 앤 드롭**: 이 `dist` 폴더 전체를 Netlify 대시보드의 배포 영역으로 드래그
3. **완료**: 자동으로 배포되고 URL이 생성됩니다

### 방법 2: GitHub 연동 (자동 업데이트용)

1. **GitHub 저장소 생성**: 이 `dist` 폴더의 내용을 GitHub 저장소에 push
2. **Netlify 연동**: Netlify에서 "Import from Git" 선택
3. **설정**:
   - Build command: `npm run build`
   - Publish directory: `.`
4. **배포**: 자동으로 빌드 및 배포

---

## 스마트폰에서 PWA 설치하기

### iPhone (Safari)

1. Safari에서 배포된 사이트 열기
2. 하단의 **공유 버튼** (⎋) 탭
3. **"홈 화면에 추가"** 선택
4. **"추가"** 탭
5. 홈 화면에서 앱처럼 실행!

### Android (Chrome)

1. Chrome에서 배포된 사이트 열기
2. 하단에 **"설치"** 배너가 자동 표시됨
3. **"설치"** 버튼 탭
4. 또는: 메뉴 (⋮) → **"앱 설치"** 또는 **"홈 화면에 추가"**
5. 홈 화면에서 앱처럼 실행!

---

## 폴더 구조

```
dist/
├── index.html          # 메인 페이지 (CSS/JS 포함)
├── manifest.json       # PWA 매니페스트
├── sw.js              # Service Worker (오프라인 지원)
├── netlify.toml       # Netlify 설정
├── package.json       # 빌드 설정
├── generate-icons.js  # 아이콘 생성 스크립트
└── icons/             # PWA 아이콘들
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png   # iPad
    ├── icon-167.png   # iPad Pro
    ├── icon-180.png   # iPhone
    ├── icon-192.png   # Android
    ├── icon-512.png   # Android splash
    ├── icon-maskable-192.png
    └── icon-maskable-512.png
```

---

## PWA 기능

- ✅ **오프라인 사용**: 인터넷 없이도 작동
- ✅ **홈 화면 설치**: 앱처럼 설치 가능
- ✅ **전체 화면**: 브라우저 UI 없이 실행
- ✅ **빠른 로딩**: 캐시 우선 전략
- ✅ **자동 업데이트**: 새 버전 자동 감지

---

## 문제 해결

### PWA가 설치되지 않음
- HTTPS로 접속했는지 확인 (Netlify는 자동 HTTPS 제공)
- 브라우저 캐시 삭제 후 재시도

### 아이콘이 보이지 않음
- `npm run build`로 아이콘 재생성
- icons 폴더가 배포에 포함되었는지 확인

### 오프라인에서 작동 안 함
- Service Worker가 등록되었는지 확인
- 브라우저 개발자 도구 → Application → Service Workers

---

## 앱 정보

- **이름**: CLIF-C AD 점수 계산기
- **버전**: 1.0.0
- **목적**: ACLF가 없는 만성 간경변 환자의 사망 위험 예측
