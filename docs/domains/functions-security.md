# Firebase Functions / 보안 경계 — seremeety-web

> **한 줄 요약**: 신뢰가 필요한 로직(차단·일일 한도·매칭 생성)만 Firebase Functions v2 `onCall`로 격리해 server-side에서 atomic하게 처리하고, `reactions`/`matches` 컬렉션은 firestore.rules에서 client write를 막는 단계(Phase 3-A 완료). 나머지 14개 컬렉션은 아직 "인증만 하면 read/write 허용" 상태로, 보안 경계가 Phase 3-B/3-C까지 의도적으로 절반만 잠긴 과도기다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) §7~9 — 서버 경계 / 보안 현황 정직 정리
> - [`roadmap.md`](../roadmap.md) — Phase 3-A/3-B/3-C 작업 계획
> - 형제 도메인: [`matching.md`](./matching.md) (react 흐름) · [`state-management.md`](./state-management.md) (RTK Query 통합) · [`admin.md`](./admin.md) (role 가드)

---

## 1. 개요

이 도메인은 **클라이언트가 직접 손대면 위험한 쓰기 경로**를 어디까지 서버로 옮겼는지, 그리고 그 경계를 firestore.rules / cost guard / admin SDK 초기화로 어떻게 선언하는지를 다룬다.

판단 원칙은 단순하다.

| 분류 | 처리 위치 | 신뢰 모델 |
|---|---|---|
| **신뢰가 필요한 로직** (차단 검증, 일일 한도, 매칭 atomic write) | Functions `onCall` | server-only — admin SDK만 작성 |
| **일반 CRUD** (프로필/사진/약관/선호/결제 mock 등) | 클라이언트 Firestore SDK 직접 | Security Rules로 검증 (현재는 `auth != null`만) |

핵심은 **현재 Functions로 이전된 것은 `react` 단 하나**라는 점이다. `reactions`/`matches` 두 컬렉션만 `allow write: if false`로 잠겨 있고, 나머지는 인증된 사용자면 누구나 read/write할 수 있다. 따라서 이 도메인은 "보안이 완성된 상태"가 아니라 "Phase 3-A까지만 잠긴 경계"를 정직하게 기술한다.

```
신뢰 필요 ── react onCall ── reactions / matches : server-only (잠김)
일반 CRUD ── client SDK  ── users / profiles / ... / payments : auth-only (열림, Phase 3-B 대상)
```

---

## 2. 핵심 흐름

### 2.1 react onCall — server-side 검증 파이프라인

[`react.ts`](../../functions/src/reactions/react.ts)가 좋아요/패스/슈퍼좋아요 한 번을 다음 순서로 처리한다. 클라이언트는 callable만 호출하고 결과를 받는다.

1. **인증·계정 상태 검증** — `requireAuthedUser`로 `auth.uid` + `users/{uid}` 문서 존재 + `status`(suspended/deleted 아님)를 통과해야 진입.
2. **인자 검증** — `toUserId` 타입, 자기 자신 반응(`self_reaction`), `type` 값(`like`/`pass`/`superLike`) 거부.
3. **양방향 차단 검증** — `blocks/{me_other}`, `blocks/{other_me}` 두 문서를 병렬 조회. 한쪽이라도 존재하면 `{ ok: false, reason: 'blocked' }`.
4. **일일 한도 검증** (`like`/`superLike`만, `pass`는 무제한) — `entitlements/{uid}`의 `dailyLikeLimit`/`dailySuperLikeLimit`(없으면 free 기본값 `3`/`0`)와, KST 자정 이후 `reactions` count 쿼리를 비교. 초과 시 `{ ok: false, reason: 'daily_limit' }`.
5. **reaction 작성** — deterministic ID `${fromUid}_${toUid}`로 `set` (idempotent, 재호출 시 덮어씀).
6. **recommendationLog 갱신** — `recommendationLogs/{uid}_{toUserId}`에 `reactedAt`/`reactionType` best-effort `update` (실패해도 `.catch`로 무시).
7. **mutual 판정** — `pass`면 바로 종료. 그 외에는 상대 reaction(`reactions/{toUserId_uid}`)이 존재하고 `like`/`superLike`인지 확인.
8. **match + legacy chatRoom atomic write** — 상호 좋아요면 `db.batch()`로 `matches/{sortedPairId}`와 레거시 `chatRooms/{sortedPairId}`를 한 번에 commit.

