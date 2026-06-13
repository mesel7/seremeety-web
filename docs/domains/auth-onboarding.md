# 인증 / 온보딩 — seremeety-web

Firebase Phone Auth로 가입한 사용자를 **프로필 → 사진 → 선호도 → 동의 → 관리자 심사**로 이어지는 8단계 온보딩 상태머신을 통해 매칭 진입까지 안내하는 도메인. 라우트 결정의 단일 진실 소스는 `User.onboardingStatus`다.

관련 문서: [아키텍처 개요](../architecture.md) · [데이터 모델](../data-model.md) · [매칭/추천](./matching.md)

---

## 1. 개요

가입은 Firebase Phone Auth(SMS)로 시작하고, 인증된 사용자는 서버 권위적(server-authoritative) 필드인 `User.onboardingStatus`를 따라 단계별 온보딩을 밟는다. 각 단계 페이지는 자기 데이터를 저장한 뒤 `transitionOnboardingStatus()`로 다음 상태로 전이하며, 라우트 가드(`AuthenticatedRouteGate` / `AdminRouteGate`)가 현재 상태에 맞는 페이지로 강제 redirect한다.

핵심 설계 축은 세 가지다.

- **온보딩 상태머신**: `User.onboardingStatus`(`auth_only → … → approved`)를 라우트 결정의 primary source로 사용한다. `resolveEntryRoute()`는 이 한 필드와 `user.status`, `user.role`만 본다.
- **RTK Query 통합 fetch + optimistic patch**: `entryStateApi`가 user/profile/preference/photos/consent를 한 번에 읽고(`EntryState` 태그), 단계 전이 시 Firestore commit 후 캐시의 `onboardingStatus`만 즉시 patch해 step 전환 깜빡임을 제거한다.
- **Legacy Bridge Dual-Write**: 신규 컬렉션(`profiles`/`profilePhotos` 등)과 기존 `users` old-shape 문서를 동시 갱신해, 아직 마이그레이션되지 않은 matching/chat 리더와의 호환성을 유지한다.

---

## 2. 핵심 흐름

### 2.1 Phone Auth → Redux 동기화

1. [`LoginPage`](../../src/features/auth/LoginPage.tsx)에서 전화번호 입력 → `RecaptchaVerifier`로 SMS 인증코드 전송 → 코드 입력으로 `auth.currentUser` 생성. Recaptcha setup/teardown은 [`firebase.ts`](../../src/firebase.ts)가 담당.
2. [`AuthSync`](../../src/shared/providers/AuthSync.tsx)가 `onAuthStateChanged()`를 구독한다. side-effect-only 컴포넌트로 Context는 제공하지 않고 children을 통과시킨다.
   - **신규 사용자**: `getUserDataByUid()`가 비면 `setNewUserData()`로 old-shape 기본 문서만 생성. User V2 / Entitlement / IdentityVerification 부트스트랩은 `/onboarding/bootstrap`에서 처리.
   - **기존 사용자(old-shape doc만 존재)**: User V2 필드가 없으면 `grandfatherExistingUser()`로 User V2 문서를 채우고 `role`을 Redux에 동기화.
3. 로그인/로그아웃 양쪽에서 사용자 종속 RTK Query 태그(`Me`, `EntryState`, `Recommendation`, `Reaction`, `Match`, `Block`, `Entitlement`, `Photo`, `Message`)를 일괄 invalidate해 새 uid 기준으로 재페치/재구독시킨다.

### 2.2 진입 라우트 해결

- [`resolveEntryRoute(UserEntryState)`](../../src/shared/lib/onboarding/resolveEntryRoute.ts)가 `authenticated → user 존재 → user.status → user.onboardingStatus`(+`role`) 순으로 진입점을 결정한다.
- [`AuthEntryPage`](../../src/features/auth/AuthEntryPage.tsx)와 [`AuthenticatedRouteGate`](../../src/shared/providers/AuthenticatedRouteGate.tsx)가 이 결과로 `/onboarding/*`, `/account/*` 라우트를 강제 redirect한다.
- [`AdminRouteGate`](../../src/shared/providers/AdminRouteGate.tsx)는 `role === 'admin'`을 검증하고 미충족 시 `/matching`으로 보낸다.

