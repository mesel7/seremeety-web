# 상태관리 (Redux Toolkit / RTK Query) — seremeety-web

> **한 줄 요약**: 단일 Redux store 위에 `authSlice`(직렬화 가능한 인증 메타)와 `baseApi`(RTK Query) 하나만 둔다. 서버 상태는 모두 `baseApi.injectEndpoints`로 주입한 도메인별 API slice가 `fakeBaseQuery` + `queryFn`으로 Firebase를 직접 호출하며, `providesTags`/`invalidatesTags`로 캐시 일관성을, `onCacheEntryAdded`로 Firestore `onSnapshot` 구독을, `updateQueryData`로 낙관적 patch를 처리한다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / §6 RTK Query 도입 근거 / §7 Functions 경계
> - [`roadmap.md`](../roadmap.md) — Phase 6(RTK Query 전환), Phase 3(Functions 이전)
> - 형제 도메인: [`auth-onboarding.md`](./auth-onboarding.md) · [`chat.md`](./chat.md)

---

## 1. 개요

상태관리 도메인은 두 종류의 상태를 명확히 분리한다.

| 상태 종류 | 보관 위치 | 비고 |
|---|---|---|
| 인증 메타 (client state) | `authSlice` (Redux slice) | `uid` / `role` + 2단계 로딩 플래그 |
| 서버 데이터 (server state) | `baseApi` (RTK Query 캐시) | 모든 Firestore/Storage/Functions 호출 |
| UI 로컬 상태 | 각 컴포넌트 `useState` | store 승격 없음 (CLAUDE.md §5) |

핵심 설계 원칙은 다음과 같다.

- store에는 `auth` slice 하나와 `api`(=`baseApi`) reducer 하나만 둔다. 도메인별 상태를 별도 slice로 늘리지 않고, 서버 데이터는 전부 RTK Query 캐시에 모은다.
- Firebase auth는 `onAuthStateChanged` 구독 stream이고 `User` 객체는 메서드를 가진 클래스라 직렬화가 불가능하다. 따라서 `authSlice`에는 직렬화 가능한 메타(`uid` + `role` + 로딩 플래그)만 보관하고, `getIdToken` 같은 메서드가 필요한 곳은 모듈 글로벌 `auth.currentUser`를 직접 참조한다.
- 각 API slice의 `queryFn`은 옵션 A에 따라 `src/shared/lib/firebase/*` 헬퍼를 직접 호출한다. Functions 이전 시 `queryFn` 본체만 callable 호출로 교체하면 컴포넌트는 손대지 않는다(현재 `react`만 이전됨).

---

## 2. 핵심 흐름

### 2.1 인증 동기화 (Firebase auth → Redux)

[`AuthSync`](../../src/shared/providers/AuthSync.tsx)는 context를 제공하지 않고 effect만 실행하는 side-effect-only 컴포넌트다. `children`을 그대로 통과시킨다.

```
auth.onAuthStateChanged
  → setAuthInitializing(true)
  → (user 있음) setAuthUid(uid) · setAuthReady(false)
      → getUserDataByUid → 신규면 setNewUserData
      → getUserV2ByUid → v2 없으면 grandfatherExistingUser → setAuthRole(role)
      → finally setAuthReady(true)
  → (user 없음) setAuthUid(null)   // role/isReady 자동 리셋
  → setAuthInitializing(false)
  → baseApi.util.invalidateTags([...사용자 종속 태그])
```

로그인/로그아웃 양쪽에서 `Me` / `EntryState` / `Message` / `Recommendation` / `Reaction` / `Match` / `Block` / `Entitlement` / `Photo` 태그를 무효화해, RTK Query가 새 `uid` 기준으로 재페치·재구독하도록 강제한다.

### 2.2 서버 데이터 읽기/쓰기 (RTK Query)

컴포넌트는 slice가 생성해 export한 `useXxxQuery` / `useXxxMutation` 훅만 사용하고, `isLoading` / `isError` / `data` 세 값으로 모든 상태를 일관 처리한다. `queryFn`은 성공 시 `{ data }`, 실패 시 `{ error: SerializedError }`를 반환한다. RTK Query store에 들어가는 error는 plain serializable object여야 하므로 `serializeError`/`errorWithCode`로 정규화한 뒤 반환한다.

