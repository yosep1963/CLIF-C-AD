# CLIF-C AD 점수 계산기

ACLF가 없는 급성 비대상성 간경변 입원 환자의 사망 위험을 예측하는 PWA입니다 (Jalan R, et al. J Hepatol 2015;62:831-40).

- CLIF-C AD 점수, 위험군(45 이하 / 45 초과~60 미만 / 60 이상), 90일·1년 예측 사망률 (EF CLIF 공식 계산기와 같은 계산식)
- 입력값이 ACLF 기준(Cr ≥2.0, 또는 INR ≥2.5 + Cr 1.5–1.9)에 해당하면 안내하고 예측 사망률은 표시하지 않음
- 최근 5개 기록 저장 (현재 기준으로 다시 계산해서 표시), 결과 공유·복사, 오프라인 사용, 홈 화면 설치

## 배포 (Netlify)

```bash
npm run build
```

만들어진 `dist/` 폴더를 Netlify 대시보드에 끌어다 놓습니다. GitHub 연동 배포는 `netlify.toml` 설정(빌드 `node scripts/build.js`, 배포 폴더 `dist`)을 그대로 씁니다.

새 버전을 낼 때는 `package.json`의 `version`을 올리고 다시 빌드합니다. 이미 설치해 쓰는 사용자는 앱을 두 번째 열 때 새 버전으로 바뀝니다.

## 테스트

```bash
npm test
```

## 폴더 구조

```
public/           배포 폴더에 그대로 들어가는 파일 (index.html, manifest.json, service-worker.js, sw.js, _headers, _redirects, icons/)
src/              calculator.js (계산 로직), app.js (화면), styles.css → dist/src/로 복사
scripts/build.js  배포 폴더(dist) 만들기
tests/            node --test 테스트
```

## 스마트폰에 설치

- iPhone (Safari): 공유 버튼 → "홈 화면에 추가"
- Android (Chrome): 화면 아래 "설치" 배너, 또는 메뉴(⋮) → "앱 설치"
