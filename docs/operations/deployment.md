# 배포 — seremeety-web

## 1. 구성 요소

| 대상 | 도구 | 산출물/위치 |
|---|---|---|
| 웹 앱 | Next.js build | Firebase Hosting site `seremeety-kr` |
| 서버 로직 | Firebase Functions | region `asia-northeast3` |
| DB 규칙/인덱스 | Firestore | `firestore.rules`, `firestore.indexes.json` |

## 2. ⚠️ Hosting 빌드 산출물 불일치 (배포 전 반드시 확인)

`firebase.json`의 hosting 설정은 **정적 SPA** 가정이다.

```json
"hosting": {
  "public": "dist",
  "rewrites": [{ "source": "**", "destination": "/index.html" }],
  "site": "seremeety-kr"
}
```

그러나 현재 `next.config.mjs`에는 `output: 'export'`가 없어 `npm run build`는 `dist/`가 아니라 `.next/`를
생성하고 `index.html`도 만들지 않는다. 즉 **현 설정 그대로는 `firebase deploy --only hosting`이 빈/오래된
`dist/`를 올린다.** 배포 전 둘 중 하나로 정합성을 맞춰야 한다.

- **옵션 A — 정적 export 유지(현 hosting 설정과 일치):** `next.config.mjs`에 `output: 'export'`를 추가하고
  빌드 산출물을 `dist/`로 맞춘다(`distDir` 또는 export 후 복사). 단 App Router 정적 export는 동적 서버
  기능을 못 쓴다. 본 앱은 Firebase SDK 기반 클라이언트 렌더라 대체로 호환되지만, 동적 라우트
  (`profile/[uid]`, `chat-room/[chatRoomId]`)는 `generateStaticParams` 또는 클라이언트 처리로 정리 필요.
- **옵션 B — 서버 렌더 유지:** Firebase Hosting + Cloud Functions/Run로 Next 서버를 돌리거나 Vercel 등으로
  배포. 이 경우 `public: "dist"` + SPA rewrite 설정을 교체.

> 이 항목은 [status.md](../status.md)의 "실운영 전 남은 작업"에도 기재되어 있다. 결정 전에는 hosting 배포를
> 신뢰하지 말 것.

## 3. 배포 명령

```bash
# 1) Functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# 2) Firestore 규칙 / 인덱스
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# 3) 웹 (위 §2 정합성 확보 후)
npm run build
firebase deploy --only hosting:seremeety-kr
```

배포 전 검증:

```bash
npm run lint
npx tsc --noEmit
```

## 4. 롤백 / 로그

- Hosting: Firebase Console → Hosting → 릴리스 기록에서 이전 버전으로 롤백.
- Functions: `cd functions && npm run logs` (`firebase functions:log`).
- 비용 가드: 모든 Function은 `minInstances: 0`, `maxInstances: 5`, `timeoutSeconds: 30`, `memory: 256MiB`로
  잠겨 있다(`functions/src/index.ts`). 무한루프/retry 폭주 시 동시 실행 cap이 작동.
