# ARCHITECTURE.md — seremeety-web

> **문서 목적**: 이 프로젝트의 구조, 의사결정, 트레이드오프를 한 곳에 정리한 기술 요약. 코드 베이스가 변하면 이 문서도 같이 갱신한다.
>
> 관련 문서:
> - [`docs/README.md`](./README.md) — 전체 문서 목차
> - [`roadmap.md`](./roadmap.md) — 단계별 작업 계획 (Phase 1~11)
> - [`data-model.md`](./data-model.md) — 컬렉션·필드 정의 (현재 구현 기준)
> - [`tech-notes.md`](./tech-notes.md) — 기술 선택 근거 / 트레이드오프
> - [`status.md`](./status.md) — 현재 진행 상황 / 실운영 전 남은 작업
> - [`../CLAUDE.md`](../CLAUDE.md) — 코딩 컨벤션 / 문서 지도

---

## 1. 프로젝트 한 줄 요약

한국·일본 사용자 대상 모바일-web 데이팅 앱. 전화번호 인증 → 프로필/사진 작성 → 관리자 심사 → 추천 피드 → 좋아요 → 매칭 성립 → 1:1 채팅 → 프리미엄(mock) 결제로 일일 한도 상향. **Next.js App Router + Firebase (Auth / Firestore / Storage / Functions) + RTK Query** 기반 SPA.

목표는 "동작하는 학습용 데모"가 아니라 **운영 가능한 수준의 데이터 모델, 권한 경계, 검수 흐름**을 갖춘 풀스택 포트폴리오 — 실서비스에 가까운 코드/구조를 의도적으로 채택.

---

## 2. 기술 스택 + 선택 근거

| 영역 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **Next.js App Router** | 라우트 그룹 `(authenticated)`, `(admin)` 으로 권한 경계를 디렉토리 구조로 표현. 서버 컴포넌트는 정적 entry 정도만 활용하고 대부분 클라이언트 사이드 (Firebase SDK 가 클라이언트 의존이라 SSR 이점이 작음). |
| UI | **React + TypeScript + SCSS Modules** | UI 라이브러리(MUI / Tailwind 등) 없이 SCSS 모듈로 디자인 시스템 직접 빌드 — 토큰(`src/styles/base/variables.scss`) + 공용 컴포넌트(`shared/components/common/*`). 외부 의존성 최소. |
| 백엔드 | **Firebase 풀스택** (Auth / Firestore / Storage / Functions) | 서버 인프라 관리 부담 없이 권한 분리·실시간 구독·이벤트 처리·인증을 한 베이스에서 처리. RDB 가 어울리는 도메인은 아니라 NoSQL 단점이 덜 두드러짐. |
| 상태 관리 | **Redux Toolkit + RTK Query** | (§6 별도 항목) |
| Cloud Functions | **firebase-functions v2** (`onCall`) | 권한 검증·일일 한도·매칭 atomic write 등 client trust 가 위험한 로직 격리. `asia-northeast3` (서울) 리전 고정. |
| 결제 | **mock 결제 (Phase 9)** | 실 PG 연동 대신 서버측 entitlement 변경만 시뮬레이트 — 포트폴리오 범위 한정. |

### 의도적으로 *쓰지 않은* 것

- **UI 라이브러리(MUI/Chakra/shadcn) / Tailwind**: 디자인 토큰·접근성·hit-target 등을 직접 만지며 익히는 게 학습 목적.
- **별도 BaaS(SupaBase, Hasura) / 자체 백엔드(Express/Nest)**: 프로젝트 규모 대비 운영 부담만 늘어남.
- **react-select / react-tooltip / lodash 등 유틸 패키지**: 번들 크기 줄이고 native HTML / 직접 구현으로 대체 (Phase 7 — `chore(deps): drop 7 packages`).

---

## 3. 디렉토리 구조

