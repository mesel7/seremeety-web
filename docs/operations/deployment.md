# 배포 — seremeety-web

## 1. 구성 요소

| 대상 | 도구 | 비고 |
|---|---|---|
| 웹 앱 (Next.js) | **Vercel** | GitHub `main` push 시 자동 배포 |
| 서버 로직 | **Firebase Functions** | region `asia-northeast3`, runtime `nodejs22` (2nd Gen) |
| DB 규칙/인덱스 | **Firestore** | `firestore.rules`, `firestore.indexes.json` |

> Firebase Hosting은 사용하지 않는다(과거 구 SPA에서 쓰던 설정은 제거됨). 웹은 Vercel, 백엔드만 Firebase.

## 2. 웹 앱 (Vercel)

- `main`에 push하면 Vercel이 자동으로 `next build` → 배포한다. 별도 수동 명령이 필요 없다.
- 환경변수(`NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_SITE_URL`)는 Vercel 프로젝트 설정에 등록한다([env.md](./env.md)).
- 동적 라우트(`profile/[uid]`, `chat-room/[chatRoomId]`)는 Vercel의 Next.js 런타임에서 그대로 동작한다.

## 3. 백엔드 (Firebase)

```bash
# Functions (predeploy가 tsc 빌드 수행)
firebase deploy --only functions

# Firestore 규칙 / 인덱스
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# 한 번에
firebase deploy --only functions,firestore:rules,firestore:indexes
```

- 프로젝트: `seremeety-web` (`.firebaserc` default). 로그인은 `firebase login`.
- **규칙과 함수를 함께 바꿀 때는 같이 배포한다.** 예: 결제 규칙이 client write를 막는데 결제 Functions가
  없으면 흐름이 깨진다 — 항상 `functions,firestore:rules`를 함께 deploy.

배포 전 검증:

```bash
npm run lint
npx tsc --noEmit
cd functions && npm run build   # functions tsc
```

## 4. 롤백 / 로그 / 비용 가드

- 웹: Vercel 대시보드에서 이전 배포로 즉시 롤백(Instant Rollback).
- Functions: `cd functions && npm run logs` (`firebase functions:log`).
- 비용 가드: 모든 Function은 `minInstances: 0`, `maxInstances: 5`, `timeoutSeconds: 30`, `memory: 256MiB`로
  잠겨 있다(`functions/src/index.ts`).

## 5. 런타임 / 패키지 유지보수

- Functions runtime: `nodejs22`(`firebase.json` + `functions/package.json` `engines.node`).
- `firebase-functions@7` / `firebase-admin@13` 사용. 두 패키지는 peer 호환 범위가 묶여 있다
  (functions@7 ↔ admin `^11||^12||^13`, **admin@14는 비호환**). 업그레이드 시 쌍을 맞춘다.
