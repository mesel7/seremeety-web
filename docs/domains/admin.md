# 관리자 / 백오피스 / 신고 / 차단 / 심사 — seremeety-web

> 관리자 콘솔(`/admin/**`)에서 프로필·사진 검수, 신고 처리, 사용자 정지/복구, 권한·플랜 관리를 수행하는 운영 도메인. 차단·신고는 일반 사용자 측 인터페이스도 포함한다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / 권한 경계 / 라우트 그룹
> - [`roadmap.md`](../roadmap.md) — Phase 8(admin/moderation), Phase 3(권한 서버화) 계획
> - [`data-model.md`](../data-model.md) — 컬렉션·필드 정의 (현재 구현 기준)
> - [`functions-security.md`](./functions-security.md) — 서버 경계 / Security Rules 현황

---

## 1. 개요

관리자 백오피스는 세 가지 운영 책임을 한 콘솔에서 다룬다.

| 영역 | 페이지 | 핵심 동작 |
|---|---|---|
| 검수 큐 | `AdminProfilesPage` | 사용자 단위로 프로필 + 그 사용자의 모든 사진을 한 카드에 묶어 승인/반려 |
| 신고 처리 | `AdminReportsPage` | `status='open'` 신고를 기각 / 처리 완료 / 대상 정지로 종결 |
| 사용자 관리 | `AdminUsersPage` | 수동 정지·복구, 권한(admin/user) 부여·회수, 플랜 강제 변경 |

`/admin/**` 라우트는 모두 [`AdminRouteGate`](../../src/shared/providers/AdminRouteGate.tsx)로 감싸며 `uid`와 `role==='admin'`을 둘 다 만족해야 통과한다. 현재 권한 검증은 **클라이언트 가드 + 클라이언트 RTK Query mutation(Firestore 직접 write)** 에 의존하고, Functions로의 이전은 Phase 3 작업으로 남아 있다(§6 참고).

일반 사용자 측에는 **신고**([`ReportModal`](../../src/shared/components/common/report-modal/ReportModal.tsx))와 **차단**([`blocks.ts`](../../src/shared/lib/firebase/blocks.ts)) 인터페이스가 있으며, 이 두 흐름이 admin 신고 큐와 추천 제외로 이어진다.

### 검수 상태는 별도 컬렉션이 아니다

`DATA_MODEL.md`(Phase 2-A draft)는 `adminReviews` 컬렉션을 admin 전용으로 제시하지만, **실제 구현에는 `adminReviews`가 없다.** 검수 상태는 `profiles` / `profilePhotos` 문서의 상태 필드(`status`, `rejectionReason`, `reviewedBy`, `reviewedAt`)로 직접 관리한다.

---

## 2. 핵심 흐름

### 2.1 통합 검수 큐 — 승인

[`getReviewQueue`](../../src/shared/lib/api/adminApi.ts)는 `pending` 프로필과 `pending` 사진을 병렬로 fetch한 뒤, 등장하는 모든 `userId`에 대해 user·profile·photos를 다시 병렬 조회해 사용자 단위 카드(`ReviewQueueItem`)로 묶는다. `role==='admin'` 사용자는 큐에서 제외한다(운영자는 검수 대상이 아님).

`approveProfile` mutation:

1. 프로필이 `pending`이면 `Profile.status → 'approved'`, `reviewedAt`/`reviewedBy` 기록.
2. 그 사용자의 모든 pending 사진을 `approvePendingPhotosForUser`로 일괄 승인.
3. 프로필이 pending이었던 경우에만 `writeProfileStatusToLegacyUser(userId, true)`(legacy `users.profileStatus=1` dual-write) + `setOnboardingStatus(userId, 'approved')`.

> 사진만 pending이고 프로필은 이미 `approved`인 경우(승인된 사용자가 사진 추가/교체)는 1·3단계를 건너뛰고 사진만 처리한다.

### 2.2 통합 검수 큐 — 반려

`rejectProfile` mutation은 **반려 사유를 페이지에서 필수 입력**으로 강제한다.

- `Profile.rejectionReason`에 사유 기록(빈 값이면 `''`).
- 프로필이 `pending`이면 `status → 'rejected'`. 이미 `approved`인 사용자(사진 추가 검수 케이스)는 `status='approved'`를 유지하고 onboarding만 전이.
- `writeProfileStatusToLegacyUser(userId, false)` + `setOnboardingStatus(userId, 'review_rejected')`.

→ 사용자는 다음 진입에서 RejectedPage를 보고 재제출할 수 있다(재제출 시 `profile_required` / `photo_required`로 복귀).

### 2.3 신고 처리

[`AdminReportsPage`](../../src/features/admin/AdminReportsPage.tsx)는 `useGetOpenReportsQuery`로 `status='open'` 신고를 조회하고 항목별로 세 액션을 제공한다.