이 흐름 전체가 server-side에서 atomic이라 클라이언트가 한도를 우회하거나, 차단을 무시하거나, match만 임의 생성하는 것이 불가능하다.

```
client react 클릭
  → reactionApi.react mutation (optimistic update)
  → httpsCallable('react')
  → requireAuthedUser → 차단 검증 → 한도 검증 → reaction set
  → recommendationLog best-effort
  → mutual 확인 → batch(match + chatRoom) commit
  → { ok, matched } 응답 (실패 시 optimistic patch.undo)
```

### 2.2 deterministic ID와 pair 정렬

- **reaction ID**: `${fromUid}_${toUid}` — 방향이 있어 보낸 사람/받은 사람이 구분됨. 같은 페어 재호출은 덮어쓰기라 중복 문서가 안 생긴다.
- **match / chatRoom ID**: `sortedPairId(a, b)` = `a < b ? a_b : b_a` — 방향이 없는 단일 키. `match_id === chatRoom_id`라 별도 매핑이 필요 없다.

레거시 `chatRooms` 문서에는 `lastMessage.sentAt`을 매칭 생성 시점 timestamp로 **반드시** 초기화한다. 클라이언트 `subscribeToChatRooms`가 이 필드로 `orderBy`하는데, Firestore `orderBy`는 해당 필드가 없는 문서를 결과에서 제외하기 때문이다(누락 시 채팅방이 목록에 안 뜸).

### 2.3 비용 가드 (전역 강제)

[`index.ts`](../../functions/src/index.ts)가 `setGlobalOptions`로 모든 함수에 default를 건다.

| 옵션 | 값 | 이유 |
|---|---|---|
| `region` | `asia-northeast3` (서울) | 한국 사용자 latency 최소화 |
| `minInstances` | `0` | idle 청구 차단 |
| `maxInstances` | `5` | 무한루프/retry 폭주 시 동시 실행 cap |
| `timeoutSeconds` | `30` | 리소스 최소화 |
| `memory` | `256MiB` | 동일 |

`react` 함수는 default를 받지만 보험으로 함수 수준에서도 `{ maxInstances: 5 }`를 명시한다.

### 2.4 admin SDK 초기화

[`admin.ts`](../../functions/src/lib/admin.ts)가 `getApps().length === 0`일 때만 `initializeApp()` 하는 singleton. 모듈 import 시점에 평가되어 cold start 간 재사용되며, `setGlobalOptions`/함수 export보다 먼저 실행되도록 한다. `export const db`로 Firestore 핸들을 공유한다.

### 2.5 초기 admin seed

[`grant-admin.mjs`](../../functions/scripts/grant-admin.mjs)는 1회용 CLI 스크립트다(이후 admin 추가는 `/admin/users` 콘솔에서).

```bash
cd functions
node scripts/grant-admin.mjs --phone +821012345678   # 전화번호로
node scripts/grant-admin.mjs --uid <auth-uid>         # UID로
node scripts/grant-admin.mjs --uid <uid> --revoke     # 권한 회수 (role -> 'user')
```