### 2.3 온보딩 단계

| 단계 | 페이지 | 라우트 | 핵심 동작 | 전이 후 status |
|---|---|---|---|---|
| STEP 0 | [`BootstrapPage`](../../src/features/onboarding/BootstrapPage.tsx) | `/onboarding/bootstrap` | User V2 / Entitlement / IdentityVerification 부트스트랩. `role==='admin'`이면 `approved`→`/admin` | `profile_required` |
| STEP 1 | [`ProfileStepPage`](../../src/features/onboarding/ProfileStepPage.tsx) | `/onboarding/profile` | draft 로드 또는 신규 생성. nickname 중복 검사(onBlur 비동기), birthdate 만 18~80세, location/locationDistrict 분리, bio 10자+, mbti/university 선택 | `photo_required` |
| STEP 2 | [`PhotoStepPage`](../../src/features/onboarding/PhotoStepPage.tsx) | `/onboarding/photos` | 메인 사진(`isMain=true`) 필수. crop → Storage 업로드 → `createProfilePhoto(status='pending')` | `preference_required` |
| STEP 3 | [`PreferenceStepPage`](../../src/features/onboarding/PreferenceStepPage.tsx) | `/onboarding/preferences` | `targetGender` 자동(본인 반대 성별), minAge/maxAge(18~80), preferredLocations[] 다중 | `consent_required` |
| STEP 4 | [`ConsentStepPage`](../../src/features/onboarding/ConsentStepPage.tsx) | `/onboarding/consent` | 이용약관/개인정보 필수, 마케팅 선택. `createConsent(termsVersion='1.0', privacyVersion='1.0')` + `profile.status='pending'` | `review_pending` |
| STEP 5 | [`ReviewPendingPage`](../../src/features/onboarding/ReviewPendingPage.tsx) | `/onboarding/review-pending` | 관리자 심사 대기. 승인 시 `approved` | — |
| 반려 | [`RejectedPage`](../../src/features/onboarding/RejectedPage.tsx) | `/onboarding/rejected` | `profile.rejectionReason` 표시 → 프로필/사진 단계 선택 → 데이터 보존한 채 재수정 | `profile_required` 또는 `photo_required` |

- 이전 단계 이동은 [`stepNavigation.ts`](../../src/shared/lib/onboarding/stepNavigation.ts)가 step back target을 계산한 뒤 전이한다.
- [`OnboardingStubLayout`](../../src/features/onboarding/OnboardingStubLayout.tsx)이 페이지 템플릿, [`OnboardingFooter`](../../src/features/onboarding/OnboardingFooter.tsx)가 로그아웃/가입그만두기 액션을 제공한다.

### 2.4 상태 전이 & 중단