| 액션 | 처리 |
|---|---|
| 기각 | `dismissReport` → `status='dismissed'` |
| 처리 완료 | `resolveReport` → `status='resolved'` |
| 대상 정지 | `setUserStatus(targetUserId, 'suspended')` **+** `resolveReport(resolutionNote: 'escalated_to_suspend')` |

"대상 정지"는 두 mutation을 순차 호출하는 UI 합성이며, `resolutionNote`에 `'escalated_to_suspend'` 마커를 남긴다(전용 status 값은 없음). 모든 처리에는 선택 메모(`resolutionNote`)를 함께 기록할 수 있고 `reviewedBy`/`reviewedAt`이 남는다.

신고 생성([`createReport`](../../src/shared/lib/firebase/reports.ts))은 `reportKey = reporterUserId_targetType_targetId`를 결정적 doc id로 사용한다 — 같은 사용자가 같은 타깃을 재신고하면 마지막 사유로 덮어쓴다.

### 2.4 사용자 정지 / 복구

- **정지**: `setUserStatus(uid, 'suspended')` → `status!=='active'`이면 `writeProfileStatusToLegacyUser(uid, false)`로 legacy `profileStatus=0` dual-write. 추천 후보에서 즉시 제외되고, 다음 진입에서 [`SuspendedPage`](../../src/features/account/SuspendedPage.tsx)로 강제(로그아웃만 가능).
- **복구**: 정지 사용자 목록(`getSuspendedUsers`, `status='suspended'`)에서 `setUserStatus(uid, 'active')`. 단 **복구해도 `profileStatus`는 복원되지 않으므로** 매칭에 다시 노출되려면 사용자가 직접 활성화하거나 admin이 별도로 `profileStatus=1`을 처리해야 한다.

### 2.5 권한 / 플랜 관리

- **권한 부여**: `setUserRole(uid, 'admin')` → onboardingStatus가 `approved`가 아니면 함께 `approved`로 전이([`usersV2.setUserRole`](../../src/shared/lib/firebase/usersV2.ts))해 운영자가 곧장 `/admin`에 진입. `EntryState` 캐시 무효화.
- **권한 회수**: `setUserRole(uid, 'user')` → onboarding 상태는 건드리지 않음(정책 미정, §6 위험 참고).
- **플랜 변경**: `setUserPlan(uid, planId)` → [`setEntitlementPlan`](../../src/shared/lib/firebase/entitlements.ts)으로 entitlement만 upsert. **payments 기록을 만들지 않는다**(결제가 아니라 운영자 보정). 자세한 결제 흐름은 형제 도메인 [`payment-entitlement`](./payment-entitlement.md) 참고.
- **부트스트랩**: 최초 admin은 [`grant-admin.mjs`](../../functions/scripts/grant-admin.mjs) CLI(firebase-admin SDK, ADC 필요)로 `role='admin'` + `onboardingStatus='approved'`를 seed하고, 이후 admin 추가/제거는 웹 콘솔의 `setUserRole`로 처리한다.

---

## 3. 주요 파일

### 라우팅 / 가드

| 파일 | 역할 |
|---|---|
| [`(admin)/admin/layout.tsx`](<../../src/app/(admin)/admin/layout.tsx>) | `AdminRouteGate` + `AdminLayout` 래핑 |
| [`AdminRouteGate.tsx`](../../src/shared/providers/AdminRouteGate.tsx) | `uid` + `role==='admin'` 검증, 미충족 시 `/matching`(미로그인은 `/`)로 redirect |
| [`AdminLayout.tsx`](../../src/features/admin/AdminLayout.tsx) | 콘솔 네비게이션 / 로그아웃 (검수 큐 nav만 노출, 단건 사진 검수는 숨김) |

### 페이지 컴포넌트

| 파일 | 역할 |
|---|---|
| [`AdminOverviewPage.tsx`](../../src/features/admin/AdminOverviewPage.tsx) | 대시보드: 검수 대기 / 처리 대기 신고 / 정지 사용자 카운트 카드 (큐와 같은 소스로 카운트 일관성) |
| [`AdminProfilesPage.tsx`](../../src/features/admin/AdminProfilesPage.tsx) | 통합 검수 큐: 프로필 + 사진 그리드 + 반려 사유 입력, 승인/반려 |
| [`AdminPhotosPage.tsx`](../../src/features/admin/AdminPhotosPage.tsx) | 단건 사진 검수 fallback (nav 숨김) |
| [`AdminReportsPage.tsx`](../../src/features/admin/AdminReportsPage.tsx) | 신고 큐: 기각 / 처리 완료 / 대상 정지 |
| [`AdminUsersPage.tsx`](../../src/features/admin/AdminUsersPage.tsx) | 수동 정지, 권한 부여/회수, 플랜 변경, 정지 사용자 목록 + 복구 |
| [`SuspendedPage.tsx`](../../src/features/account/SuspendedPage.tsx) / [`DeletedPage.tsx`](../../src/features/account/DeletedPage.tsx) | 정지·탈퇴 상태 UI (로그아웃만 가능) |
| [`ReportModal.tsx`](../../src/shared/components/common/report-modal/ReportModal.tsx) | 사용자 신고 모달 (6가지 사유 + 선택 설명) |