- 부여 시 `users/{uid}`에 `role: 'admin'` + `onboardingStatus: 'approved'` + `status: 'active'`를 set해 onboarding을 우회하고 곧장 `/admin` 진입 가능 상태로 만든다.
- 인증은 Firebase Admin SDK의 **Application Default Credentials**에 의존한다(`gcloud auth application-default login` 또는 `GOOGLE_APPLICATION_CREDENTIALS` 환경변수). `firebase deploy` 가능 환경이면 보통 충족됨.

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`functions/src/index.ts`](../../functions/src/index.ts) | 함수 엔트리포인트. `setGlobalOptions` 비용 가드 강제 + `react`/결제 callable export |
| [`functions/src/reactions/react.ts`](../../functions/src/reactions/react.ts) | `react` onCall. 차단·한도 검증, reaction 작성, mutual 판정, match+chatRoom batch |
| [`functions/src/payments/checkout.ts`](../../functions/src/payments/checkout.ts) | `createMockPayment`/`completeMockPayment`/`cancelMockSubscription` onCall. payment 상태 + entitlement를 server PLANS로 atomic 갱신 |
| [`functions/src/lib/plans.ts`](../../functions/src/lib/plans.ts) | 서버 권위 plan 한도(`PLANS`). 클라이언트 `billing/plans.ts`와 일치시켜야 함 |
| [`functions/src/lib/auth.ts`](../../functions/src/lib/auth.ts) | `requireAuthedUser` — 모든 onCall의 진입 헬퍼. 인증 + users 문서 + status 검증 |
| [`functions/src/lib/admin.ts`](../../functions/src/lib/admin.ts) | Admin SDK singleton 초기화 + `db` export |
| [`functions/scripts/grant-admin.mjs`](../../functions/scripts/grant-admin.mjs) | 초기 admin seed CLI 스크립트 (phone/uid, `--revoke`) |
| [`firestore.rules`](../../firestore.rules) | 보안 경계 선언 (Phase 3-B). 컬렉션별 권한 + `isAdmin()` 게이트 (§4.1) |
| [`firestore.indexes.json`](../../firestore.indexes.json) | composite index — reactions / chatRooms / consents |
| [`firebase.json`](../../firebase.json) | 배포 설정. hosting + functions(`nodejs20`, predeploy build) + firestore rules/indexes |
| [`.firebaserc`](../../.firebaserc) | Firebase 프로젝트 ID 매핑 |
| [`src/shared/lib/api/reactionApi.ts`](../../src/shared/lib/api/reactionApi.ts) | RTK Query react 엔드포인트. `httpsCallable('react')` + optimistic update |
| [`src/shared/lib/api/baseApi.ts`](../../src/shared/lib/api/baseApi.ts) | `createApi(fakeBaseQuery)` 기반 API + tag 타입 |
| [`src/shared/lib/firebase/legacyBridge.ts`](../../src/shared/lib/firebase/legacyBridge.ts) | dual-write 어댑터 (Profile→users, match→legacy chatRoom) |
| [`src/shared/lib/firebase/serialize.ts`](../../src/shared/lib/firebase/serialize.ts) | Firebase Timestamp → Redux 호환 plain object |
| [`src/shared/lib/firebase/normalizers.ts`](../../src/shared/lib/firebase/normalizers.ts) | Firestore doc → 타입화된 도메인 모델 정규화 |

---

## 4. 데이터·상태

### 4.1 firestore.rules 경계 (Phase 3-B 적용)

[`firestore.rules`](../../firestore.rules)는 컬렉션별로 접근을 좁힌다. `isAdmin()`은 호출자 `users` 문서의
`role == 'admin'`을 `get()`으로 확인하며, admin의 클라이언트 mutation(검수/정지/권한)은 이 경로로 통과한다.

| 컬렉션 | read | write 핵심 |
|---|---|---|
| `reactions` | 본인 관련(`from`/`to == uid`) | `if false` (Functions만) |
| `matches` | 본인이 `users`에 포함 | `if false` (Functions만) |
| `users` | authenticated*¹ | 본인만 — **role을 self로 `admin` 불가**, **status 자가 해제 불가**, **onboardingStatus 자가 `approved` 불가**(admin/legacy grandfather 예외). 그 외 필드 self 갱신 가능 |
| `profiles` | authenticated*¹ | create=본인(`draft`), update=본인 콘텐츠(+심사 제출 `draft/rejected→pending`). **`approved`/`rejected`는 admin만** |
| `profilePhotos` | authenticated*¹ | create=본인(`pending`), update=본인(메인 지정/soft-delete). **승인/반려는 admin만** |
| `preferences` | self / admin | 본인(`userId == uid`)만 |
| `consents` | self / admin | 본인 create만(이력) |
| `recommendationLogs` | self | 본인만 |
| `blocks` | 본인 관련(`blocker`/`blocked == uid`) | 본인이 blocker일 때만 create/delete |
| `reports` | reporter 본인 / admin | create=본인(`open`), **상태 전이는 admin만** |
| `identityVerifications` | self / admin | self / admin (mock) |
| `chatRooms` / `messages` | 참여자(`uid in users`) | 메시지 create=참여자 본인(`sender == uid`), 방 생성은 보통 server |
| `entitlements` | self / admin | create=본인의 free 기본값만(또는 admin), update=admin만. premium 전환/취소는 Functions(admin SDK) |
| `payments` | self / admin | `if false` (모든 write는 Functions만 — `createMockPayment`/`completeMockPayment`) |