### 2.3 라우트 게이팅 (selector 기반)

[`AuthenticatedRouteGate`](../../src/shared/providers/AuthenticatedRouteGate.tsx)와 [`AdminRouteGate`](../../src/shared/providers/AdminRouteGate.tsx)는 store selector로 접근을 통제한다.

- 보호 라우트: `selectAuthUid` + `useEntryState`(=`getEntryState` 쿼리)로 진입점 계산 후 게이트.
- admin 라우트: `selectAuthUid` + `selectAuthRole === 'admin'` 둘 다 만족해야 통과.

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`store/store.ts`](../../src/shared/lib/store/store.ts) | `configureStore` — `api`(baseApi) + `auth` reducer, baseApi.middleware 연결, `setupListeners`로 refetchOnFocus/Reconnect 활성화 |
| [`store/authSlice.ts`](../../src/shared/lib/store/authSlice.ts) | 직렬화 가능한 인증 메타 slice + selector (`selectAuthUid` / `selectAuthRole` / `selectIsAdmin` / `selectIsAuthLoading` / `selectIsAuthenticated`) |
| [`store/hooks.ts`](../../src/shared/lib/store/hooks.ts) | 타입 연결된 `useAppDispatch` / `useAppSelector` (컴포넌트는 raw `useDispatch`/`useSelector` 대신 이걸 사용) |
| [`api/baseApi.ts`](../../src/shared/lib/api/baseApi.ts) | `createApi` + `fakeBaseQuery<SerializedError>()`, `tagTypes` 등록 root. 모든 slice가 `injectEndpoints`로 확장 |
| [`api/serializeError.ts`](../../src/shared/lib/api/serializeError.ts) | `serializeError(error)`(catch 정규화) / `errorWithCode(code)`(사전 검증 실패) |
| [`api/entryStateApi.ts`](../../src/shared/lib/api/entryStateApi.ts) | onboarding 라우팅용 통합 fetch (user v2 + profile + preference + photos + consent) → `EntryState` 태그 |
| [`api/profileApi.ts`](../../src/shared/lib/api/profileApi.ts) | `getMe` / `getPublicProfile` / `updateMe` — `keepUnusedDataFor` 튜닝, mutation 시 `Me`+`Recommendation` 무효화 |
| [`api/reactionApi.ts`](../../src/shared/lib/api/reactionApi.ts) | `react` mutation(Functions callable) + `onQueryStarted` 낙관적 patch / undo |
| [`api/chatApi.ts`](../../src/shared/lib/api/chatApi.ts) | `onCacheEntryAdded`로 Firestore `onSnapshot` 구독 wrapping (`getChatRooms` / `getChatRoomMessages`) |
| [`api/adminApi.ts`](../../src/shared/lib/api/adminApi.ts) | admin 큐·권한·정지·플랜 (slice당 최다 14개 훅) |
| [`api/blockApi.ts`](../../src/shared/lib/api/blockApi.ts) · [`reportApi.ts`](../../src/shared/lib/api/reportApi.ts) · [`photoApi.ts`](../../src/shared/lib/api/photoApi.ts) · [`matchApi.ts`](../../src/shared/lib/api/matchApi.ts) · [`recommendationApi.ts`](../../src/shared/lib/api/recommendationApi.ts) · [`entitlementApi.ts`](../../src/shared/lib/api/entitlementApi.ts) · [`paymentApi.ts`](../../src/shared/lib/api/paymentApi.ts) | 도메인별 endpoint 주입 |
| [`providers/AppProviders.tsx`](../../src/shared/providers/AppProviders.tsx) | `'use client'` 경계 — `ReduxProvider`로 store 주입 후 `AuthSync` 래핑 |
| [`providers/AuthSync.tsx`](../../src/shared/providers/AuthSync.tsx) | auth 구독 → authSlice 동기화 + 사용자 종속 캐시 무효화 |
| [`hooks/useEntryState.ts`](../../src/shared/hooks/useEntryState.ts) | `getEntryState` 쿼리 wrapper + 계정 전환 시 stale 캐시 가드 |
| [`onboarding/transitionOnboardingStatus.ts`](../../src/shared/lib/onboarding/transitionOnboardingStatus.ts) | Firestore commit 후 `entryState` 캐시 `onboardingStatus` 한 줄 patch (깜빡임 제거) |

