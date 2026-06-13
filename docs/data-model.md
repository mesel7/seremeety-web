# 데이터 모델 (Firestore 컬렉션) — seremeety-web

> **문서 목적**: 실제 코드가 사용하는 Firestore 컬렉션 인벤토리와 필드, 그리고 legacy(`users` 단일 문서 · `chat_rooms` · `requests`)와의 매핑을 *현재 구현 기준*으로 정리한다. 로드맵의 "할 일"이 아니라 지금 동작하는 상태를 기준으로 기술하며, 미구현/설계 초안은 §7에 분리한다.
>
> 이 문서는 루트의 구 `DATA_MODEL.md`(Phase 2-A design draft)를 대체하는 최신판이다. 구 문서의 "아직 어떤 컴포넌트도 import하지 않는다" 류 서술은 더 이상 사실이 아니다 — 신규 타입은 admin / onboarding / matching / profile / plan 전반에서 활발히 소비된다.
>
> 관련 문서:
> - [`architecture.md`](./architecture.md) — 전체 구조 / 권한 경계 / RTK Query
> - [`roadmap.md`](./roadmap.md) — 단계별 작업 계획 (Phase 1~11)
> - [`domains/auth-onboarding.md`](./domains/auth-onboarding.md) — onboarding 상태 머신 / entry route
> - [`domains/matching.md`](./domains/matching.md) — reactions / matches / 추천 엔진

---

## 1. 개요

데이터 모델은 **Phase 2(Auth/Onboarding 재설계)에서 도입한 신규 도메인 모델**과 **기존 페이지가 의존하는 legacy 컬렉션**이 공존하는 dual-write 과도기 상태다.

- **신규 모델**: 계정/운영 상태는 `users`(v2 — `onboardingStatus`/`role`/`status` 포함), 공개 프로필은 `profiles`, 비공개 선호는 `preferences`, 사진 메타데이터는 `profilePhotos`, 매칭 흐름은 `reactions`/`matches`, 권한/결제는 `entitlements`/`payments`로 **책임을 분리**한다. 도메인 타입은 [`src/shared/types/model/`](../src/shared/types/model)에, Firestore 헬퍼는 [`src/shared/lib/firebase/`](../src/shared/lib/firebase)에 있다.
- **legacy 모델**: 기존 `users/{uid}` 단일 문서(`UserProfile`)와 `chat_rooms`는 아직 살아 있다. [`legacyBridge.ts`](../src/shared/lib/firebase/legacyBridge.ts)가 신규 → legacy로 dual-write 하여 `MatchingPage`/`ProfilePage`/`ChatRoom` 등 기존 페이지가 변경 없이 동작한다. (`requests` 컬렉션은 `reactions`+`matches`로 대체되어 신규 쓰기 경로에서는 더 이상 쓰지 않는다.)

핵심 설계 축:

| 축 | 내용 |
|---|---|
| **계정 vs 프로필 분리** | `users`는 운영 상태(self/admin only), `profiles`는 공개 데이터(승인 시 노출), `preferences`는 비공개 선호(self only) |
| **승인 상태 일급화** | 구 `profileStatus 0\|1` → `ProfileStatus`(draft/pending/approved/rejected/deleted), 사진도 `PhotoStatus`로 개별 검수 |
| **server-authoritative onboarding** | `User.onboardingStatus` 8단계 상태 머신이 라우팅의 단일 진실원 |
| **deterministic doc id** | reactions/matches/blocks/reports는 페어/타깃 기반 결정적 id로 중복·복합 인덱스 회피 |
| **client-side 필터** | Firestore `where`는 `userId` 등 최소 필드만, `status`/`order`는 클라이언트에서 필터·정렬 |

---

## 2. 핵심 흐름

