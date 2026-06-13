# Firebase 세팅 — seremeety-web

이 프로젝트는 **백엔드만 Firebase**(Auth / Firestore / Storage / Functions)를 쓴다. 웹 앱은 Vercel로
배포한다([deployment.md](./deployment.md)). 새 환경(또는 새 개발자)에서 처음 띄울 때 필요한 설정을 정리한다.

## 1. 프로젝트 식별자

- Firebase 프로젝트(`.firebaserc` default): `seremeety-web`
- Functions region: `asia-northeast3`(서울) — `functions/src/index.ts`의 `setGlobalOptions`에서 고정
- Functions runtime: `nodejs22`(`firebase.json`)

## 2. 활성화해야 할 서비스

1. **Authentication → Phone** 로그인 제공자 활성화. 테스트 번호를 등록하면 SMS 비용 없이 개발 가능.
2. **Firestore Database** 생성(프로덕션 모드). 규칙은 레포의 `firestore.rules`로 배포.
3. **Storage** 버킷 생성(프로필 사진 업로드). `next.config.mjs`의 `images.remotePatterns`가
   `firebasestorage.googleapis.com`을 허용하도록 이미 설정됨.
4. **Functions**(Blaze 요금제 필요). region `asia-northeast3`, runtime `nodejs22`.

> Hosting은 사용하지 않는다(웹은 Vercel). `firebase deploy`는 functions / firestore만 대상으로 한다.

## 3. Firestore 규칙 / 인덱스

- 규칙: [`firestore.rules`](../../firestore.rules) — Phase 3-B 적용. `reactions`/`matches`/`payments`는
  server-only write, `entitlements` update는 admin-only, 사적 컬렉션 read는 self/admin, 권한 상승 필드는
  self write 차단. 상세는 [functions-security §4.1](../domains/functions-security.md).
- 인덱스: [`firestore.indexes.json`](../../firestore.indexes.json) — 복합 인덱스 3개
  - `reactions` (`fromUserId`, `type`, `createdAt`) — 일일 한도 count 쿼리용
  - `chatRooms` (`users` array-contains, `lastMessage.sentAt` desc) — 채팅 목록 정렬용
  - `consents` (`userId`, `agreedAt` desc) — 최신 동의 이력 조회용

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 4. 최초 관리자 부트스트랩

첫 admin을 만들 다른 admin이 없는 chicken-and-egg 문제는 1회성 콘솔 편집 또는 CLI로 푼다. 상세 절차는
[admin 도메인 문서](../domains/admin.md)와 [architecture.md §5.5](../architecture.md) 참조. 요약:

1. 본인 폰으로 일반 가입을 시작해 `users/{uid}` 문서를 만든다.
2. Firebase Console → Firestore → `users/{본인 uid}`에서 `role: admin`, `onboardingStatus: approved`로 수정.
3. 로그아웃 후 재로그인 → `/admin` 진입.

또는 CLI:

```bash
cd functions
npm run grant-admin -- --phone +821012345678
npm run grant-admin -- --uid <firebase-auth-uid>
npm run grant-admin -- --uid <uid> --revoke
```

## 5. 로컬 실행

```bash
npm install
# .env.local에 NEXT_PUBLIC_FIREBASE_* 채우기 (docs/operations/env.md)
npm run dev          # http://localhost:3000
```

Functions 로컬 빌드/배포:

```bash
cd functions
npm install
npm run build        # tsc → lib/
npm run deploy       # firebase deploy --only functions
npm run logs         # functions 로그
```