*¹ `users`/`profiles`/`profilePhotos` read는 매칭·채팅이 상대 닉네임·사진·프로필을 읽어야 해 당분간 열어 둔다.
읽기 강화(예: `profiles`를 approved-only로)는 클라이언트 공개 조회 쿼리에 `where(status == 'approved')`를
추가하는 후속 작업과 함께 진행한다.

*² **결제/권한 write 잠금 완료:** mock 결제 생성/완료/취소를 Functions callable로 이전해
`payments` write를 server-only, `entitlements` update를 admin-only(+ bootstrap free 생성만 self)로 좁혔다.
한도는 항상 서버 `PLANS`로만 기록되므로 클라이언트가 임의 한도를 주입할 수 없다. **단 mock은 실제 결제
검증이 없어 "success"가 클라이언트 트리거다 — mock self-upgrade 자체는 실 PG 결제 검증이 들어와야 닫힌다**
(그 슬롯은 `completeMockPayment`에 마련됨).

> 참고: wildcard `{path=**}` match는 specific match와 **OR로 결합**되어 잠금을 풀어버리므로 쓰지 않고 컬렉션별로 명시한다.
> 규칙 변경 후에는 emulator(`@firebase/rules-unit-testing`) 또는 staging에서 검증하고 `firebase deploy --only firestore:rules`로 배포한다.

### 4.2 composite index

[`firestore.indexes.json`](../../firestore.indexes.json)에 3개.

| 컬렉션 | 필드 | 용도 |
|---|---|---|
| `reactions` | `fromUserId` ASC, `type` ASC, `createdAt` ASC | react onCall의 일일 한도 `count()` 쿼리 — **이 index 없으면 count 실패** |
| `chatRooms` | `users` CONTAINS, `lastMessage.sentAt` DESC | 채팅 목록 정렬 구독 |
| `consents` | `userId` ASC, `agreedAt` DESC | 약관 동의 이력 조회 |

### 4.3 RTK Query 통합

- [`baseApi.ts`](../../src/shared/lib/api/baseApi.ts)는 `createApi(fakeBaseQuery)`로 만들어지고, `reactionApi`가 `injectEndpoints`로 엔드포인트를 주입한다.
- `react` mutation의 `queryFn`은 `httpsCallable('react')` callable을 호출하고, 실패 시 serializable error를 반환한다. **optimistic update**로 클릭 즉시 `getMyReaction` 캐시를 갱신했다가, `ok: false`(daily_limit/blocked)거나 에러면 `patch.undo()`로 되돌린다.
- 성공 시 `Reaction`/`Match`/`Recommendation`/`SentLikes`/`ReceivedLikes` 태그를 invalidate해 본인 내역과 매칭 페이지 시각 표시를 즉시 갱신한다.
- Timestamp 직렬화는 [`serialize.ts`](../../src/shared/lib/firebase/serialize.ts)의 `toPlainTimestamps`가 Redux 호환 plain object로 변환한다. (상세 RTK Query 구조는 [`state-management.md`](./state-management.md))

### 4.4 dual-write 어댑터 (legacyBridge)

[`legacyBridge.ts`](../../src/shared/lib/firebase/legacyBridge.ts)는 신규 도메인 모델을 메인으로 쓰되, 기존 페이지(MatchingPage/ChatList/ChatRoom/MyProfile/Admin)가 옛 `users/{uid}` 한 문서에서 닉네임·사진·프로필상태를 읽는 동안 호환성을 유지한다.

| 함수 | 동작 |
|---|---|
| `writeProfileToLegacyUser` | 신규 Profile 필드를 old UserProfile 필드로 매핑해 `users` 갱신 |
| `writePhotoToLegacyUser` | `profilePictureUrl` 갱신 |
| `writeProfileStatusToLegacyUser` | 신규 ProfileStatus → old `profileStatus`(0/1) 매핑 |
| `writeMatchToLegacyChatRoom` | match 생성 시 레거시 `chatRooms`에도 채팅방 생성 |