```
[가입] Phone Auth → getUserV2ByUid
         ├─ 신규: createNewUserV2(onboardingStatus='auth_only')
         └─ old-shape 감지: grandfatherExistingUser(→'approved')

[온보딩] getEntryState(user/profile/preference/photos/consent 병렬)
         → resolveEntryRoute
         → createDraftProfile → createProfilePhoto(status='pending')
         → createPreference → createConsent
         → setOnboardingStatus('review_pending')

[검수]  getPendingProfiles + getProfilePhotosByUserId(pending)
         → approveProfile(updateProfile('approved')
              + approvePendingPhotosForUser(batch)
              + setEntitlementPlan('free')
              + legacyBridge dual-write)

[추천]  getTodayRecommendations(entitlement.dailyRecommendationLimit,
              오늘 노출/react 제외, 차단 제외, shuffle)
         → createRecommendationLog(score=0)
         → react → (mutual like 시) createMatch + writeMatchToLegacyChatRoom

[결제]  createMockPayment('mock_pending')
         → completeMockPayment('mock_success'|'mock_failed')
         + setEntitlementPlan(planId)  // entitlements/{userId} merge upsert
```

---

## 3. 주요 파일

### 도메인 타입 (`src/shared/types/model/`)

| 파일 | 역할 |
|---|---|
| [`index.ts`](../src/shared/types/model/index.ts) | 13개 모델 타입 재export |
| [`user.ts`](../src/shared/types/model/user.ts) | `User` + `OnboardingStatus`/`UserRole`/`UserStatus` enum |
| [`profile.ts`](../src/shared/types/model/profile.ts) | `Profile` + `ProfileStatus`/`Gender`/`DatingIntent` 등 |
| [`preference.ts`](../src/shared/types/model/preference.ts) | `Preference`(비공개 선호) |
| [`photo.ts`](../src/shared/types/model/photo.ts) | `ProfilePhoto` + `PhotoStatus` |
| [`reaction.ts`](../src/shared/types/model/reaction.ts) | `Reaction` + `ReactionType` |
| [`match.ts`](../src/shared/types/model/match.ts) | `Match` + `MatchStatus` |
| [`message.ts`](../src/shared/types/model/message.ts) | `Message`(타입만, CRUD 미구현) |
| [`safety.ts`](../src/shared/types/model/safety.ts) | `Block` + `Report` |
| [`identity.ts`](../src/shared/types/model/identity.ts) | `IdentityVerification`(mock 상태만) |
| [`consent.ts`](../src/shared/types/model/consent.ts) | `Consent` |
| [`recommendation.ts`](../src/shared/types/model/recommendation.ts) | `RecommendationLog` |
| [`billing.ts`](../src/shared/types/model/billing.ts) | `Entitlement` + `Payment` |
| [`../domain.ts`](../src/shared/types/domain.ts) | **legacy** `UserProfile`(`profileStatus: 0\|1`), `ChatRoomRecord`, `ChatMessageRecord` |

### Firestore 헬퍼 (`src/shared/lib/firebase/`)

