# 추천 / 매칭 / 좋아요 — seremeety-web

> **한 줄 요약**: 일일 한도 기반으로 추천 카드를 노출하고(`/matching`), 좋아요/패스/슈퍼좋아요 반응을 Functions `react` onCall에서 검증·기록하며, 상호 좋아요가 성립하면 `match` + 레거시 `chatRoom`을 atomic batch로 생성해 채팅으로 이어주는 서브시스템.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / RTK Query / Functions 경계
> - [`roadmap.md`](../roadmap.md) — Phase별 작업 계획 (Phase 5 추천 재구축, Phase 6 RTK Query, Phase 9 프리미엄 한도)
> - 형제 도메인: [`chat.md`](./chat.md) · [`payment-entitlement.md`](./payment-entitlement.md)

---

## 1. 개요

추천-매칭 도메인은 다음 흐름을 담당한다.

```
추천 피드(/matching) → 좋아요/패스/슈퍼좋아요 → 상호 좋아요 시 매칭 성립 → 채팅 진입
```

핵심 책임을 두 경계로 나눈다.

| 경계 | 책임 | 신뢰 수준 |
|---|---|---|
| **클라이언트** (`recommendations.ts`) | 추천 후보 fetch·필터·셔플·`recommendationLog` 작성 | client trust (Phase 3-B 이전, 미연동) |
| **서버** (Functions `react` onCall) | 차단/일일 한도 검증, `reaction` 작성, mutual 판정, `match`+`chatRoom` atomic 작성 | server-only (firestore.rules가 client write 차단) |

`reactions`/`matches` 컬렉션은 firestore.rules에서 client write를 막고, **Functions admin SDK만 작성**할 수 있다. 반면 **추천 후보 산출은 아직 클라이언트에서 수행**한다. 즉 reaction 쓰기 경로(Phase 3-A)는 이미 서버로 이전됐지만, 추천 산출 경로(Phase 3-B)는 아직 클라이언트에 남아 있어 두 단계가 혼재한다.

일일 한도는 `entitlements` 문서(요금제별)와 **KST 자정 기준** 카운트로 강제한다.

| 플랜 | 일 추천 | 일 좋아요 | 일 슈퍼좋아요 |
|---|---|---|---|
| `free` | 5 | 3 | 0 |
| `premium` | 15 | 10 | 3 |

(출처: [`plans.ts`](../../src/shared/lib/billing/plans.ts) `FREE_PLAN` / `PREMIUM_PLAN`)

---

## 2. 핵심 흐름

### 2.1 추천 후보 산출 (`getTodayRecommendations`)

[`recommendations.ts`](../../src/shared/lib/firebase/recommendations.ts)가 클라이언트에서 다음을 수행한다.

1. **병렬 fetch**: `entitlement`(한도), `allLogs`(노출 이력), `myReactions`(반응 이력), `candidates`(반대 성별 + `profileStatus=1` 사용자 전체), `blockedByMe`, `blockersOfMe`.
2. **오늘 노출 카드 유지**: `todayShownIds`(오늘 `shownAt`인 로그)는 항상 그대로 표시. 반응한 카드도 카드 자체는 유지하고, `ProfileCardItem`이 reaction 배지·disabled만 표시한다 (재진입 시 "내가 뭘 눌렀는지" 시각 추적).
3. **잔여 슬롯 계산**: `remaining = max(0, dailyRecommendationLimit − 오늘 노출 수)`.
4. **신규 후보 필터**: 자기 자신 / `allShownIds`(누적 노출) / `reactedIds`(반응한) / `blockedByMe` / `blockersOfMe` 제외.
5. **셔플 후 선별**: Fisher-Yates shuffle → `remaining`개 picking. 점수 정렬 없음.
6. **로그 작성**: 선택된 카드마다 `createRecommendationLog(uid, candidateUid, 0, [])` — `score=0`, `reasonCodes=[]`, `shownAt=serverTimestamp`.
7. **Fallback**: `오늘 노출 0개 + 신규 후보 0개`이면 `allLogs`를 최근 `shownAt` 순으로 정렬해 `limit`개 재표시 (후보 풀이 작은 초기 상황 대비).

`recommendationApi`는 진입 시 `me.profileStatus !== 1`이면 추천을 받지 않고 빈 배열을 반환한다 (`MatchingPage` 가드와 일치).

### 2.2 좋아요 → 매칭 (Functions `react` onCall)

[`react.ts`](../../functions/src/reactions/react.ts) server-side 처리 순서:

1. `requireAuthedUser`로 인증, `toUserId`/`type` 검증 (자기 자신·잘못된 type 거부).
2. **양방향 차단 검증**: `blocks/{uid_toUserId}` 또는 `blocks/{toUserId_uid}` 존재 시 `{ ok: false, reason: 'blocked' }`.
3. **일일 한도 검증** (`like`/`superLike`만, `pass`는 무제한): `entitlements/{uid}`의 한도와, KST 자정 이후 `reactions` count를 비교 → 초과 시 `{ ok: false, reason: 'daily_limit' }`.
4. **reaction 작성**: `reactions/{uid_toUserId}` (deterministic ID라 재호출 시 idempotent 덮어쓰기).
5. **`recommendationLog` update** (best effort): `recommendationLogs/{uid_toUserId}`에 `reactedAt`/`reactionType` 기록. 로그 부재 시 무시(catch).
6. `pass`면 `{ ok: true, matched: false }` 반환.
7. **mutual 판정**: 상대 reaction `reactions/{toUserId_uid}`을 조회해 `like`/`superLike`이면 매칭 성립.
8. **atomic batch write**: `matches/{sortedPairId}` + 레거시 `chatRooms/{sortedPairId}` 동시 `set`. `chatRooms.lastMessage.sentAt`을 빈 값으로라도 초기화 — client `subscribeToChatRooms`가 이 필드로 `orderBy`하므로 누락 시 목록에서 빠지기 때문.
9. `{ ok: true, matched: true }` 반환.

### 2.3 클라이언트 반응 UX

[`ProfilePage.tsx`](../../src/features/profile/ProfilePage.tsx)에서 버튼 클릭 → `useReactMutation`:

- **Optimistic patch**: 호출 직후 `getMyReaction` 캐시를 즉시 갱신해 버튼을 disabled 처리(중복 클릭 방지). 응답이 `ok:false`이거나 throw면 `patch.undo()`.
- **응답 분기**: `daily_limit` → "한도 초과" 모달, `blocked` → "차단됨" 모달, `matched:true` → "매칭 성공" 모달(계속 둘러보기 / 채팅으로 → `/chat-list`).
- **invalidation**: `Reaction`/`Match`/`Recommendation`/`SentLikes`/`ReceivedLikes` 태그를 무효화해 매칭 페이지·좋아요 페이지가 자동 갱신된다.

### 2.4 보낸 / 받은 좋아요

[`reactionApi.ts`](../../src/shared/lib/api/reactionApi.ts):

- **보낸** (`getSentLikeProfiles`): 본인이 보낸 reaction 중 `like`/`superLike`만, 차단 페어 제외, 최신순. 매칭된 페어도 그대로 노출(MVP).
- **받은** (`getReceivedLikeProfiles`, 프리미엄 UI 가드): 본인을 `toUserId`로 한 `like`/`superLike` 중 **본인이 아직 반응하지 않은** 페어만 (`sentSet` 제외 → 매칭/패스된 페어는 숨김), 차단 제외, 최신순. 각 항목에 like/pass 버튼.

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`recommendations.ts`](../../src/shared/lib/firebase/recommendations.ts) | `getTodayRecommendations` — 후보 fetch·필터·셔플·로그 작성·Fallback (클라이언트 추천 로직 핵심) |
| [`reactions.ts`](../../src/shared/lib/firebase/reactions.ts) | reaction read 헬퍼(`getReaction`/`getReactionsFromUser`/`getReactionsToUser`). write 헬퍼는 레거시(미호출) |
| [`matches.ts`](../../src/shared/lib/firebase/matches.ts) | match CRUD 헬퍼. `createMatch`는 레거시(미호출, write는 Functions가 담당) |
| [`recommendationLogs.ts`](../../src/shared/lib/firebase/recommendationLogs.ts) | `userId_recommendedUserId` doc ID로 노출 이력 기록(`shownAt`/`reactedAt`/`reactionType`) |
| [`dailyLimits.ts`](../../src/shared/lib/firebase/dailyLimits.ts) | KST 자정 계산(`getKstTodayStartMs`) + `count*Today` 쿼리 |
| [`recommendationApi.ts`](../../src/shared/lib/api/recommendationApi.ts) | `getTodayRecommendations` RTK Query(`providesTags=['Recommendation']`) |
| [`reactionApi.ts`](../../src/shared/lib/api/reactionApi.ts) | `getMyReaction`/`getAllMyReactions`/`getSentLikeProfiles`/`getReceivedLikeProfiles` + `react` mutation(optimistic patch) |
| [`matchApi.ts`](../../src/shared/lib/api/matchApi.ts) | `getActiveMatchExists` — 채팅 이동 버튼 노출 판정 |
| [`react.ts`](../../functions/src/reactions/react.ts) | Functions `react` onCall — 차단/한도 검증, reaction 작성, mutual 시 match+chatRoom batch |
| [`MatchingPage.tsx`](../../src/features/matching/MatchingPage.tsx) | 추천 피드 진입점. `getTodayRecommendations` 로드 + 프로필 상태 가드 |
| [`MatchingContent.tsx`](../../src/features/matching/components/matching/MatchingContent.tsx) | 카드 그리드. `getAllMyReactions`로 reaction Map 구성 → `myReactionType` 전달 |
| [`ProfileCardItem.tsx`](../../src/features/matching/components/matching/ProfileCardItem.tsx) | 개별 카드 UI. reaction 배지/disabled, `/profile/[uid]` 링크 |
| [`ProfilePage.tsx`](../../src/features/profile/ProfilePage.tsx) | 프로필 상세 + 반응 버튼. 매칭/한도/차단 모달, `/chat-list` 이동 |
| [`LikesPage.tsx`](../../src/features/likes/LikesPage.tsx) | 보낸/받은 좋아요 탭 |
| [`SentLikesContent.tsx`](../../src/features/likes/components/likes/SentLikesContent.tsx) | 보낸 좋아요 목록(슈퍼/일반 분리) |
| [`ReceivedLikesContent.tsx`](../../src/features/likes/components/likes/ReceivedLikesContent.tsx) | 받은 좋아요 목록(프리미엄 가드) + like/pass 버튼 |
| [`entitlements.ts`](../../src/shared/lib/firebase/entitlements.ts) | 플랜별 `dailyRecommendationLimit`/`dailyLikeLimit`/`dailySuperLikeLimit` |
| [`plans.ts`](../../src/shared/lib/billing/plans.ts) | 요금제 단일 소스(`FREE_PLAN`/`PREMIUM_PLAN`) |