```
src/
  app/                       # Next.js routes
    (admin)/admin/**         # 관리자 콘솔 — AdminRouteGate
    (authenticated)/**       # 로그인 후 접근 — AuthenticatedRouteGate
    page.tsx                 # 미인증 진입점 (AuthEntryPage)
  features/                  # 도메인 페이지 / UI 섹션
    auth/, onboarding/, matching/, likes/, chat/, profile/, admin/, ...
  shared/
    components/common/       # 공용 UI (Button / Select / CustomRadio / DatePicker / Modal ...)
    lib/
      api/                   # RTK Query slice 정의
      firebase/              # Firestore / Storage helper
      onboarding/            # 가입 흐름 보조 (resolveEntryRoute, transitionOnboardingStatus, ...)
      store/                 # Redux store + auth slice
    hooks/, providers/       # 공용 hook / route gate
    types/model/             # 도메인 타입 (User / Profile / Reaction / Match / ...)
  styles/                    # SCSS 토큰 + reset + 공용
functions/                   # Firebase Functions (server-side)
  src/reactions/react.ts     # 핵심 callable — like/pass/superLike + match 생성
  scripts/grant-admin.mjs    # 1회성 admin seed CLI
```

라우트 그룹으로 **권한 경계를 디렉토리로 표현** — `(admin)` 안의 모든 라우트는 [AdminRouteGate](../src/shared/providers/AdminRouteGate.tsx) 로 감싸고, `(authenticated)` 는 [AuthenticatedRouteGate](../src/shared/providers/AuthenticatedRouteGate.tsx) 가 onboarding 상태를 보고 적절한 step 으로 강제 리다이렉트.

---

## 4. 데이터 모델 핵심

상세는 [DATA_MODEL.md](./data-model.md). 컬렉션 분리 의도만 요약하면:

| 컬렉션 | 분리 이유 |
|---|---|
| `users` | 계정·운영 상태(`role`, `status`, `onboardingStatus`) — 상대에게 노출 X |
| `profiles` | 상대에게 보여줄 공개 프로필 — 승인 상태(`pending`/`approved`/`rejected`) 별도 |
| `preferences` | 매칭 선호 (나이대, 지역, 성별) — 상대에게 노출 X |
| `profilePhotos` | 다중 사진 (`MAX 6장`), 사진마다 자체 승인 상태 |
| `reactions` | 좋아요 / 패스 / 슈퍼좋아요 — server-only write |
| `matches` | 상호 좋아요 시 생성 — server-only write |
| `chatRooms` / `messages` | 매칭 후 1:1 채팅 (subcollection) |
| `blocks`, `reports` | 차단·신고 — 추천/매칭 흐름에 반드시 반영 |
| `entitlements`, `payments` | 일일 한도(`dailyLikeLimit` 등) + mock 결제 기록 |
| `consents` | 약관·개인정보 동의 이력 (legal trail) |
| `recommendationLogs` | 추천 노출 이력 — 같은 카드 재노출 방지 + KST 자정 기준 일일 한도 계산 |
| `identityVerifications` | 본인확인 상태 (현재 mock — 한국 KISA 본인확인 미연동) |

### 분리 원칙

1. **공개 vs 비공개 분리**: `profiles`(공개) ↔ `users`/`preferences`(비공개). 잘못된 read rule 하나로 PII 가 새지 않도록.
2. **승인 상태와 도메인 상태 분리**: `Profile.status='approved'` 와 `User.onboardingStatus='approved'` 는 별개 — 프로필은 통과해도 사용자가 정지될 수 있음.
3. **1:N 관계는 별도 컬렉션**: 사진은 사용자당 여러 장이라 `profilePhotos` 컬렉션으로. profile 도큐먼트에 array 로 우겨넣지 않음 (사진별 승인/순서 변경/삭제 트랜잭션 복잡해짐).
4. **서버-only 컬렉션**: `reactions`/`matches` 는 client write 금지. 클라이언트가 직접 매칭 생성 가능하면 한도/차단 우회 가능.

---

## 5. 핵심 흐름

### 5.1 가입 / 온보딩

```
Phone Auth
  ↓
/onboarding/bootstrap         (users/{uid} 문서 생성, role 확인)
  ↓ (role==='admin' → /admin)
/onboarding/profile           STEP 1 — profile 작성
  ↓
/onboarding/photos            STEP 2 — 메인 사진 업로드
  ↓
/onboarding/preferences       STEP 3 — 매칭 선호 (성별 자동 = 본인 반대)
  ↓
/onboarding/consent           STEP 4 — 약관 동의
  ↓
/onboarding/review-pending    STEP 5 — 관리자 심사 대기
  ↓ (admin 승인)
/matching                     추천 피드 진입
```