---

## 4. 데이터·상태

### 4.1 `authSlice` 상태

```ts
interface AuthState {
  uid: string | null;
  role: UserRole | null;
  isInitializing: boolean; // onAuthStateChanged 첫 콜백 전
  isReady: boolean;        // user doc / v2 부트스트랩 완료
}
```

2단계 로딩 플래그로 파생 selector를 만든다.

- `selectIsAuthLoading` = `isInitializing` 이거나 (`uid !== null` && `!isReady`) — 즉 초기화 전이거나, 로그인됐는데 부트스트랩이 안 끝난 상태.
- `selectIsAuthenticated` = `!isInitializing` && `uid !== null` && `isReady` — 인증 + 부트스트랩 모두 완료.

`setAuthUid(null)` 한 번에 `isReady`/`role`이 리셋되어 로그아웃 시 잔여 권한이 남지 않는다.

### 4.2 RTK Query 캐시 태그

`baseApi.tagTypes`에 18개 태그가 등록되어 있다: `Me`, `EntryState`, `Onboarding`, `Profile`, `Preference`, `Photo`, `Recommendation`, `Reaction`, `SentLikes`, `ReceivedLikes`, `Match`, `Message`, `Block`, `Report`, `IdentityVerification`, `Entitlement`, `Payment`, `AdminReview`. 쿼리는 `providesTags`로 태그를 부여하고 mutation은 `invalidatesTags`로 연쇄 무효화한다. 예: `updateMe`는 `['Me', 'Recommendation']`을 무효화해 첫 프로필 저장 시(profileStatus 0→1) 추천 후보가 새로 노출되게 한다.

### 4.3 캐시 신선도 정책

| 패턴 | 사용 위치 | 의도 |
|---|---|---|
| `keepUnusedDataFor: 120` | `getMe` | 자주 진입하나 mutation 시 invalidate되므로 길게 유지 |
| `keepUnusedDataFor: 300` | `getPublicProfile` | 타 사용자 프로필은 잘 안 바뀜 |
| `refetchOnMountOrArgChange: 30` | 호출부(예: 마이페이지)에서 훅 옵션으로 직접 지정 | 신선도가 중요한 화면만 강제 재페치 |
| `setupListeners` | store 전역 | refetchOnFocus / refetchOnReconnect 자동화 |

### 4.4 직렬화 가능한 에러

`fakeBaseQuery<SerializedError>()`를 쓰므로 error는 `{ name, message, code? }` 형태여야 한다. `FirebaseError` 같은 Error 인스턴스를 그대로 넣으면 직렬화 검사 경고가 난다.