- [`transitionOnboardingStatus()`](../../src/shared/lib/onboarding/transitionOnboardingStatus.ts): Firestore `setOnboardingStatus()` commit 후 `entryStateApi` 캐시의 `user.onboardingStatus`만 즉시 patch. 전이 규칙은 [`transitions.ts`](../../src/shared/lib/onboarding/transitions.ts)의 `allowedTransitions`가 정의한다.
- [`cancelSignup.ts`](../../src/shared/lib/onboarding/cancelSignup.ts): 가입그만두기 시 `writeBatch`로 7개 컬렉션(users/entitlements/identityVerifications/profiles/profilePhotos/preferences/consents) 일괄 삭제 후 sign out. 로그아웃만 하면 데이터는 보존된다.

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`AuthSync.tsx`](../../src/shared/providers/AuthSync.tsx) | Firebase auth 구독 → Redux authSlice 동기화 + RTK Query 일괄 invalidate |
| [`AuthenticatedRouteGate.tsx`](../../src/shared/providers/AuthenticatedRouteGate.tsx) | onboarding/account 라우트 강제 redirect 가드 |
| [`AdminRouteGate.tsx`](../../src/shared/providers/AdminRouteGate.tsx) | admin 역할 검증 가드 |
| [`authSlice.ts`](../../src/shared/lib/store/authSlice.ts) | Redux auth 상태(uid, role, isInitializing, isReady) |
| [`resolveEntryRoute.ts`](../../src/shared/lib/onboarding/resolveEntryRoute.ts) | User 상태 → 진입 라우트 결정 |
| [`transitionOnboardingStatus.ts`](../../src/shared/lib/onboarding/transitionOnboardingStatus.ts) | 상태 전이 + RTK Query optimistic patch |
| [`transitions.ts`](../../src/shared/lib/onboarding/transitions.ts) | 상태 전이 규칙(`allowedTransitions`) |
| [`stepNavigation.ts`](../../src/shared/lib/onboarding/stepNavigation.ts) | 이전 단계 이동 로직 |
| [`cancelSignup.ts`](../../src/shared/lib/onboarding/cancelSignup.ts) | 가입 중단 시 batch delete |
| [`useEntryState.ts`](../../src/shared/hooks/useEntryState.ts) | entryStateApi 래퍼 + stale 감지 |
| [`entryStateApi.ts`](../../src/shared/lib/api/entryStateApi.ts) | User/Profile/Preference/Photos/Consent 통합 fetch |
| [`LoginPage.tsx`](../../src/features/auth/LoginPage.tsx) | Phone Auth 입력 UI |
| [`AuthEntryPage.tsx`](../../src/features/auth/AuthEntryPage.tsx) | 로그인 여부 판단 → entry route 분기 |
| [`BootstrapPage.tsx`](../../src/features/onboarding/BootstrapPage.tsx) | STEP 0 User V2/Entitlement/IdentityVerification 부트스트랩 |
| [`ProfileStepPage.tsx`](../../src/features/onboarding/ProfileStepPage.tsx) | STEP 1 프로필 작성 |
| [`PhotoStepPage.tsx`](../../src/features/onboarding/PhotoStepPage.tsx) | STEP 2 메인 사진 업로드 |
| [`PreferenceStepPage.tsx`](../../src/features/onboarding/PreferenceStepPage.tsx) | STEP 3 매칭 선호도 |
| [`ConsentStepPage.tsx`](../../src/features/onboarding/ConsentStepPage.tsx) | STEP 4 약관 동의 + 프로필 제출 |
| [`ReviewPendingPage.tsx`](../../src/features/onboarding/ReviewPendingPage.tsx) | STEP 5 관리자 심사 대기 |
| [`RejectedPage.tsx`](../../src/features/onboarding/RejectedPage.tsx) | 반려 시 진입, 수정 단계 선택 |
| [`firebase.ts`](../../src/firebase.ts) | Firebase SDK + RecaptchaVerifier setup/teardown |
| [`usersV2.ts`](../../src/shared/lib/firebase/usersV2.ts) | User V2 CRUD + grandfather |
| [`users.ts`](../../src/shared/lib/firebase/users.ts) | old-shape CRUD + 닉네임 중복 검사 |
| [`profiles.ts`](../../src/shared/lib/firebase/profiles.ts) · [`profilePhotos.ts`](../../src/shared/lib/firebase/profilePhotos.ts) · [`preferences.ts`](../../src/shared/lib/firebase/preferences.ts) · [`consents.ts`](../../src/shared/lib/firebase/consents.ts) | 단계별 컬렉션 CRUD |
| [`entitlements.ts`](../../src/shared/lib/firebase/entitlements.ts) · [`identityVerifications.ts`](../../src/shared/lib/firebase/identityVerifications.ts) | Entitlement(일일 한도) / IdentityVerification(mock) |