- `user.onboardingStatus` 가 single source of truth. 각 step "다음" 시점에 firestore 에 commit + RTK Query 캐시 optimistic patch 로 다음 페이지로 부드럽게 전이.
- 각 step 페이지에서 **이전 단계** / **로그아웃** / **가입 그만두기**(데이터 일괄 삭제) 가능.
- 반려 시 `RejectedPage` 가 사유 + "프로필 수정" / "사진 수정" 버튼 노출 → 사용자가 해당 step 만 다시 흘려 consent 까지 → 재제출.

### 5.2 추천 / 매칭

(`src/shared/lib/firebase/recommendations.ts` — `getTodayRecommendations`)

```
1) 사용자 entitlement / 오늘 노출 로그 / 본인 reactions / 후보 / 차단 양방향 — 병렬 fetch
2) 오늘 이미 노출된 카드는 그대로 유지 (reaction 한 카드도 뱃지/dim 표시)
3) 잔여 슬롯 = dailyRecommendationLimit - 오늘 노출 수
4) 신규 후보에서 (자기 자신 / 노출 이력 / reaction한 유저 / 양방향 차단) 제외
5) 셔플 후 잔여 슬롯만큼 picking → recommendationLogs 작성
6) Fallback: 신규 후보 0개 + 오늘 노출 0개 면 최근 노출 limit개 표시
```

- **KST 자정 기준** 일일 한도 ([`dailyLimits.ts`](../src/shared/lib/firebase/dailyLimits.ts))
- 점수 기반 정렬은 현재 미구현 — `score=0`, `reasonCodes=[]` 로만 기록 (후속 슬라이스에서 매칭 알고리즘 정교화 예정)
- 추천 풀이 작아도 같은 카드를 매일 다시 보여주지 않도록 `recommendationLogs` 가 영속 노출 이력 관리

### 5.3 좋아요 → 매칭 → 채팅

```
사용자 A: /matching 에서 사용자 B 카드에 좋아요 클릭
  ↓
Functions react onCall:
  - 인증 검증 (requireAuthedUser)
  - 차단 양방향 확인 → 차단이면 거부
  - 일일 한도 검증 (entitlement.dailyLikeLimit, KST 자정 기준 count)
  - reactions/{A_B} 작성 (deterministic ID = idempotent)
  - 상대 reaction 조회 → 양쪽 모두 like/superLike면 매칭 성립
  - batch: matches/{sortedPairId} + chatRooms/{sortedPairId} 동시 생성
  ↓
chatRooms 구독자(양 당사자) onSnapshot 으로 채팅방 즉시 표시
```

이 흐름은 **모두 server-side에서 atomic** — 클라이언트가 reaction 만 client-write 했던 이전 구조에선 한도 우회·blocked 무시·match 누락이 가능했음. Phase 3-A 에서 Functions 로 이전.

### 5.4 검수 (admin)

`/admin/profiles` 통합 검수 큐:
- pending profile + pending photo 보유 사용자를 사용자 단위로 묶은 카드
- 각 카드: 프로필 정보 + 모든 사진 (메인★, 상태 배지) + 사유 textarea + 승인/반려
- **승인 1번 클릭** → profile.status=approved + 그 사용자의 pending 사진 일괄 approved + onboardingStatus=approved + legacy profileStatus=1
- **반려** → profile.status=rejected (이미 approved 사용자면 reason 만 갱신) + onboardingStatus=review_rejected → 사용자 RejectedPage 노출

admin 본인은 큐에서 자동 제외 (`user.role==='admin'` 필터).

### 5.5 admin 부트스트랩

운영자 계정은 데이팅 프로필이 필요 없는 순수 관리자 — 일반 가입 흐름을 거치지 않는다. 다만 **최초의 admin 을 만들 사람이 없다**(chicken-and-egg) 는 문제를 풀어야 함. 일반적인 production 패턴 두 단계:

#### A. 최초 admin — Firebase Console 에서 1회 수동 set