### API / Firestore 레이어

| 파일 | 역할 |
|---|---|
| [`adminApi.ts`](../../src/shared/lib/api/adminApi.ts) | RTK Query: 검수 큐 / 신고 / 사용자·권한·플랜 mutation (14개 hook) |
| [`reportApi.ts`](../../src/shared/lib/api/reportApi.ts) | RTK Query: 사용자 신고 생성 |
| [`blockApi.ts`](../../src/shared/lib/api/blockApi.ts) | RTK Query: 차단 목록 조회 / 양방향 차단 확인 / 차단 생성(optimistic) |
| [`reports.ts`](../../src/shared/lib/firebase/reports.ts) | Firestore: 신고 생성/조회/상태 전이 (결정적 doc id) |
| [`blocks.ts`](../../src/shared/lib/firebase/blocks.ts) | Firestore: 차단 생성/조회 (`blockerUserId_blockedUserId` 결정적 id, 양방향 제외) |
| [`usersV2.ts`](../../src/shared/lib/firebase/usersV2.ts) | Firestore: User v2 CRUD (`role`/`status`/`onboardingStatus` 전이) |
| [`profiles.ts`](../../src/shared/lib/firebase/profiles.ts) / [`profilePhotos.ts`](../../src/shared/lib/firebase/profilePhotos.ts) | Firestore: 상태별 조회, 사진 일괄 승인, 메인 사진 지정 |
| [`entitlements.ts`](../../src/shared/lib/firebase/entitlements.ts) | Firestore: entitlement 플랜 변경(admin 보정) |
| [`legacyBridge.ts`](../../src/shared/lib/firebase/legacyBridge.ts) | Firestore dual-write: 신규 Profile ↔ 기존 `users.profileStatus` 동기화 |
| [`grant-admin.mjs`](../../functions/scripts/grant-admin.mjs) | 최초 admin seed CLI (firebase-admin SDK) |
| [`firestore.rules`](../../firestore.rules) | Security Rules: 현재 `reactions`/`matches`만 Functions-only(§4) |

### 타입

| 파일 | 역할 |
|---|---|
| [`safety.ts`](../../src/shared/types/model/safety.ts) | `Block`, `Report`, `ReportTargetType`, `ReportStatus` |
| [`user.ts`](../../src/shared/types/model/user.ts) | `User`, `UserRole`, `UserStatus`, `OnboardingStatus` |
| [`profile.ts`](../../src/shared/types/model/profile.ts) | `Profile`, `ProfileStatus` |
| [`photo.ts`](../../src/shared/types/model/photo.ts) | `ProfilePhoto`, `PhotoStatus` |

---

## 4. 데이터·상태

### 상태 enum (v2 모델)

| 타입 | 값 |
|---|---|
| `UserRole` | `user` · `admin` |
| `UserStatus` | `active` · `suspended` · `deleted` |
| `OnboardingStatus` | `auth_only` → `profile_required` → … → `pending` → `approved` / `review_rejected` |
| `ProfileStatus` | `draft` · `pending` · `approved` · `rejected` · `deleted` |
| `PhotoStatus` | `uploading` · `pending` · `approved` · `rejected` · `deleted` |
| `ReportStatus` | `open` · `resolved` · `dismissed` |

### 결정적 doc id

| 컬렉션 | doc id 규칙 | 목적 |
|---|---|---|
| `reports` | `reporterUserId_targetType_targetId` | 같은 타깃 중복 신고를 한 건으로 덮어쓰기 |
| `blocks` | `blockerUserId_blockedUserId` | 중복 차단 방지 |

### RTK Query 캐시 태그

- 검수/사용자 변경 mutation → `AdminReview`, `Profile`, `Photo`, `Me`, `Recommendation`, `EntryState`, `Entitlement` 중 관련 태그 무효화로 큐·진입 라우트·추천을 재페치.
- 현재 캐시 전략은 부분 무효화가 아닌 **full refetch** 중심(대량 심사 시 비효율, §6).

### auth slice