---

## 4. 데이터·상태

### 4.1 Firestore 컬렉션 (deterministic doc ID)

| 컬렉션 | doc ID 규칙 | 비고 |
|---|---|---|
| `reactions` | `{fromUid}_{toUid}` | 페어 방향 보존, 재호출 시 idempotent 덮어쓰기 |
| `matches` | `sortedPairId(a, b)` (정렬된 두 uid) | 방향 무관 단일 문서 |
| `chatRooms` | `sortedPairId(a, b)` | match와 동일 ID — Phase 1 호환용 레거시 dual-write |
| `recommendationLogs` | `{userId}_{recommendedUserId}` | 같은 페어 중복 노출 방지 |

deterministic ID는 **composite index 회피 + idempotent + 중복 방지**가 목적이지만, doc ID 순서를 잘못 쓰면 다른 문서가 생기는 함정이 코드에 남는다.

### 4.2 `match` 문서 — 타입과 실제 쓰기의 불일치 (주의)

[`match.ts`](../../src/shared/types/model/match.ts) 타입은 `userIds` / `createdByReactionIds` / `status`를 선언하지만, Functions `react.ts`가 실제로 쓰는 필드는 **`users` / `reactions` / `active`(boolean)**이다.

```ts
// react.ts가 실제로 set 하는 match 문서
{ id, users: sortedUids, reactions: [..], active: true, createdAt }
// vs match.ts 타입: { userIds, createdByReactionIds, status, ... }
```

현재 `matchApi.getActiveMatchExists`는 `active: true` 기준으로 조회하므로 동작에는 문제가 없지만, **타입 정의와 런타임 shape가 어긋난다** (§6 위험 참고).

### 4.3 `recommendationLog`

[`recommendation.ts`](../../src/shared/types/model/recommendation.ts): `userId`, `recommendedUserId`, `score`(현재 0), `reasonCodes`(현재 `[]`), `shownAt`, `reactedAt?`, `reactionType?`. `score`/`reasonCodes` 필드는 데이터 모델만 선제 수용했고 **계산 로직은 전무**하다.

### 4.4 KST 자정 한도

[`dailyLimits.ts`](../../src/shared/lib/firebase/dailyLimits.ts)와 [`react.ts`](../../functions/src/reactions/react.ts) 모두 `KST_OFFSET_MS = 9h` 하드코딩으로 `Math.floor(nowKstMs / DAY_MS) * DAY_MS` 자정을 구해 UTC로 변환한다. 클라이언트 타임존과 무관하게 동일 경계를 적용한다. 카운트는 `getCountFromServer`(client) / `.count()`(Functions)로 수행한다.

### 4.5 RTK Query 태그