| 파일 | 역할 |
|---|---|
| [`usersV2.ts`](../src/shared/lib/firebase/usersV2.ts) | 신규 `User` read/write. `createNewUserV2`/`grandfatherExistingUser`/`setOnboardingStatus`/`setUserRole`/`setUserStatus`/`getUsersByStatus` |
| [`profiles.ts`](../src/shared/lib/firebase/profiles.ts) | `profiles` CRUD. `getProfileByUserId`/`getProfilesByStatus`/`createDraftProfile`/`updateProfile` |
| [`preferences.ts`](../src/shared/lib/firebase/preferences.ts) | `preferences` CRUD |
| [`profilePhotos.ts`](../src/shared/lib/firebase/profilePhotos.ts) | `profilePhotos` CRUD. `createProfilePhoto`(pending 초기), `setMainProfilePhoto`/`approvePendingPhotosForUser`(batch). `MAX_PROFILE_PHOTOS=6` |
| [`reactions.ts`](../src/shared/lib/firebase/reactions.ts) | `reactions` CRUD. deterministic `pairId`(`from_to`) |
| [`matches.ts`](../src/shared/lib/firebase/matches.ts) | `matches` CRUD. deterministic `matchKey`(정렬된 `a_b`) |
| [`blocks.ts`](../src/shared/lib/firebase/blocks.ts) | `blocks` CRUD. `getBlockedUserIds`/`getBlockerUserIds`/`isBlockedBetween` |
| [`reports.ts`](../src/shared/lib/firebase/reports.ts) | `reports` CRUD. deterministic `reportKey`(중복 신고 방지), `reviewReport` |
| [`consents.ts`](../src/shared/lib/firebase/consents.ts) | `consents` CRUD. `getLatestConsentByUserId` |
| [`identityVerifications.ts`](../src/shared/lib/firebase/identityVerifications.ts) | `identityVerifications` CRUD. `createDefaultIdentityVerification`(`none`/`not_started`) |
| [`entitlements.ts`](../src/shared/lib/firebase/entitlements.ts) | `entitlements`(doc id=`userId`). `setEntitlementPlan`(merge upsert) |
| [`payments.ts`](../src/shared/lib/firebase/payments.ts) | `payments` CRUD. `createMockPayment`/`completeMockPayment` |
| [`recommendationLogs.ts`](../src/shared/lib/firebase/recommendationLogs.ts) | `recommendationLogs` CRUD |
| [`recommendations.ts`](../src/shared/lib/firebase/recommendations.ts) | 추천 후보 필터링. `getTodayRecommendations`, `FREE_RECOMMENDATION_LIMIT=5` |
| [`legacyBridge.ts`](../src/shared/lib/firebase/legacyBridge.ts) | **신규 → legacy dual-write 어댑터** (§5 참조) |
| [`serialize.ts`](../src/shared/lib/firebase/serialize.ts) | `toPlainTimestamps`(Firestore Timestamp → plain, Redux 직렬화 호환) |
| [`normalizers.ts`](../src/shared/lib/firebase/normalizers.ts) | **legacy** old-shape 정규화(`normalizeUserProfile`/`normalizeChatRoom`) |

### RTK Query (`src/shared/lib/api/`)

| 파일 | 역할 |
|---|---|
| [`baseApi.ts`](../src/shared/lib/api/baseApi.ts) | `fakeBaseQuery` 기반 base API + tagTypes 정의 |
| [`entryStateApi.ts`](../src/shared/lib/api/entryStateApi.ts) | `getEntryState`(user/profile/preference/photos/consent 병렬) → 라우팅 결정 데이터 |
| [`profileApi.ts`](../src/shared/lib/api/profileApi.ts) | **legacy** `UserProfile` 기반(`getMe`/`updateMe`). Phase 6 통합 대상 |
| [`reactionApi.ts`](../src/shared/lib/api/reactionApi.ts) | `react`는 `httpsCallable` Functions, 조회는 client read |
| [`matchApi.ts`](../src/shared/lib/api/matchApi.ts) · [`photoApi.ts`](../src/shared/lib/api/photoApi.ts) · [`adminApi.ts`](../src/shared/lib/api/adminApi.ts) | match/photo read, admin 검수·운영 |

---

## 4. 데이터·상태 — 컬렉션 인벤토리

아래는 **실제 코드가 읽고/쓰는** 컬렉션이다. 가시성은 코드의 호출 패턴 + 의도된 firestore.rules 가정이며, 실제 보안 규칙 파일은 아직 정비 전이다(§7 위험 참조).