리더들이 신규 컬렉션 기반으로 마이그레이션되면(Phase 6 이후) 폐기 예정.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| `reactions`/`matches`만 Functions onCall로 이전 (Phase 3-A) + 나머지는 rules로 컬렉션별 잠금 (Phase 3-B) | 한도·차단·mutual 판정은 server 중앙화. 권한 상승/타인 데이터 접근은 rules로 차단(admin은 `isAdmin()` 통과) | `entitlements`/`payments` write는 mock 결제가 client라 아직 self 허용 — 결제 Functions 이전 후 server-only로 |
| `setGlobalOptions` 전역 비용 가드 | 한국 latency↓ + idle 청구 회피 + 폭주 cap + 리소스 최소화 | 모든 함수가 제약을 받음. 필요 시 함수 수준 override 가능하지만 보험으로 명시 |
| deterministic reaction ID + idempotent set | 같은 페어 재호출 중복 방지, `addDoc` + composite index 회피 | pair 순서 고정(`from_to`). match는 `sortedPairId`로 방향 제거 |
| match + legacy chatRoom을 batch로 atomic write | 기존 ChatList/ChatRoom이 변경 없이 동작 | batch 2문서(여유 충분). Phase 6에서 폐기 |
| recommendationLog 갱신은 best-effort | reaction 성공이 로그 부재로 실패하면 안 됨 | 일부 reaction이 로그에 미반영될 수 있음 |
| KST 자정 기준 일일 한도 카운트 | 한국 사용자 로컬 자정에 한도 초기화. Phase 5/6과 정합 | 서버 timestamp와 client 로컬 시간 차이 가능 — 동일 로직 유지 필수 |
| legacyBridge dual-write | Phase 2-C 마이그레이션 동안 옛 페이지 호환 | 두 문서 불일치 가능(transaction 아님). Phase 6 후 제거 |

---

## 6. 현재 상태

### 구현됨

- `react` onCall — 차단·일일 한도 검증, reaction 작성, mutual 판정, match+chatRoom batch
- `requireAuthedUser` 진입 헬퍼 (인증 + users 문서 + status 검증)
- `setGlobalOptions` 비용 가드 (region/minInstances/maxInstances/timeout/memory)
- **firestore.rules 컬렉션별 잠금 (Phase 3-B)** — `reactions`/`matches` server-only + 본인 관련 read만 유지하고,
  `users`/`profiles`/`profilePhotos`의 권한 상승 필드(role/status/onboardingStatus, 승인 status)를 self write에서 차단,
  `preferences`/`consents`/`entitlements`/`payments`/`recommendationLogs`/`identityVerifications` read를 self/admin으로,
  `blocks`/`reports`/`chatRooms`/`messages`를 관계 기반으로 좁힘. admin 작업은 `isAdmin()` 경로로 통과. (§4.1)
- **결제/권한 Functions (Phase 3-B)** — `createMockPayment`/`completeMockPayment`/`cancelMockSubscription` onCall로
  mock 결제·entitlement 변경을 server로 이전. 한도는 서버 `PLANS`로만 적용, payment+entitlement atomic batch.
  `payments` write는 server-only, `entitlements` update는 admin-only로 잠금
- composite index 3종 (reactions / chatRooms / consents)
- `grant-admin.mjs` 초기 admin seed 스크립트
- RTK Query + Firebase SDK 통합 (baseApi, reactionApi optimistic update, serialize, normalizers)
- legacyBridge dual-write 어댑터
- KST 자정 기준 일일 한도 카운팅

### 남은 작업 (미구현)