[`authSlice`](../../src/shared/lib/store/authSlice.ts)가 `uid`/`role`/초기화 상태를 보관하고, `selectIsAuthLoading`으로 부트스트랩 진행 여부를 판단해 `AdminRouteGate`가 로딩 중 깜빡임 없이 가드한다.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| 프로필+사진 **통합 검수 큐**(사용자 단위 카드) | 한 사용자의 모든 검수 대상을 한 화면에서 한 번에 판단 | 단건 사진 검수는 fallback(nav 숨김). "특정 사진만 반려" 같은 세분화 검수는 미지원 |
| **반려 사유 필수 입력** + 사용자에게 그대로 노출 | 재제출 개선 유도 / 무분별 반려 방지 | 매번 사유 작성 필요, 템플릿·빠른 선택 UI 없음 |
| 신고 **결정적 doc id** + 마지막 사유 덮어쓰기 | 중복 신고로 큐가 부풀지 않게 | 신고 이력 추적은 status 전이로만 보충, 다건 분리 처리 불가 |
| 정지 시 **legacy `profileStatus=0` dual-write** | 추천 흐름이 old `users` 기반이라 즉시 매칭 제외 보장 | Phase 2-C 마이그레이션 후 bridge 제거 시 같이 제거 필요(이중 쓰기 부담) |
| admin 부여 시 **`onboardingStatus='approved'` 자동 전이** | 운영자가 온보딩 없이 곧장 `/admin` 진입 | 권한 회수 시 onboarding 미복구 — admin↔일반 사용자 혼재 정책 부재 |
| 플랜 변경은 **entitlement 직접 upsert**(payments 없음) | 결제 없이 한도만 보정, 실제 결제 기록과 구분 | 변경 이력이 `entitlements.updatedAt`만 남고 감사 로그 없음 |
| **클라이언트 가드 + 클라이언트 mutation**(Firestore 직접 write) | 초기 구현 속도 — Rules·Functions는 Phase 3에서 단계 강화 | 검증이 클라이언트에 의존, Rules가 약할 때 우회 가능(§6) |

---

## 6. 현재 상태

### 구현됨

- 프로필+사진 통합 검수 큐 UI + 승인/반려 mutation (반려 사유 필수)
- 신고 조회 및 처리 (기각 / 처리 완료 / 대상 정지)
- 사용자 정지/복구 (legacy `profileStatus` dual-write 포함)
- 권한 부여/회수 (`grant-admin.mjs` seed + 웹 콘솔)
- 플랜 강제 변경 (entitlement upsert, payments 미생성)
- `AdminRouteGate` 클라이언트 가드 + `resolveEntryRoute` 기반 onboarding 라우팅
- 사용자 신고(`ReportModal`, 6가지 사유) + 차단(양방향 제외, optimistic update)
- 정지·탈퇴 상태 페이지 (`SuspendedPage` / `DeletedPage`)
- v2 타입 모델 (`User`/`Profile`/`Report`/`Block`) + RTK Query `adminApi`
- 대시보드 카운트 카드 (검수 큐와 같은 소스)

### 남은 작업 (실운영 전)

- **Phase 3**: 권한 검증을 Functions로 이전 (현재 클라이언트)
- **Phase 3-B**: 신고/정지/권한 mutation을 Callable Functions로 이동
- **Phase 3-B**: Firestore Rules 강화 — `users.role`, `reports`, `blocks`, `entitlements`(self-only) 등 admin-only/collection별 잠금
- 신고/정지/권한 변경 **감사 로그(이력)** 기록
- 검수·신고 캐시 최적화 (현재 full refetch)
- 반려 사유 템플릿 / 빠른 선택, 단건 사진 상세 검수, 신고 필터·정렬, 사용자 검색 강화

### 알려진 위험

- **클라이언트 가드만 존재**: `AdminRouteGate` + `isAdmin` 체크는 우회 가능. 권한 강제는 Functions로 옮겨야 함.
- **Firestore Rules는 Phase 3-A 상태**: `reactions`/`matches`만 Functions-only로 잠겨 있고, `users`·`reports`·`blocks`·`entitlements` 등은 authenticated read/write로 광범위 허용 — admin role 검증이 없어 임의 사용자가 admin write를 시도할 수 있다. (`firestore.rules` 주석의 "Phase 3-B/3-C 추가 예정"은 아직 미실행.)
- **이력 미기록**: 신고·정지·권한·플랜 변경 history가 없어 감사 추적 불가. 결정적 report id의 덮어쓰기로 이전 사유도 손실.
- **부트스트랩 의존성**: 최초 admin이 없으면 `grant-admin.mjs`(ADC 필요)로만 seed 가능 — 개발자 의존.
- **권한 회수 후 상태 모호**: admin 회수 시 `onboardingStatus='approved'`가 남아 일반 사용자 진입 흐름이 불명확(정책 부재).
- **대량 심사 성능**: 카운트·조회가 클라이언트 필터 기반 full scan (composite index 없음).