| 컬렉션 | 역할 | 가시성(의도) | 주요 필드 | 신규 vs legacy |
|---|---|---|---|---|
| `users` | 계정·운영 상태 | self/admin | `role`, `status`(active/suspended/deleted), `onboardingStatus`(8단계), `authProvider`, `phoneAuthVerified`, `phoneNumberMasked` | **재정의** — 구 `users` 단일 문서에 `onboardingStatus`/`role`/`status` 추가 |
| `profiles` | 공개 프로필 | `approved`일 때 추천 대상 노출 | `userId`, `nickname`, `birthYear`(+`birthMonth`/`birthDay`), `gender`, `location`(+`locationDistrict`), `height`, `mbti`, `university`, `bio`, `tags`, `mainPhotoId`, `status` | 신규 (구 `users` 단일 문서에서 분리) |
| `preferences` | 매칭 선호(비공개) | self only | `userId`, `targetGender`, `minAge`/`maxAge`, `preferredLocations`, `minHeight`/`maxHeight`, `preferredDatingIntent`, `dealBreakers` | 신규 |
| `profilePhotos` | 사진 메타 + 승인 상태 | 승인 사진만 노출 | `userId`, `profileId`, `storagePath`, `displayUrl`, `order`, `isMain`, `status`(uploading/pending/approved/rejected/deleted) | 신규 (구 `users.profilePictureUrl` 단일 필드 대체) |
| `reactions` | 좋아요/패스/슈퍼좋아요 | from=self read/write, to=self read | `fromUserId`, `toUserId`, `type`(like/pass/superLike), `createdAt`. doc id=`from_to` | 신규 (`requests` 대체) |
| `matches` | 상호 좋아요 결과 | 양 당사자 only | `userIds[2]`(정렬됨), `createdByReactionIds`, `status`(active/unmatched/blocked/deleted). doc id=정렬된 `a_b` | 신규 (`requests` 대체) |
| `messages` | 매칭 후 대화 | 당사자 only | `matchId`, `senderId`, `body`, `status`(sent/deleted/reported) | **타입만 정의, CRUD 헬퍼 미구현** (현재 채팅은 legacy `chat_rooms` 사용) |
| `blocks` | 사용자 차단 | self only | `blockerUserId`, `blockedUserId`, `reason?`. doc id=`blocker_blocked` | 신규 |
| `reports` | 신고 기록 | reporter/admin | `reporterUserId`, `targetType`(profile/photo/message/user), `targetId`, `reason`, `status`(open/reviewing/resolved/dismissed). doc id=`reporter_targetType_targetId` | 신규 |
| `consents` | 약관/개인정보 동의 이력 | self/admin | `userId`, `termsVersion`, `privacyVersion`, `marketingAgreed`, `agreedAt` | 신규 |
| `identityVerifications` | 본인확인 상태(mock) | self/admin | `provider`(default `none`), `status`(default `not_started`), `ciHash?`/`diHash?`(현재 미저장) | 신규 (타입/default만) |
| `entitlements` | 권한 상태 | self only | doc id=`userId`. `planId`(free/premium), `dailyRecommendationLimit`/`dailyLikeLimit`/`dailySuperLikeLimit`, `canUseAdvancedFilter`, `canSeeReceivedLikes` | 신규 (구 `users.coin` 폐기) |
| `payments` | mock 결제 기록 | self/admin | `provider`(mock/future_pg), `planId`, `amount`, `currency`(`KRW`), `status`(mock_pending/mock_success/mock_failed/cancelled/refunded) | 신규 |
| `recommendationLogs` | 추천 노출/반응 이력 | server only | `userId`, `recommendedUserId`, `score`(현재 항상 0), `reasonCodes`, `shownAt`, `reactedAt?` | 신규 |
| `chat_rooms` | **legacy** 채팅방 + `/messages` 서브컬렉션 | 당사자 | `users[2]`, `lastMessage`, `createdAt` | **legacy, active** — `matches`+`messages`로 흡수 예정이나 Phase 6 전까지 채팅의 실제 저장소 |

> 구 `DATA_MODEL.md`가 별도 컬렉션으로 가정했던 `adminReviews`와 `plans`는 **실제로 존재하지 않는다**. admin 검수는 `getPendingProfiles` + `getPhotosByStatus` 조합으로 처리하며, 플랜 한도는 Firestore가 아니라 메모리 정의(`getPlanDefinition` in `src/shared/lib/billing/plans`)에서 가져와 `entitlements` 문서에 펼쳐 저장한다.

### 상태 enum 요약