1. **본인 폰으로 일반 가입 시작** — 평범하게 전화 인증. `/onboarding/profile` 화면까지만 도달하면 충분 (프로필 입력은 안 해도 됨). 이 시점에 Firebase 가 `users/{본인 uid}` 도큐먼트를 만들어둠.
2. **Firebase Console 진입** — [console.firebase.google.com](https://console.firebase.google.com) → 프로젝트 선택 → 좌측 메뉴 `Firestore Database` → `users` 컬렉션 → 본인 UID 도큐먼트.
3. **두 필드 수정**:
   - `role`: `user` → `admin` (필드가 없으면 새로 추가, 타입 `string`, 값 `admin`)
   - `onboardingStatus`: 현재 값 → `approved`
4. **앱에서 로그아웃 → 다시 로그인**: BootstrapPage 가 `role==='admin'` 감지 → onboarding 전체 스킵 → 곧장 `/admin` 진입.

> **왜 콘솔 직접 편집인가**: 첫 admin 은 권한을 부여해줄 다른 admin 이 존재하지 않음. Firebase Console 자체가 프로젝트 owner 인증으로 보호되므로 이미 검증된 채널. 대부분의 실서비스가 1회성 부트스트랩은 이렇게 처리 (Stripe / Sentry / Linear / 사내 어드민 다 동일).

#### B. 이후 admin — `/admin/users` 콘솔에서 부여

첫 admin 이 생긴 후엔 콘솔 UI 로 관리:
- `/admin/users` 페이지의 **"관리자 권한 부여 / 회수"** 섹션
- 대상 사용자의 UID (Firebase Auth 콘솔에서 복사) + `admin` 선택 → 적용
- 내부적으로 [setUserRole](../src/shared/lib/firebase/usersV2.ts) helper 가 `role='admin'` + `onboardingStatus='approved'` 같이 set → 다음 로그인 시 곧장 `/admin` 진입

#### C. 자동화 CLI (선택)

[`functions/scripts/grant-admin.mjs`](../functions/scripts/grant-admin.mjs) — Firebase Admin SDK 기반 1회성 스크립트. 대량 부여나 CI 자동화가 필요할 때만 사용:

```bash
cd functions
npm run grant-admin -- --phone +821012345678
npm run grant-admin -- --uid <firebase-auth-uid>
npm run grant-admin -- --uid <uid> --revoke   # 권한 회수
```

(인증: ADC — `gcloud auth application-default login` 또는 `GOOGLE_APPLICATION_CREDENTIALS` 가 service account JSON 을 가리켜야 함. firebase deploy 가 가능한 환경이면 이미 충족.)

CLI 는 자동화 옵션 — **1명만 부여할 땐 Console 이 더 빠름**.

---

## 6. 상태 관리 — RTK Query 도입 근거

### 왜 Redux Toolkit + RTK Query 인가

이전 구조(`useState` + `useEffect` + 직접 fetch)에서 누적된 문제:

1. **데이터 일관성**: 같은 데이터를 여러 페이지에서 fetch — invalidation 없이 stale data 끼리 어긋남. 예: `/onboarding/profile` 에서 profile 저장 후 `/onboarding/photos` 가 stale entryState 로 잘못된 step 으로 redirect.
2. **무한 로딩 / 무한 리다이렉트**: `useEffect` 의 fetch 가 의존성 변화로 재실행되면서 캐시 없는 상태에선 redirect ↔ refetch 사이클 발생.
3. **구독 누수**: Firestore `onSnapshot` 구독을 컴포넌트마다 mount/unmount 시 정리 — 한 곳에 모으는 abstraction 필요.

RTK Query 가 해결한 것:

| 문제 | RTK Query 사용법 |
|---|---|
| 중복 fetch 제거 | 같은 `endpoint(arg)` 호출은 자동 디듀프 + 캐시 공유 |
| 정확한 무효화 | `providesTags` / `invalidatesTags` 로 명시적 cache invalidation |
| 진행 중 / 에러 / 빈 상태 일관 처리 | `isLoading` / `isError` / `data` 셋만 보면 끝 |
| onSnapshot 구독 라이프사이클 | `onCacheEntryAdded` 훅으로 mount 시 구독, `cacheEntryRemoved` 에 정리 |
| 낙관적 업데이트 | `util.updateQueryData` 로 캐시 직접 patch → 다음 step 전이 깜빡임 없음 |

### 슬라이스 분리 기준

`src/shared/lib/api/` 아래에 도메인별 분리:

- `baseApi.ts` — tagTypes 등록 + `injectEndpoints` 사용을 위한 root
- `entryStateApi.ts` — onboarding 라우팅 결정용 통합 fetch (user + profile + preference + photos + consent)
- `recommendationApi.ts` / `reactionApi.ts` / `matchApi.ts` — 추천 피드 / 좋아요 / 매칭
- `chatApi.ts` — `onCacheEntryAdded` 로 Firestore `onSnapshot` 구독 wrapping
- `adminApi.ts` — admin 큐 + 권한 부여 / 정지 / 플랜 변경
- `paymentApi.ts` / `entitlementApi.ts` — mock 결제 + 일일 한도
- `blockApi.ts` / `reportApi.ts` / `photoApi.ts` / `profileApi.ts`

각 슬라이스는 Firebase helper (`shared/lib/firebase/*`) 를 wrapping — Firebase 직접 호출 패턴을 RTK Query 캐시로 통합하는 단일 진입점.

### 깜빡임 제거 — Optimistic patch

가입 흐름에서 가장 큰 UX 함정은 step 전환 시 cache invalidate + refetch 사이클의 깜빡임이었음. 해결:

```ts
// transitionOnboardingStatus.ts
await setOnboardingStatus(uid, next);  // Firestore commit
dispatch(
  entryStateApi.util.updateQueryData('getEntryState', undefined, (draft) => {
    if (draft.user) draft.user.onboardingStatus = next;
  })
);  // 캐시 즉시 patch — refetch 없이 다음 페이지 통과
```

---

## 7. Server boundary — Firebase Functions

**왜 일부만 Functions 로 옮겼는가**

- **Function = 신뢰가 필요한 로직**: 한도 검증, atomic write, 권한 변경
- **Firestore 직접 write = 그 외 일반 CRUD**: 프로필 작성, 사진 업로드, 약관 동의 등 (Security Rules 로 검증)

### 현재 Functions

| Endpoint | 역할 |
|---|---|
| `react` (callable) | 좋아요/패스/슈퍼좋아요 + 차단·한도 검증 + 매칭 생성 + chatRoom dual-write |

### 이전된 후 client 가 손대지 못하는 것

- `reactions/{id}` write — Firestore Rule 에서 `allow write: if false` (Functions 만 admin SDK 로 작성)
- `matches/{id}` write — 동일

### 아직 client write 가 허용된 컬렉션 (알려진 제약)

- `users`, `profiles`, `profilePhotos`, `preferences`, `consents`, `entitlements`, `payments`, `reports`, `blocks`, `chatRooms` — 인증된 사용자면 누구나 write 가능. **악의적 사용자가 self-promote / 다른 사용자 프로필 변조 가능**.
- ROADMAP Phase 3-B / 3-C 에서 collection 별로 좁힐 예정. 현재는 클라이언트 측 [AdminRouteGate](../src/shared/providers/AdminRouteGate.tsx) + admin role 체크가 임시 방어선.

---

## 8. 보안 / 권한 — 현재 상태 정직 정리

| 경계 | 상태 | 비고 |
|---|---|---|
| 라우트 가드 (`/admin/**`) | ✅ 클라이언트 측 | `role==='admin'` 이 아니면 `/matching` 으로 리다이렉트 |
| 가입 흐름 강제 (`/onboarding/*`) | ✅ | onboardingStatus 기반 정확한 step 으로 redirect |
| Firestore write 권한 | ⚠️ 인증만 검증 | Phase 3-B 에서 collection 별 좁힐 예정 |
| 일일 한도 / 차단 검증 | ✅ Server-side (Functions) | react onCall 에서 검증 |
| 매칭 생성 | ✅ Server-side | client trust 제거 |
| PII 보호 | ⚠️ | preferences/consents 도 인증된 임의 사용자가 read 가능. Phase 3-B에서 path-level rule 로 self-only 제한 예정 |

**라이브 서비스 노출은 Phase 3-B 종료 전엔 비권장**. 포트폴리오 데모로는 동작 검증 충분.

---

## 9. 의도적 트레이드오프 / 알려진 제약

### legacy bridge

`writeProfileToLegacyUser`, `writePhotoToLegacyUser`, `writeProfileStatusToLegacyUser`, `writeMatchToLegacyChatRoom` — Phase 2-C 에서 새 컬렉션(`profiles` / `profilePhotos` / `matches`) 으로 데이터 모델을 갈아엎으면서, **이전 페이지(매칭 추천 / 채팅 리스트 / 채팅방 / 마이페이지 / 어드민)** 가 여전히 옛 `users/{uid}` 한 문서에서 닉네임·사진·프로필상태를 읽고 있어 도입한 dual-write 어댑터. 다음 슬라이스에서 reader 들을 새 컬렉션 기반으로 마이그레이션하면 폐기 예정.

### 매칭 점수

현재 추천 점수는 `score=0`, `reasonCodes=[]` 만 기록 — 단순 셔플. 후속 슬라이스에서 가중치(나이 거리 / 지역 일치 / 공통 태그) 계산 + reasonCodes 기록 예정. 데이터 모델(`recommendationLogs.score`, `reasonCodes`) 은 이를 미리 수용.

### 본인확인

`identityVerifications` 컬렉션은 schema 만 있고 실 KISA 본인확인 미연동 (Phase 11 이후). 현재는 mock — 모든 사용자가 verified=true.

### 결제

`paymentApi.completeMock` 으로 entitlement 만 직접 갱신. 실 PG (Stripe / KakaoPay / Toss) 연동은 Phase 9 mock 이후 별도 작업. 결제 기록 자체는 `payments` 컬렉션에 남기지만 실제 거래는 발생하지 않음.

### chatRooms 컬렉션 ID

매칭 ID 와 동일 (`sortedUids.join('_')`). `match_id === chatRoom_id` 라 별도 매핑 불필요. 채팅방의 `lastMessage.sentAt` 은 매칭 생성 시점에 초기화되어 채팅 목록 정렬에 즉시 반영.

---

## 10. 라우팅 / Route Gate 구조

```
/                                     AuthEntryPage          (미인증 진입점)
├ (authenticated)/                    AuthenticatedRouteGate (onboardingStatus 기반 강제 redirect)
│  ├ (bottom-nav)/
│  │  ├ matching                       추천 피드
│  │  ├ likes                          보낸/받은 좋아요
│  │  ├ chat-list                      매칭 채팅 목록
│  │  └ mypage                         마이페이지
│  └ (detail)/
│     ├ chat/[id]                      개별 채팅방
│     ├ profile/[uid]                  타인 프로필 상세
│     ├ my-profile                     내 프로필 편집
│     ├ plan                           프리미엄 (mock 결제)
│     ├ setting                        설정
│     └ onboarding/{bootstrap,profile,photos,preferences,consent,review-pending,rejected}
└ (admin)/admin/                       AdminRouteGate         (role==='admin' 만 통과)
   ├ /                                  대시보드
   ├ /profiles                          통합 검수 큐
   ├ /photos                            사진 단건 검수 (nav 노출 X)
   ├ /reports                           신고 처리
   └ /users                             사용자 정지/복구 / 권한 부여 / 플랜 변경
```

[AuthSync](../src/shared/providers/AuthSync.tsx) 가 Firebase auth 상태를 Redux `authSlice` 로 흘려보내고, RTK Query 의 invalidation tag 를 트리거. RouteGate 들이 `selectAuthUid` / `selectAuthRole` / `useEntryState` 를 보고 액세스 통제.

---

## 11. 다음 마일스톤

- **Phase 3-B**: `payments.mockComplete` 등 결제 mock 흐름을 Functions 로 이전 + Firestore Rules collection 별 좁히기.
- **Phase 3-C**: admin role 검증을 Functions / Custom Claims 로 이전, client 측 가드는 UX 안내만 담당.
- **legacy bridge 제거**: matching / chat / mypage / profile / admin 리더를 새 컬렉션 기반으로 마이그레이션.
- **매칭 점수**: nearest neighbor 휴리스틱 + 사용자 선호 가중치 도입, `score` / `reasonCodes` 기록.
- **Phase 10**: 디자인 / 브랜딩 / 모션 폴리싱.

---

*Last updated: 코드 베이스가 변하면 이 문서도 같이 갱신한다. 작성 기준 시점의 핵심 의사결정만 담음 — 변경 이력은 git log 참조.*