```ts
serializeError(error)               // catch에서: Error/string → SerializedError
errorWithCode('not_authenticated')  // 사전 검증 실패: code 하나로 호출부 분기
errorWithCode('daily_limit')        //   ↳ reactionApi 등 한도/권한 분기
```

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| `fakeBaseQuery` + `queryFn`에서 Firebase SDK 직접 호출 | REST endpoint가 없는 Firebase를 RTK Query 캐시/디듀프/무효화 위에 그대로 올림. 옵션 A로 Functions 이전 시 `queryFn` 본체만 교체 | error 정규화를 수동으로 해야 함(`serializeError`). HTTP 상태코드 기반 자동 재시도/`fetchBaseQuery` 기능 미사용 |
| auth는 RTK Query가 아닌 별도 `authSlice` | `onAuthStateChanged`는 query가 아닌 구독 stream, `User`는 직렬화 불가. 직렬화 가능한 메타만 store에, 메서드는 `auth.currentUser` 직접 참조 | store와 모듈 글로벌(`auth.currentUser`) 두 출처를 함께 다뤄야 함 |
| step 전환을 invalidate 대신 `updateQueryData` 낙관적 patch | `invalidateTags(['EntryState'])`는 refetch 응답 도착 전까지 stale status를 노출 → 게이트가 잘못된 target을 계산해 `<Loading/>`으로 가리며 깜빡임. patch는 commit 직후 캐시를 갱신해 무깜빡임 전이 | 캐시와 Firestore가 잠깐 낙관적으로 어긋남. 실패 시 `patch.undo()` 필요(reaction) |
| `onCacheEntryAdded`로 `onSnapshot` 구독 일원화 | 컴포넌트마다 mount/unmount하던 구독을 한 곳에 모음. `queryFn`은 빈 배열 즉시 반환, 구독이 이후 데이터 push, `cacheEntryRemoved`에서 정리 | 구독형 endpoint는 `providesTags`/낙관적 patch 모델과 결이 달라 별도 멘탈모델 필요 |
| 도메인별 slice를 `injectEndpoints`로 분리 | 코드 분할 + 도메인 경계. `baseApi` 하나가 tag/캐시를 공유 | dev에서 HMR 중복 주입 경고 방지를 위해 `overrideExisting: NODE_ENV === 'development'` 필요 |

---

## 6. 현재 상태

### 구현됨

- 단일 store(`api` + `auth`) + 타입 연결 훅(`useAppDispatch`/`useAppSelector`), `setupListeners` 활성화.
- `baseApi` tagTypes 18종 등록, 13개 도메인 slice가 `injectEndpoints`로 주입 완료.
- `AuthSync` 기반 auth↔store 동기화 + 로그인/로그아웃 시 사용자 종속 캐시 무효화.
- `getEntryState` 통합 fetch + `useEntryState` stale 캐시 가드 + `transitionOnboardingStatus` 낙관적 patch로 온보딩 깜빡임 제거.
- `reactionApi.react`의 `onQueryStarted` 낙관적 patch / `patch.undo()` 롤백.
- `chatApi`의 `onCacheEntryAdded` Firestore `onSnapshot` 구독 라이프사이클 관리.
- selector 기반 라우트 게이트(`AuthenticatedRouteGate`, `AdminRouteGate`).

### 남은 작업

- **Functions 이전**: 현재 callable로 이전된 endpoint는 `react` 하나뿐. 나머지 12개 slice의 `queryFn`은 여전히 `shared/lib/firebase/*` 헬퍼를 통해 Firestore/Storage를 직접 호출한다(옵션 A). 신뢰가 필요한 로직은 추후 callable로 옮기고 `queryFn` 본체만 교체할 예정.

### 알려진 위험

- **client-only 검증**: `AdminRouteGate` 등 라우트 게이트는 client selector(`selectAuthRole`)에만 의존한다. 파일 내 `TODO(Phase 3)`대로 Firestore Security Rules에서 role 검증을 보강해야 실제 권한 경계가 된다. 자세한 서버 경계는 [`functions-security.md`](./functions-security.md) 참고.
- **낙관적 patch 일관성**: `updateQueryData` patch는 Firestore와 잠깐 어긋난다. 실패 경로에서 `undo()`를 빠뜨리면 캐시가 잘못된 상태로 굳을 수 있다(현재 reaction은 처리됨).
- **두 출처의 auth**: store(`uid`/`role`)와 모듈 글로벌 `auth.currentUser`를 함께 다루므로, 둘이 미묘하게 어긋나는 타이밍(부트스트랩 직후 등)에 주의가 필요하다.

> **문서 정합성**: 루트 `DATA_MODEL.md`가 일부 라우트명을 실제와 다르게 적고 있다. 진입 라우팅의 source of truth는 `resolveEntryRoute`(게이트 라우트 prefix `/onboarding/*`·`/account/*`, approved 사용자는 `/matching`)와 `transitionOnboardingStatus`/`useEntryState` 구현이며, 본 문서의 흐름 기술이 현재 코드 기준이다.