타입 정의: [`user.ts`](../../src/shared/types/model/user.ts) · [`profile.ts`](../../src/shared/types/model/profile.ts) · [`preference.ts`](../../src/shared/types/model/preference.ts) · [`photo.ts`](../../src/shared/types/model/photo.ts) · [`consent.ts`](../../src/shared/types/model/consent.ts)

---

## 4. 데이터·상태

### 4.1 온보딩 상태머신

`transitions.ts`의 `allowedTransitions`가 정의하는 전이 그래프(선형 + 반려 분기):

```
auth_only → profile_required → photo_required → preference_required
          → consent_required → review_pending → { approved | review_rejected }
review_rejected → { profile_required | photo_required }
approved → (terminal)
```

`canTransition(from, to)`로 검증하며, `resolveEntryRoute()`는 각 상태를 다음 라우트로 매핑한다(`approved`는 `role==='admin'`이면 `/admin`, 아니면 `/matching`). `user.status`가 `suspended`/`deleted`면 onboardingStatus보다 먼저 `/account/*`로 분기한다.

### 4.2 Firestore 컬렉션

| 컬렉션 | 핵심 필드 |
|---|---|
| `users` (User V2) | `onboardingStatus`, `role`(`user`/`admin`), `status`(`active`/`suspended`/`deleted`), `authProvider='firebase_phone'`, `phoneAuthVerified` |
| `profiles` | `status`(`draft`/`pending`/`approved`/`rejected`), `rejectionReason`, nickname/birthdate/location/bio/mbti/university |
| `profilePhotos` | `status`(`pending`/`approved`/`rejected`), `isMain`, `order` |
| `preferences` | `targetGender`, `minAge`, `maxAge`, `preferredLocations[]` |
| `consents` | `termsVersion`, `privacyVersion`, `marketingAgreed`, `agreedAt` |
| `entitlements` | `planId`, 일일 한도 |
| `identityVerifications` | mock — `provider='none'`, `status='not_started'` |

`profile.status`와 `user.onboardingStatus`는 별도 필드로, 대기/승인/반려를 정확히 추적하기 위해 두 곳을 함께 갱신한다.

### 4.3 RTK Query 통합 fetch + stale 감지

- [`entryStateApi.ts`](../../src/shared/lib/api/entryStateApi.ts)가 user/profile/preference/photos/consent를 한 번에 fetch하고 `EntryState` 태그를 제공한다.
- [`useEntryState.ts`](../../src/shared/hooks/useEntryState.ts)는 `uid !== data.user.id`로 stale 데이터를 감지한다. 다른 계정 재로그인 시 RTK Query 캐시가 이전 uid 데이터를 유지하는 문제를 방어한다. 단, 신규 사용자 bootstrap 전 `data.user === null`은 정상 상태로 간주해야 한다.
- `transitionOnboardingStatus()`는 `invalidateTags` 대신 `updateQueryData`로 `onboardingStatus`만 patch한다. invalidate 방식은 refetch 응답 도착 전까지 캐시가 이전 status를 노출해 가드가 잘못된 target을 계산하기 때문이다.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| **User V2 필드 분리** (`onboardingStatus`/`role`/`status`를 User 문서에 명시) | server-authoritative state로 `resolveEntryRoute` 단순화 | old-shape 사용자 grandfather 처리 필요, 문서 구조 유지 기간 발생 |
| **Optimistic patch** (`transitionOnboardingStatus`) | Firestore commit 후 캐시 즉시 patch → step 전이 깜빡임 제거 | 캐시/Firestore 불일치 가능, refetch 실패 시 수동 조정 필요 |
| **useEntryState stale 감지** (uid 검사) | 다른 계정 재로그인 시 이전 uid 캐시 노출 방지 | 신규 사용자 bootstrap 전 `data.user=null`을 정상으로 간주해야 함 |
| **Legacy Bridge Dual-Write** | 신규 컬렉션 + 기존 `users` 동시 갱신 → matching/chat 리더 호환 | dual-write 실패 시 데이터 불일치, 향후 마이그레이션 필수 |
| **Phone Auth + RecaptchaVerifier** | SMS 기반 전화번호 인증이 한국 사용자 기반에 적합 | Recaptcha DOM 정리 복잡성, 로그아웃→재로그인 시 재초기화 |
| **`targetGender` 자동 결정** | 현 설계가 이진 성별만 지원 → 반대 성별 자동 설정 | 다양한 성적지향 미지원, 향후 preference 슬라이스 확장 필요 |
| **entryStateApi 통합 fetch** | user/profile/preference/photos/consent 한 번에 → 라우트 결정 일관성 | 느린 필드 하나로 전체 refetch 지연, 개별 캐싱 불가 |
| **Functions 마이그레이션 미완(Phase 3-A)** | 현재 클라이언트가 profile/preference/consent를 Firestore에 직접 write | 악의적 사용자가 타 사용자 데이터 수정 가능 — Phase 3-B 필수 |