| enum | 값 |
|---|---|
| `OnboardingStatus` | `auth_only` → `profile_required` → `photo_required` → `preference_required` → `consent_required` → `review_pending` → `{approved \| review_rejected}` |
| `UserStatus` | `active` / `suspended` / `deleted` (onboarding과 직교) |
| `ProfileStatus` | `draft` / `pending` / `approved` / `rejected` / `deleted` |
| `PhotoStatus` | `uploading` / `pending` / `approved` / `rejected` / `deleted` (신규 사진은 바로 `pending`) |
| `MatchStatus` | `active` / `unmatched` / `blocked` / `deleted` |
| `PaymentStatus` | `mock_pending` / `mock_success` / `mock_failed` / `cancelled` / `refunded` |

### 직렬화

모든 read 헬퍼는 [`toPlainTimestamps`](../src/shared/lib/firebase/serialize.ts)로 Firestore `Timestamp`를 plain object(`{ seconds }`)로 변환한 뒤 반환한다. RTK Query 캐시/Redux store가 non-serializable 값을 거부하기 때문이다.

---

## 5. legacy bridge (dual-write)와 `chatRooms` 관계

[`legacyBridge.ts`](../src/shared/lib/firebase/legacyBridge.ts)는 Phase 2-C/5-A 과도기 어댑터로, 신규 컬렉션에 쓴 데이터를 **구 `users/{uid}` 문서와 `chat_rooms`에도 동시에 반영**한다. 덕분에 아직 마이그레이션하지 않은 `MatchingPage`/`ProfilePage`/`ChatRoom`이 변경 없이 동작한다.

| bridge 함수 | 신규 → legacy 매핑 |
|---|---|
| `writeProfileToLegacyUser` | `nickname` → `nickname`, `birthYear` → `birthdate`(`YYYY-01-01`) + `age`(런타임 계산), `gender`, `location` → `place`, `bio` → `introduce`, `mbti`, `university` |
| `writePhotoToLegacyUser` | 메인 사진 `displayUrl` → `users.profilePictureUrl` |
| `writeProfileStatusToLegacyUser` | `ProfileStatus==='approved'` → `profileStatus: 1`(추천 노출), 그 외 → `0`(비공개) |
| `writeMatchToLegacyChatRoom` | `Match` 생성 시 같은 페어로 `chat_rooms` 채팅방 생성 → ChatList/ChatRoom이 그대로 동작 |

**`chatRooms`(= legacy)와 `matches`(= 신규)의 관계**: `matches` 문서 id는 정렬된 `userA_userB`(`matchKey`)이고, `createMatch` 호출 흐름에서 `writeMatchToLegacyChatRoom`이 동일 페어로 `chat_rooms` 문서를 만든다. 즉 **현재 채팅의 실제 저장소는 여전히 `chat_rooms`/`chat_rooms/{id}/messages`이고**, 신규 `messages` 컬렉션은 타입만 존재한다. 채팅을 `matches` + `messages` 기반으로 전환하는 것은 Phase 6 작업이며, 그때 bridge와 `chat_rooms`가 폐기된다.

> dual-write이므로 신규 `profiles` 쓰기와 legacy `users` 반영 사이에 짧은 시차/불일치가 생길 수 있다(원자성 없음). Phase 3에서 Functions로 이동하며 해소 예정.

### 마이그레이션 매핑 (설계 초안 — 일괄 마이그레이션 미실행)

아래 매핑은 여전히 유효한 참고 자료이나, **대량 데이터 마이그레이션 스크립트는 실행되지 않았다.** 현재는 신규 사용자만 신규 모델로 생성되고, 기존 사용자는 grandfather 로직으로 처리된다.