- `Recommendation`: `getTodayRecommendations`가 provide. `react` mutation이 invalidate.
- `Reaction` / `SentLikes` / `ReceivedLikes` / `Match`: 반응·좋아요 페이지 상태. `react` 성공 시 모두 invalidate → 매칭/좋아요 화면 자동 동기화.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| **추천 후보 산출을 클라이언트에서 수행** | 후보 필터(자신/노출/반응/차단)가 사용자마다 다르고, 점수화가 없어 서버 계산 이점이 작음. 병렬 fetch + 로컬 필터가 비용 효율적 | client trust — 한도 우회·차단 무시 등 조작 가능. Phase 3-B에서 Functions 이전 예정 |
| **Server-only write** (reactions/matches) | client write 시 한도 우회·자가 매칭·차단 무시 가능 → Functions onCall에서만 검증 후 작성 = 신뢰 경계 | 레거시 `createReaction`/`createMatch`가 dead code로 남음 |
| **Deterministic doc ID** | idempotent + composite index 불필요 + 중복 방지 | doc ID 순서 실수 시 다른 문서 생성. 타입으로 보호 어려움 |
| **Fallback 카드 재노출** | 한도(free 5)는 작은데 초기 사용자 풀도 작음 → 모두 본 경우 최근 카드 재표시로 빈 화면 회피 | 추천 정확성 ↔ UX 연속성. 장기 사용자는 같은 카드를 반복해서 봄 |
| **Optimistic patch** | 네트워크 지연 동안 버튼 즉시 disabled → 중복 클릭 방지 | 실패 케이스 누락 시 UI/캐시 불일치. `daily_limit`/throw는 `patch.undo()`로 처리 |
| **match + chatRoom batch atomic** | mutual 성립 시 두 문서가 함께 있어야 채팅 목록에 노출. 한쪽만 생성되면 불일치 | 두 컬렉션 동기화 책임 증가. 향후 match를 단일 소스로 정리(레거시 bridge) |
| **KST 자정 하드코딩** | 한국 서비스의 "어제/오늘" 경계는 KST 자정이어야 하고, DST가 없어 고정 offset 안정 | 시간대/정책 변경 시 버그. 향후 date-fns 등 고려 |
| **score/reasonCodes 미구현** | MVP 범위 초과. 데이터 모델만 선제 수용 | 단순 셔플 추천 → 만족도 한계. Phase 5 이후 가중치(나이/지역/tags) 필요 |
| **`recommendationLog` update best effort** | 추천을 거치지 않고 `/profile/[uid]` 직접 진입 시 로그 부재 가능 → 예외보다 무시 | 일부 reaction이 로그와 비동기화 → 추천 효율 분석 불완전 |

---

## 6. 현재 상태

### 구현됨

- 추천 카드 노출(일일 한도 기반 선별, KST 자정 경계, Fisher-Yates 셔플)
- 좋아요/패스/슈퍼좋아요 반응 — Functions `react` onCall에서 검증 후 작성
- 상호 좋아요 시 `match` 자동 생성(batch atomic) + 레거시 `chatRoom` 동시 생성
- 일일 한도 강제(`entitlements` 기반, KST 자정 count)
- 양방향 차단 검증(반응 거부)
- 보낸/받은 좋아요 페이지(받은 좋아요는 프리미엄 가드)
- RTK Query optimistic update(중복 클릭 방지) + 태그 invalidation 자동 동기화
- `recommendationLog` 노출 이력 기록(`shownAt`/`reactedAt`/`reactionType`)

### 남은 작업

- **추천 산출의 Functions 이전(Phase 3-B)** — 후보 쿼리/필터/로그 작성이 아직 클라이언트에 있음(`recommendations.ts`/`dailyLimits.ts`에 `TODO(Phase 3)` 주석 잔존)
- **점수 기반 정렬** — `score`/`reasonCodes` 기록 슬롯은 있으나 계산 로직 없음(현재 `score=0`, `reasonCodes=[]`)
- **후보 쿼리 최적화** — `getUserProfiles`가 반대 성별 + `profileStatus=1` 사용자 **전체**를 fetch 후 클라이언트 필터. 사용자 증가 시 페이지네이션/query constraint 필요
- 레거시 dead code(`createReaction`/`createMatch`) 정리
- `match` 타입(`match.ts`)과 Functions 실제 쓰기 shape(`users`/`reactions`/`active`)의 정합화

### 알려진 위험

- **client trust**: 추천 후보 필터링과 `recommendationLog` 작성을 클라이언트가 직접 수행 → 한도 우회·차단 무시·가짜 로그 대량 작성 가능. Phase 3-B 이전까지 미연동
- **타입/런타임 불일치**: `match.ts`는 `userIds`/`status`를 선언하지만 Functions는 `users`/`active`를 쓴다. 새 reader가 타입만 믿고 `userIds`/`status`로 접근하면 `undefined`. 현재 `getActiveMatchExists`는 `active` 기준이라 동작은 정상이나, 정합화 전까지 주의
- **레거시 호출 위험**: rules가 reactions/matches client write를 거부하지만, 오래된 코드·테스트가 이를 호출하면 조용히 실패
- **Fallback 반복 노출**: 후보 풀이 작을 때 같은 카드를 매일 보여줘 churn 유발 가능
- **KST 하드코딩**: 고정 offset이라 시간대/정책 변경 시 버그 소지
- **전체 fetch 성능**: `getUserProfiles` 전체 조회는 사용자 규모 확대 시 비용/지연 증가