---

## 6. 현재 상태

### 구현됨

- Firebase Phone Auth + SMS 인증, User V2 도메인 모델(`onboardingStatus`/`role`/`status`)
- 8단계 온보딩 상태머신 + `AuthenticatedRouteGate` / `AdminRouteGate`
- 프로필 작성(기본 정보 + MBTI/대학 선택, 닉네임 중복 검사, 만 18~80세 검증)
- 사진 업로드 + crop(`status='pending'`), 매칭 선호도(`targetGender` 자동), 약관/개인정보 동의(버전 관리)
- 관리자 심사 대기 화면, 반려 후 수정·재제출
- 로그아웃(데이터 보존) / 가입 그만두기(batch delete)
- RTK Query `entryStateApi` 통합 fetch + stale 감지 + optimistic patch(전이 깜빡임 제거)
- Firestore 컬렉션 7종, Legacy bridge dual-write

### 남은 작업

- **Phase 3-B**: onboarding transition을 Functions로 마이그레이션, Firestore Security Rules를 collection별로 좁히기
- **Phase 8**: admin 프로필 심사 큐 승인/반려 구현(현재 `review_pending → approved`는 미구현)
- **Phase 11**: `identityVerifications` 실 KISA 본인확인 연동(현재 mock)
- 다양한 성적지향 지원(현재 이진 성별 기반)
- legacy bridge 제거 + matching/chat/mypage 신규 컬렉션 마이그레이션
- Storage 사진 파일 정리 함수(현재 주석만 존재)

### 알려진 위험

- **재로그인 stale data**: `useEntryState` uid 검사가 미작동하면 이전 uid 캐시로 무한 redirect 가능.
- **optimistic patch 실패**: 캐시 부분 갱신 상태가 되면 수동 refresh 필요.
- **dual-write 실패**: `profiles`/`users` 불일치 → matching/chat 리더 오류.
- **보안(Phase 3-B 이전)**: 클라이언트가 Firestore에 직접 write하므로 타 사용자 데이터 수정 가능. Firestore rule이 `request.auth.uid != null` 수준에 머무름.
- **RecaptchaVerifier 정리 실패**: '요소가 제거됨' 류 에러 가능.
- **batch delete 500개 제한**: 향후 페이징 필요.
- **grandfather 로직 버그**: 기존 old-shape 사용자 전체에 영향.

> 참고: 일부 상위 문서(`ARCHITECTURE.md`, `DATA_MODEL.md`)는 "온보딩 전이를 Functions가 enforce" / "Firestore write를 인증만 검증"으로 기술하나, **현재 실제 구현은 클라이언트 Firestore 직접 write**이며 Functions 마이그레이션은 Phase 3-B로 미완 상태다. 본 문서의 기술이 현재 사실 기준이다.