| 현재(legacy) | 신규 | 처리 |
|---|---|---|
| `users.phone` | `phoneNumberMasked` + `phoneAuthVerified` | 평문 저장 X |
| `users.profileStatus 0` | `onboardingStatus='profile_required'` / `profile.status='draft'` | — |
| `users.profileStatus 1` | `onboardingStatus='approved'` / `profile.status='approved'` | grandfather 시 일괄 approved |
| `users.{nickname,birthdate,gender,place,introduce,mbti,university}` | `profiles` 동명 필드 | `birthdate`→`birthYear`, `age`는 저장 안 함 |
| `users.profilePictureUrl` | `profilePhotos.displayUrl` + `profile.mainPhotoId` | — |
| `users.coin` | **매핑 없음 — 폐기** | `entitlements`의 일일 한도로 일원화. 기존 `coin` 필드는 남아 있을 수 있으나 bridge가 다루지 않음 |
| `requests` | `reactions`(단방향) + `matches`(상호) | accepted → 양쪽 reaction + active match |
| `chat_rooms` (+ `/messages`) | `matches` + `messages` | Phase 6 전환 |

**grandfather 로직(구현됨)**: `grandfatherExistingUser`가 `onboardingStatus` 필드가 없는 old-shape `users/{uid}`를 감지하면 `onboardingStatus='approved'`로 자동 마크한다. 신규 사용자는 `createNewUserV2`로 `auth_only`에서 시작하므로 신규/기존 경로가 명확히 이원화된다. (구 문서의 "기존 사용자 마이그레이션 무시"는 부정확 — 무시가 아니라 grandfather로 처리한다.)

---

## 6. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| **Deterministic doc id**(`pairId`/`matchKey`/`reportKey`/`blockId`) | composite index 회피 + 중복 작성 방지 + idempotency. `setDoc`로 같은 페어 재작성 시 덮어쓰기 | 생성 시간이 doc id에 없어 id 정렬 불가. 같은 페어 재작성 시 의도치 않은 overwrite 위험 |
| **`where`는 `userId`만, status/order는 클라이언트** | composite index 비용 절감. 사용자당 데이터가 선형(사진 ≤6) | 전체 fetch 필요 → 대규모 데이터에서 부적합. 추후 인덱스 필요 |
| **신규 사진 `status='pending'` 초기화** | 프로필 승인과 별개로 사진 품질 개별 검수 | 신규 사진 즉시 노출 불가, 검수 큐 운영 비용 |
| **`User.onboardingStatus`가 라우팅 단일 진실원** | 일관된 라우팅. 필드 누락/불완전 상태 회피. profile/preference/photos는 prefill·cross-check용 | onboardingStatus와 실제 데이터 정합성 책임이 호출 측(Phase 3 Functions로 원자화 예정) |
| **`entitlements` doc id = `userId`, `setEntitlementPlan`은 merge upsert** | doc 부재 가능한 기존 사용자도 대응(`updateDoc`은 throw). premium 전환 시 한도+`startsAt` 동시 갱신 | merge 부분 갱신 의존. `createdAt` 부재로 entitlement 생성 시점 추적 불가 |
| **본인확인은 타입/default만, 실 provider 미연동** | CI/DI/실명은 법무 검토·약관 정비 필요(ROADMAP §3.7) | 타입 정의와 실사용 괴리. 실운영 전 구현 필수 |
| **`baseApi`는 `fakeBaseQuery`, queryFn에서 firebase 헬퍼 직접 호출** | Phase 3 Functions 도입 시 queryFn 본체만 교체, 컴포넌트 무변경 | Functions 전까지 클라이언트 쓰기 권한 의존 → firestore.rules 정밀 제어 필수 |
| **`legacyBridge` dual-write** | 기존 페이지 변경 최소화, 단계적 이전 | 동기화 시차. Phase 6 완료 후 폐기 필요 |
| **coin 폐기 → entitlement 일일 한도 일원화** | 권한을 한도 모델로 명확히 표현 | 기존 `users.coin` 잔존 가능(마이그레이션 미실행) |

---

## 7. 현재 상태

### 구현됨