- **Phase 3-B 후속 (write 잠금 미완)**: `entitlements`/`payments` **write**는 mock 결제·bootstrap이 client라 아직 self/admin으로 열림 → 결제 완료를 callable Function으로 옮긴 뒤 server-only로 좁히기
- **Phase 3-B 후속 (read 강화)**: `profiles`/`profilePhotos` read를 approved-only로 좁히려면 클라이언트 공개 조회에 `where(status == 'approved')` 추가 필요 (현재 authenticated read)
- **검증**: 규칙을 emulator(`@firebase/rules-unit-testing`)/staging에서 테스트 후 배포 (현재 레포에 emulator 설정 없음)
- **Phase 3**: `reports`(reporter 검증·자기신고 차단·rate limit)를 Functions onCall로 이전
- **Phase 3**: `dailyLimits`(client count 쿼리 비용 문제)를 Functions로 이전
- **Phase 3**: `recommendations`(candidate query/filter/log)를 Functions로 이전
- **Phase 3-C**: admin role 검증을 Functions / Custom Claims로 이전 (현재 `requireAuthedUser`는 status만 보고 role은 안 봄 — admin-only endpoint용 헬퍼 미구현)
- **Phase 5**: 프로필/사진 승인을 Functions로 처리 (현재 `approvePendingPhotosForUser`는 client-side Firestore SDK 직접 호출)
- **Phase 9**: payments webhook endpoint (실 PG 연동). 현재 결제 상태 전이는 Functions(`completeMockPayment`)가 처리하지만 실제 결제 검증은 없음(mock) — 실 PG는 webhook + 서명 검증으로 `completeMockPayment` 본체를 대체
- **실운영 전**: 사업자등록, PG 계약, 약관/개인정보 법무, 본인확인 API 계약, 환불/신고/탈퇴 정책, 모니터링

### 알려진 위험

- **mock 결제의 본질적 한계**: 결제/권한 write는 Functions로 잠갔고 한도는 서버 `PLANS`로만 적용되지만, mock은 실제 결제 검증이 없어 "success"가 클라이언트 트리거다 → **사용자가 mock으로 premium 자체는 자가 획득 가능**(임의 한도 주입·타인 데이터 접근은 차단됨). 실 PG 결제 검증이 들어와야 닫힌다.
- **읽기 강화 미완**: `users`/`profiles`/`profilePhotos` read는 매칭·채팅 호환을 위해 authenticated로 열려 있다. `profiles`를 approved-only로 좁히려면 클라이언트 공개 조회 쿼리 변경 필요.
- `blocks`: client-side `createBlock`은 양방향 차단 검증이 없다(상대가 이미 차단했어도 재차단 가능). 중복은 deterministic ID로 막지만 문서 생성 비용 낭비. (rules는 blocker 본인만 create 허용으로 좁힘.)
- `reports`: client-side `createReport`는 reporter 검증·자기신고 차단·rate limit이 없다. 같은 target에 반복 신고 가능(deterministic ID로 덮어씀).
- `payments`: mock 상태가 client-side `updateDoc`. 실 PG 도입 시 webhook atomicity 필수.
- `requireAuthedUser`는 status만 검증하고 role(admin 권한)은 검증하지 않는다. admin-only endpoint에는 별도 헬퍼가 필요한데 아직 없다.
- `grant-admin.mjs`는 ADC / `GOOGLE_APPLICATION_CREDENTIALS`에 의존한다. 프로덕션에서 누가 실행하는지 운영 관리 필요.
- `reactions(fromUserId+type+createdAt)` composite index가 없으면 일일 한도 `count()` 쿼리가 실패한다 — 배포 시 index 반영 확인 필요.

> **참고 — 코드와 어긋났던 과거 문서 표현**
> - `reactions.ts`/`matches.ts`의 일부 TODO 주석은 "현재는 클라이언트에서 직접 write한다"고 적혀 있으나, 이는 outdated다. 현재 reaction/match 쓰기는 `react` onCall callable을 통해 Functions에서만 처리되며 client write는 rules로 차단된다(Phase 3-A 완료). 해당 TODO 주석은 정리 대상이다.
> - onboarding 상태 머신(auth_only → profile_required 등) 전환은 client-side `resolveEntryRoute`에만 정의되어 있고 Functions에서 강제하지 않는다(Phase 3 예정). `grant-admin.mjs`가 다루는 것은 `role`/`onboardingStatus`/`status` 직접 set뿐이다.
> - `profile.status`/`photo.status` 승인 변경은 아직 client-side Firestore SDK로 이뤄진다(`approvePendingPhotosForUser`). Functions 이전은 미구현이다.