- 신규 13개 도메인 타입 정의([`types/model/`](../src/shared/types/model)) + 14개 컬렉션 Firestore 헬퍼([`lib/firebase/`](../src/shared/lib/firebase))
- `users`(v2) 계정/운영 상태 + `onboardingStatus` 8단계 상태 머신, `grandfatherExistingUser` old-shape 처리
- `resolveEntryRoute` 라우팅(이미 `AuthEntryPage`/`AuthenticatedRouteGate`에서 `useGetEntryStateQuery`로 wire-up 완료. 라우트명은 `/matching`으로 통일 — 구 문서의 `/recommendations`가 아님)
- admin 검수 흐름(`getPendingProfiles` + `getPhotosByStatus` + `approveProfile`/`rejectProfile`/`approvePendingPhotosForUser` batch)
- 추천 엔진 기본(`getTodayRecommendations`: 한도/오늘 노출·react/차단 제외 + shuffle)
- `reactions`/`matches`/`blocks`/`reports` deterministic id CRUD, `entitlements`/`payments`(mock) CRUD
- `legacyBridge` dual-write(신규 `Profile` ↔ legacy `UserProfile`, `Match` ↔ `chat_rooms`)
- `toPlainTimestamps` 직렬화, RTK Query slice 전반(`entryStateApi`/`reactionApi`/`matchApi`/`photoApi`/`adminApi` 등)
- 신규 타입은 admin/onboarding/profile/matching/plan 페이지에서 **실제로 import·소비 중**(구 문서의 "미사용" 서술은 stale)

### 남은 작업 (설계 초안 / Phase 3·6)

- **Phase 3 Functions 이동**: `react`/`createMatch`/`createReport`/`createReaction`의 서버화 — daily limit·차단·자기 자신·mutual like 검증과 batch write를 서버로 (현재 일부는 클라이언트 쓰기)
- **`messages` 컬렉션 구현**: 현재 타입만 존재. 채팅은 여전히 legacy `chat_rooms` 사용. Phase 6에 `matches`+`messages`로 전환하며 bridge·`chat_rooms` 폐기
- **Phase 6 RTK Query 마이그레이션**: `ProfilePage`/`MyProfilePage`/`MatchingPage`를 신규 타입 기반으로, legacy `profileApi`(`getMe`/`updateMe`) → `getUserV2`+`getProfileByUserId`+`getPreferenceByUserId` 통합
- **본인확인 실연동**: NICE/KMC/PASS + CI·DI 저장 정책(현재 `none`/`not_started` default만)
- **결제 PG 연동**: `createMockPayment` → 실 PG SDK/webhook
- **firestore.rules 정비**: `reactions`/`matches`/`reports` 쓰기 제한, admin-only 검수, `profiles` approved-only 읽기. 현재 별도 규칙 문서 없음
- **composite index 검토/생성**, admin 역할 검증 서버 이동, daily limit KST 카운터 정확도, 거부 후 재제출 전이 상세화
- **추천 점수화**: `RecommendationLog.score`가 현재 항상 0, `reasonCodes` 빈 배열
- **`profile.tags` 어휘 확정**: 실제 tags enum 미정(온보딩 form 임시 어휘)

### 알려진 위험

- **데이터 정합성**: `legacyBridge` dual-write 시차 — 신규 `profiles` 쓰기 후 legacy `users` 반영까지 비원자적
- **보안 gap**: `react`/`createReport`/`createMatch`/`createReaction`이 현재 클라이언트 write이며 firestore.rules에만 의존. Functions 전까지 조작 가능성
- **admin 권한**: `role==='admin'` 클라이언트 체크 + firestore.rules의 분산 방어 — 시간차 exploit 여지
- **확장성**: client-side 필터링(status/order)은 데이터 증가 시 성능 악화
- **overwrite 위험**: deterministic id(`pairId` 등)는 같은 페어 업데이트 시도 시 기존 문서를 덮어씀
- **grandfather 신뢰성**: `onboardingStatus` 필드 유무가 유일한 버전 식별자 — 필드 누락 버그에 취약
- **사진 검수 지연**: 신규 사진 `pending` 기본값 → 노출 지연으로 이탈 위험
- **`identityVerifications` 빈 schema**: 향후 CI/DI 저장 시 마이그레이션 복잡도
- **`entitlements` 잔존 `coin`**: 기존 `users.coin` 미정리, bridge 미처리
