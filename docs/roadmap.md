# ROADMAP.md — seremeety-web

## 0. 문서 목적

이 문서는 `seremeety-web`의 제품 방향, 구현 우선순위, 인증/온보딩 설계, 데이터 모델, Firebase/Functions 경계, RTK Query 구조, 추천/매칭 로직, 관리자/신고/차단, 결제 mock, 배포/운영 인수인계 기준을 정의한다.

- `CLAUDE.md`: 코드 컨벤션, 폴더 구조, SCSS, 접근성, TypeScript, 검증 규칙
- `ROADMAP.md`: 제품 방향, 데이터 모델, 구현 순서, 도메인 로직, 운영 직전 MVP 기준

작업 시 제품 레벨 변경은 이 문서를 우선 참고한다.

---

## 1. 제품 방향

이 프로젝트는 기존 소개팅 웹 앱을 **운영 직전 수준의 MVP+**로 고도화하는 프로젝트다.

목표는 내가 직접 즉시 운영하는 것이 아니다. 목표는 외부 운영 주체가 아래 항목을 처리하면 바로 실서비스 전환을 검토할 수 있는 수준의 제품 기반을 만드는 것이다.

- 사업자 등록
- PG사/결제대행사 계약
- 이용약관 법무 검토
- 개인정보처리방침 법무 검토
- 고객센터/CS 체계
- 환불/신고/운영 정책
- 실사용자 모집/마케팅

즉, 현재 개발 목표는 **프론트엔드 데모**가 아니라 **실제 제품화 가능한 소개팅 웹 앱 기반**이다.

---

## 2. 현재 범위

### 2.1 In Scope

현재 개발 범위에 포함한다.

- 기존 앱 안정화
- Firebase Phone Auth 기반 인증 흐름 유지 및 정리
- 가입/로그인/온보딩 상태 분리
- 프로필/이미지/인증 흐름 안정화
- Firestore 데이터 구조 재설계
- Firebase Functions/API 경계 설계
- 추천 기반 매칭 구조 구현
- 좋아요/패스/슈퍼좋아요/매칭/채팅 구조 구현
- 신고/차단/관리자 심사 구조 구현
- RTK Query 기반 서버 상태 관리 도입
- 무료/프리미엄 권한 구조 구현
- mock 결제 구현
- 향후 PG 연동 지점 문서화
- 향후 한국 본인확인 API 연동 지점 문서화
- 배포/운영 인수인계 문서화

### 2.2 Out of Scope

현재 개발 범위에서 제외한다.

- 실제 PG 계약
- 실제 카드 결제
- 실제 구독 과금
- 실제 환불 처리
- 사업자 등록
- 통신판매업/법무 검토 완료
- 실제 NICE/KMC/PASS 등 한국 본인확인 API 연동
- 실사용자 대상 공개 운영
- 실시간 CS 운영
- 대규모 개인정보 수집
- 마케팅 집행

필요하다면 해당 항목은 “실운영 전 필요 사항”으로 문서화한다.

---

## 3. 인증/가입/온보딩 기본 방향

### 3.1 현재 인증 방향

현재 앱은 Firebase Phone Auth를 사용한다.

이 방향은 유지한다.

다만 중요한 점:

> Firebase Phone Auth는 “전화번호 SMS 인증을 통한 로그인”이지, 한국식 실명 본인확인이 아니다.

따라서 다음을 분리한다.

```txt
Firebase Phone Auth
= 해당 전화번호로 SMS 인증에 성공한 Firebase 계정

Identity Verification
= NICE/KMC/PASS 등 외부 본인확인기관을 통한 실명/연령/성별/본인 명의 확인
```

현재 단계에서는 실제 한국 본인확인 API를 붙이지 않는다. 대신 미래 확장을 위해 `identityVerifications` 또는 관련 상태 구조만 준비한다.

### 3.2 비로그인 접근 범위

비로그인 사용자가 볼 수 있는 것:

- 랜딩 페이지
- 서비스 소개
- 안전/신뢰 정책 안내
- 요금제 소개
- 이용약관
- 개인정보처리방침
- 로그인/가입 페이지

비로그인 사용자가 볼 수 없는 것:

- 실제 유저 프로필
- 추천 카드
- 프로필 상세
- 좋아요/매칭
- 채팅
- 신고/차단
- 결제/프리미엄 구매
- 관리자 페이지

### 3.3 가입 완료의 정의

전화번호 인증 성공을 가입 완료로 보지 않는다.

가입/서비스 이용 가능 상태는 다음 단계를 거친다.

```txt
비로그인
→ Firebase Phone Auth 성공
→ users 문서 확인
→ 최초 유저면 users/entitlements/identityVerification 기본 문서 생성
→ 온보딩 시작
→ 기본 프로필 작성
→ 사진 업로드
→ 선호 조건 입력
→ 약관/개인정보 동의
→ 심사 제출
→ profile/photos pending
→ 관리자 승인
→ recommendations 진입 가능
```

### 3.4 앱 진입 상태

앱은 다음 상태를 구분해야 한다.

```txt
unauthenticated
authenticated_but_no_user_doc
user_created_but_no_profile
profile_draft
photo_required
preference_required
consent_required
profile_pending_review
profile_rejected
profile_approved
active_matching_user
suspended
deleted
```

### 3.5 권장 redirect 규칙

```txt
비로그인
→ /login

로그인했지만 user doc 없음
→ /onboarding/bootstrap

user.status === suspended
→ /account/suspended

user.status === deleted
→ /login 또는 /account/deleted

profile 없음
→ /onboarding/profile

profile draft
→ /onboarding/profile

필수 사진 없음
→ /onboarding/photos

preference 없음
→ /onboarding/preferences

약관 동의 없음
→ /onboarding/consent

profile pending
→ /onboarding/review-pending

profile rejected
→ /onboarding/rejected

profile approved
→ /recommendations
```

### 3.6 Entry Route Resolver 예시

```ts
export type AppEntryRoute =
  | '/login'
  | '/onboarding/bootstrap'
  | '/onboarding/profile'
  | '/onboarding/photos'
  | '/onboarding/preferences'
  | '/onboarding/consent'
  | '/onboarding/review-pending'
  | '/onboarding/rejected'
  | '/recommendations'
  | '/account/suspended';

export function resolveEntryRoute(state: UserEntryState): AppEntryRoute {
  if (!state.authenticated) return '/login';
  if (!state.user) return '/onboarding/bootstrap';
  if (state.user.status === 'suspended') return '/account/suspended';
  if (!state.profile) return '/onboarding/profile';
  if (!state.hasRequiredPhotos) return '/onboarding/photos';
  if (!state.preference) return '/onboarding/preferences';
  if (!state.hasRequiredConsents) return '/onboarding/consent';
  if (state.profile.status === 'pending') return '/onboarding/review-pending';
  if (state.profile.status === 'rejected') return '/onboarding/rejected';
  if (state.profile.status === 'approved') return '/recommendations';
  return '/onboarding/profile';
}
```

### 3.7 한국 본인확인 API 방향

현재는 붙이지 않는다.

현재 구현:

- Firebase Phone Auth 유지
- `phoneAuthVerified` 상태 사용
- `identityVerification.status = 'not_started'` 또는 mock 상태 사용
- 실운영 전 외부 본인확인 API 검토 항목으로 문서화

미래 실운영 전 검토:

- NICE
- KMC
- PASS
- 기타 본인확인기관
- CI/DI 저장 여부
- 실명/생년월일/성별 저장 최소화 정책
- 개인정보처리방침/동의 문구 법무 검토

---

## 4. 전체 로드맵

1. Phase 1 — 현재 앱 안정화
2. Phase 2 — Auth/Onboarding 및 데이터 모델 재설계
3. Phase 3 — Firebase Functions/API 경계 구축
4. Phase 4 — 프로필/이미지 시스템 개선
5. Phase 5 — 추천/매칭 로직 재구축
6. Phase 6 — RTK Query 상태관리 구조 도입
7. Phase 7 — 패키지 의존성 정리
8. Phase 8 — 관리자/신고/차단/심사 기능
9. Phase 9 — 유료 권한/결제 mock
10. Phase 10 — 디자인/브랜딩 개선
11. Phase 11 — 배포/운영 인수인계 문서화

중요 원칙:

> 데이터 모델과 핵심 흐름이 정리되기 전에는 디자인 대개편, 실제 결제, 대규모 상태관리 마이그레이션을 먼저 하지 않는다.

---

# Phase 1 — 현재 앱 안정화

## 목표

현재 앱이 깨지지 않는 상태를 만든다. 큰 구조 변경 전에 기존 기능의 불안정 요소를 제거한다.

## 작업 범위

- 로그인/로그아웃 확인
- Firebase Phone Auth 흐름 확인
- 가입과 로그인 구분 방식 확인
- 인증 필요 페이지 접근 제어 확인
- 프로필 생성/수정/조회 플로우 확인
- 이미지 무한 로딩 해결
- 이미지 fallback 처리
- 로딩/에러/빈 상태 정리
- SCSS 마이그레이션 잔여 문제 확인
- 주요 페이지 런타임 에러 제거

## 추가 분석 항목

Phase 1에서는 아직 대개편하지 말고, 다음을 분석한다.

- Firebase Auth 성공 후 어떤 문서가 생성되는지
- 최초 가입자와 기존 로그인 사용자를 어떻게 구분하는지
- 로그인 후 어떤 페이지로 이동하는지
- 프로필 미작성 사용자가 어떤 화면을 보는지
- 전화번호 Auth 성공만으로 추천/매칭에 접근 가능한지
- 현재 Firestore write가 어디서 발생하는지
- 현재 온보딩 상태가 데이터로 관리되는지, UI 흐름에만 의존하는지

## 완료 기준

- 주요 페이지가 크래시 없이 열린다.
- 로그인/로그아웃이 정상 동작한다.
- Firebase Phone Auth 흐름이 문서화된다.
- 최초 가입/기존 로그인 판단 방식이 문서화된다.
- 비로그인 사용자는 보호 페이지에 접근하지 못한다.
- 프로필 기본 조회/수정이 가능하다.
- 이미지 로딩 실패 시 fallback이 표시된다.
- 무한 로딩이 해결되거나 원인이 명확히 문서화된다.
- `npm run lint` 통과
- `npx tsc --noEmit` 통과

## 하지 말 것

- 실제 결제 구현 금지
- 실제 한국 본인확인 API 연동 금지
- 전체 UI 리디자인 금지
- 전체 상태관리 마이그레이션 금지
- Firestore 구조 대개편 금지
- 새 라이브러리 무분별 추가 금지

---

# Phase 2 — Auth/Onboarding 및 데이터 모델 재설계

## 목표

Firebase Phone Auth 기반 인증 흐름을 유지하면서도, 가입/로그인/온보딩/프로필 심사/추천 가능 상태를 명확히 분리한다.

추천, 매칭, 신고, 차단, 결제 mock, 관리자 심사를 안정적으로 구현할 수 있도록 데이터 구조를 재설계한다.

## 핵심 원칙

- 전화번호 인증 성공을 가입 완료로 보지 않는다.
- Firebase Phone Auth와 한국 본인확인을 분리한다.
- 공개 프로필 데이터와 내부 운영 데이터를 분리한다.
- 매칭용 선호 데이터와 상대에게 보여주는 데이터를 분리한다.
- 신고/차단/결제/관리자 데이터는 일반 유저에게 노출하지 않는다.
- 승인되지 않은 프로필/사진은 추천에 노출하지 않는다.
- 정지/삭제/차단 상태는 추천, 매칭, 채팅에 반드시 반영한다.

## 권장 컬렉션

```txt
users
profiles
preferences
profilePhotos
reactions
matches
messages
blocks
reports
verifications
identityVerifications
consents
recommendationLogs
plans
entitlements
payments
adminReviews
```

## 컬렉션 역할

### users

계정과 내부 운영 상태.

```ts
export type UserRole = 'user' | 'admin';

export type UserStatus =
  | 'active'
  | 'suspended'
  | 'deleted';

export type AuthProvider = 'firebase_phone';

export type OnboardingStatus =
  | 'auth_only'
  | 'profile_required'
  | 'photo_required'
  | 'preference_required'
  | 'consent_required'
  | 'review_pending'
  | 'review_rejected'
  | 'approved';

export type User = {
  id: string;
  authProvider: AuthProvider;
  phoneAuthVerified: boolean;
  phoneNumberMasked?: string;

  email?: string;
  role: UserRole;
  status: UserStatus;
  onboardingStatus: OnboardingStatus;

  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  deletedAt?: string;
};
```

### profiles

상대에게 보여줄 공개 프로필.

```ts
export type ProfileStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deleted';

export type Gender = 'male' | 'female';

export type Profile = {
  id: string;
  userId: string;
  nickname: string;
  birthYear: number;
  gender: Gender;
  location: string;
  height?: number;
  jobCategory?: string;
  educationLevel?: string;
  smoking?: 'yes' | 'no' | 'occasionally';
  drinking?: 'none' | 'occasionally' | 'socially' | 'often';
  religion?: string;
  datingIntent?: 'serious' | 'casual' | 'friendship' | 'unsure';
  bio: string;
  tags: string[];
  mainPhotoId?: string;
  status: ProfileStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};
```

### preferences

상대에게 직접 보여주지 않는 매칭용 선호 데이터.

```ts
export type Preference = {
  id: string;
  userId: string;
  targetGender: Gender;
  minAge: number;
  maxAge: number;
  preferredLocations: string[];
  minHeight?: number;
  maxHeight?: number;
  preferredDatingIntent?: string[];
  preferredTags?: string[];
  dealBreakers?: string[];
  createdAt: string;
  updatedAt: string;
};
```

### profilePhotos

프로필 사진 메타데이터.

```ts
export type PhotoStatus =
  | 'uploading'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deleted';

export type ProfilePhoto = {
  id: string;
  userId: string;
  profileId: string;
  storagePath: string;
  originalUrl?: string;
  displayUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  order: number;
  isMain: boolean;
  status: PhotoStatus;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};
```

### reactions

좋아요, 패스, 슈퍼좋아요 기록.

```ts
export type ReactionType = 'like' | 'pass' | 'superLike';

export type Reaction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: ReactionType;
  createdAt: string;
};
```

### matches

상호 좋아요로 성립된 매칭.

```ts
export type MatchStatus =
  | 'active'
  | 'unmatched'
  | 'blocked'
  | 'deleted';

export type Match = {
  id: string;
  userIds: [string, string];
  createdByReactionIds: string[];
  status: MatchStatus;
  createdAt: string;
  updatedAt: string;
  unmatchedAt?: string;
  blockedAt?: string;
};
```

### messages

매칭 후 대화.

```ts
export type MessageStatus =
  | 'sent'
  | 'deleted'
  | 'reported';

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
};
```

### blocks

사용자 간 차단.

```ts
export type Block = {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason?: string;
  createdAt: string;
};
```

### reports

신고 기록.

```ts
export type ReportTargetType =
  | 'profile'
  | 'photo'
  | 'message'
  | 'user';

export type ReportStatus =
  | 'open'
  | 'reviewing'
  | 'resolved'
  | 'dismissed';

export type Report = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reason: string;
  description?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolutionNote?: string;
};
```

### identityVerifications

한국 본인확인 API 미래 연동을 위한 상태. 현재는 mock/status 구조만 둔다.

```ts
export type IdentityVerificationStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'
  | 'expired';

export type IdentityVerificationProvider =
  | 'none'
  | 'nice'
  | 'kmc'
  | 'pass'
  | 'future_provider';

export type IdentityVerification = {
  id: string;
  userId: string;
  provider: IdentityVerificationProvider;
  status: IdentityVerificationStatus;

  verifiedAt?: string;

  ciHash?: string;
  diHash?: string;

  birthYear?: number;
  gender?: Gender;
  ageVerified?: boolean;
  adultVerified?: boolean;

  createdAt: string;
  updatedAt: string;
};
```

주의:

- CI/DI/실명/생년월일/성별 등은 실운영 정책과 법무 검토 없이 무분별하게 저장하지 않는다.
- 현재는 Firebase Phone Auth와 별도 상태로만 준비한다.

### consents

약관/개인정보 동의 이력.

```ts
export type Consent = {
  id: string;
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  marketingAgreed: boolean;
  agreedAt: string;
  createdAt: string;
};
```

### recommendationLogs

추천 이력.

```ts
export type RecommendationLog = {
  id: string;
  userId: string;
  recommendedUserId: string;
  score: number;
  reasonCodes: string[];
  shownAt: string;
  reactedAt?: string;
  reactionType?: ReactionType;
};
```

### entitlements

유료 권한 상태.

```ts
export type PlanId = 'free' | 'premium';

export type Entitlement = {
  userId: string;
  planId: PlanId;
  dailyRecommendationLimit: number;
  dailyLikeLimit: number;
  dailySuperLikeLimit: number;
  canUseAdvancedFilter: boolean;
  canSeeReceivedLikes: boolean;
  startsAt: string;
  expiresAt?: string;
  updatedAt: string;
};
```

### payments

mock 결제 및 향후 PG 연동 대비 결제 기록.

```ts
export type PaymentStatus =
  | 'mock_pending'
  | 'mock_success'
  | 'mock_failed'
  | 'cancelled'
  | 'refunded';

export type Payment = {
  id: string;
  userId: string;
  provider: 'mock' | 'future_pg';
  providerPaymentId?: string;
  planId: PlanId;
  amount: number;
  currency: 'KRW';
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};
```

## 온보딩 상태 전환 초안

```txt
auth_only
→ profile_required
→ photo_required
→ preference_required
→ consent_required
→ review_pending
→ approved

review_pending
→ review_rejected
→ profile_required or photo_required
```

## 완료 기준

- 신규 데이터 모델 문서화
- Firebase Phone Auth와 identityVerification 분리
- 가입/로그인/온보딩 상태 정의
- 기존 데이터와 신규 데이터의 매핑 방향 정의
- 공개/비공개/운영 데이터 분리
- 프로필/사진 승인 상태 정의
- 정지/삭제/차단/신고 상태 정의
- 결제 mock/권한 구조 정의
- 실본인확인 API는 future integration으로 문서화

## 하지 말 것

- 전화번호 인증 성공을 곧 가입 완료로 취급하지 않는다.
- Firebase Phone Auth를 한국 실명 본인확인으로 취급하지 않는다.
- private preference를 상대에게 노출하지 않는다.
- report/block/payment/admin 데이터를 public profile에 넣지 않는다.
- 승인 상태를 클라이언트에서만 관리하지 않는다.
- 불필요한 민감정보를 수집하지 않는다.
- 실제 본인확인 API를 명시적 요청 없이 붙이지 않는다.

---

# Phase 3 — Firebase Functions/API 경계 구축

## 목표

중요한 비즈니스 로직을 클라이언트에서 Firebase Functions 또는 API-like boundary로 이동한다.

## 기본 구조

```txt
Client
→ Firebase Auth
→ RTK Query API Layer
→ Firebase Functions
→ Firestore / Storage
```

## Functions로 이동할 로직

- 최초 user bootstrap
- 온보딩 상태 업데이트
- 프로필 생성/수정/심사 제출
- 사진 업로드 완료 처리
- 추천 생성
- 좋아요/패스/슈퍼좋아요
- 매칭 생성
- 신고 생성
- 차단 생성
- 유료 권한 체크
- 프로필/사진 승인 상태 변경
- mock 결제 상태 변경
- 향후 PG webhook 처리
- 향후 본인확인 webhook/callback 처리

## API 초안

### Auth / Bootstrap

```txt
auth.bootstrapUser
auth.resolveEntryState
auth.updateLastLogin
```

### Onboarding

```txt
onboarding.getState
onboarding.completeProfileStep
onboarding.completePhotoStep
onboarding.completePreferenceStep
onboarding.acceptConsents
```

### Profile

```txt
profile.create
profile.update
profile.submitForReview
profile.me
profile.publicByUserId
```

### Photo

```txt
photo.createUploadIntent
photo.uploadComplete
photo.setMain
photo.delete
```

### Recommendation / Reaction

```txt
recommendations.today
recommendations.pass
reactions.like
reactions.superLike
```

### Match / Message

```txt
matches.list
matches.detail
matches.unmatch
messages.list
messages.send
messages.delete
```

### Safety

```txt
blocks.create
blocks.remove
reports.create
```

### Identity Verification

현재는 mock/status 중심.

```txt
identityVerification.getStatus
identityVerification.mockSetStatus
identityVerification.futureCallbackPlaceholder
```

### Entitlement / Payment

```txt
entitlements.me
plans.list
payments.mockCheckout
payments.mockComplete
payments.futureWebhookPlaceholder
```

### Admin

```txt
admin.reviews.list
admin.profile.approve
admin.profile.reject
admin.photo.approve
admin.photo.reject
admin.report.resolve
admin.user.suspend
admin.user.restore
```

## Function 공통 규칙

모든 중요 Function은 다음을 수행한다.

- Firebase Auth 확인
- 요청자 user 로드
- user status 확인
- admin 기능일 경우 role 확인
- input validation
- onboarding status 확인
- entitlement limit 확인
- block/report/suspended/deleted 상태 반영
- server timestamp 사용
- 내부 필드 노출 방지

## 완료 기준

- 핵심 API/Function 목록 정의
- 중요 클라이언트 직접 write 식별
- bootstrap/onboarding 흐름 Function화 계획 수립
- 매칭/호감/신고/차단/결제 mock 로직 이동 계획 수립
- admin-only 작업 보호
- Security Rules 수정 방향 정의

## 하지 말 것

- premium 제한을 UI에서만 체크하지 않는다.
- match를 클라이언트에서만 생성하지 않는다.
- block/report를 UI 상태로만 처리하지 않는다.
- 일반 유저가 approval status를 직접 쓰게 하지 않는다.
- 실제 본인확인 API callback을 mock과 섞지 않는다.

---

# Phase 4 — 프로필/이미지 시스템 개선

## 목표

소개팅 앱의 핵심인 프로필과 사진 표시를 안정화한다.

## 사용자 플로우

```txt
1. 회원가입
2. Firebase Phone Auth 성공
3. auth.bootstrapUser로 users/entitlements/identityVerification 기본 생성
4. draft profile 생성
5. 사진 업로드
6. 대표 사진 선택
7. 선호 조건 입력
8. 약관/개인정보 동의
9. 심사 제출
10. 관리자 승인/반려
11. 승인된 프로필만 추천 대상이 됨
```

## 필수 기능

- 이미지 업로드
- 이미지 크롭
- 대표 사진 설정
- 썸네일 또는 최적화 URL
- 이미지 fallback
- 업로드 실패 처리
- 사진 삭제
- 프로필 완성도 계산
- 사진 승인 상태
- 프로필 승인 상태

## 완료 기준

- 사진 업로드 가능
- 대표 사진 설정 가능
- 이미지 실패 시 fallback 표시
- 승인되지 않은 사진은 추천에 노출되지 않음
- 프로필 미완성 사용자는 추천/호감 제한
- 프로필 페이지가 사진 데이터 누락으로 깨지지 않음

## 하지 말 것

- 승인되지 않은 사진을 추천 카드에 노출하지 않는다.
- 이미지 하나 실패했다고 페이지 전체를 무한 로딩시키지 않는다.
- 이미지 상태를 local state에만 의존하지 않는다.

---

# Phase 5 — 추천/매칭 로직 재구축

## 목표

전체 프로필 목록형 구조를 버리고 추천 기반 소개팅 앱으로 전환한다.

## 기본 원칙

일반 사용자는 모든 이성 프로필을 자유롭게 탐색하지 않는다.

대신 다음 구조를 사용한다.

- 오늘의 추천
- 패스
- 좋아요
- 슈퍼좋아요
- 상호 좋아요 시 매칭
- 매칭 후 채팅
- 추천 이력 저장

## 추천 후보 조건

추천 후보는 다음 조건을 만족해야 한다.

- user.status === active
- user.onboardingStatus === approved
- profile.status === approved
- 승인된 main photo 존재
- 탈퇴/정지 상태 아님
- 서로 차단 관계 아님
- 이미 최근 추천된 적 없음
- 신고/운영 제한 대상 아님
- 내 선호 조건과 기본적으로 맞음
- 필요 시 상대 선호 조건에도 내가 맞음

## 점수 초안

```ts
score =
  agePreferenceScore * 0.25 +
  locationScore * 0.20 +
  lifestyleScore * 0.15 +
  tagScore * 0.15 +
  activityScore * 0.15 +
  profileQualityScore * 0.10;
```

## reasonCodes 예시

```txt
age_match
location_match
shared_tags
active_recently
profile_complete
premium_boost
new_user_boost
identity_verified
```

`identity_verified`는 현재 mock/future 상태로만 사용한다. 실제 본인확인 API 연동 전에는 이 점수를 과도하게 제품 핵심으로 삼지 않는다.

## 무료/유료 제한 초안

무료:

```txt
dailyRecommendationLimit: 5
dailyLikeLimit: 3
dailySuperLikeLimit: 0
```

프리미엄:

```txt
dailyRecommendationLimit: 15
dailyLikeLimit: 10
dailySuperLikeLimit: 3
```

## 매칭 생성 규칙

매칭은 서버에서 생성한다.

매칭 생성 전 확인:

- 양쪽 user 존재
- 양쪽 user active
- 양쪽 onboardingStatus approved
- 양쪽 profile approved
- 서로 차단 관계 아님
- mutual like 존재
- 기존 active match 없음

## 완료 기준

- 전체 프로필 목록 방식 제거 또는 admin/debug 용도로 격하
- 오늘의 추천 구현
- 이미 본 유저 제외
- like/pass/superLike 기록
- daily limit 서버에서 적용
- mutual like 시 match 생성
- block/suspended/deleted 유저 추천 제외
- recommendationLogs 생성

## 하지 말 것

- 모든 이성 프로필을 일반 사용자에게 노출하지 않는다.
- match를 클라이언트에서만 생성하지 않는다.
- 차단 유저를 다시 추천하지 않는다.
- daily limit을 UI에서만 막지 않는다.

---

# Phase 6 — RTK Query 상태관리 구조 도입

## 목표

Context 중심 상태관리를 RTK Query 중심 구조로 정리한다.

## 원칙

- 서버 상태는 RTK Query로 관리한다.
- 전역 UI 상태만 Redux slice로 관리한다.
- 컴포넌트 내부 상태는 local state로 유지한다.
- 필터/정렬/페이지네이션/탭은 URL state 우선 고려한다.
- 서버 상태를 Context와 Redux에 중복 저장하지 않는다.

## 권장 구조

```txt
src/
  app/
    providers.tsx

  lib/
    store/
      store.ts
      hooks.ts
      rootReducer.ts

    api/
      baseApi.ts
      authApi.ts
      onboardingApi.ts
      profileApi.ts
      photoApi.ts
      preferenceApi.ts
      recommendationApi.ts
      matchApi.ts
      messageApi.ts
      reportApi.ts
      blockApi.ts
      identityVerificationApi.ts
      entitlementApi.ts
      paymentApi.ts
      adminApi.ts

  features/
    auth/
    onboarding/
    profile/
    recommendations/
    matches/
    admin/
```

## store 예시

```ts
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/lib/api/baseApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

## baseApi 예시

Firebase Functions를 사용할 경우 `fakeBaseQuery` + `queryFn` 형태를 사용할 수 있다.

```ts
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    'Me',
    'EntryState',
    'Onboarding',
    'Profile',
    'Preference',
    'Photo',
    'Recommendation',
    'Match',
    'Message',
    'Report',
    'Block',
    'IdentityVerification',
    'Entitlement',
    'Payment',
    'AdminReview',
  ],
  endpoints: () => ({}),
});
```

## recommendationApi 예시

```ts
import { baseApi } from '@/lib/api/baseApi';

export const recommendationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTodayRecommendations: builder.query<RecommendationCard[], void>({
      async queryFn() {
        try {
          // call Firebase Function
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Recommendation'],
    }),

    sendLike: builder.mutation<void, { toUserId: string }>({
      async queryFn(args) {
        try {
          // call Firebase Function
          return { data: undefined };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: ['Recommendation', 'Match', 'Entitlement'],
    }),
  }),
});
```

## 완료 기준

- Redux store 설정
- baseApi 생성
- domain API slice 계획 또는 구현
- 서버 상태 Context 의존도 감소
- loading/error/empty 처리 규칙 통일
- cache invalidation tag 정의

## 하지 말 것

- 데이터/API 경계가 불명확한 상태에서 무리하게 전체 마이그레이션하지 않는다.
- 서버 상태를 Context와 RTK Query에 중복 저장하지 않는다.
- Zustand를 추가하지 않는다.
- 모든 form state를 global store에 넣지 않는다.

---

# Phase 7 — 패키지 의존성 정리

## 목표

제품 목적이 분명하지 않은 패키지를 제거하거나 대체한다.

## 점검 기준

각 패키지마다 확인한다.

- 실제 사용 중인가?
- 핵심 기능에 필요한가?
- 유지보수되고 있는가?
- React/Next.js와 잘 맞는가?
- 너무 무겁지 않은가?
- 직접 구현하거나 더 단순한 대안이 있는가?

## 후보 판단

### cropper

프로필 사진 크롭에 실제로 쓰면 유지 가능.

### select2

React 앱에서는 제거 후보. native select, custom select, React 친화 라이브러리로 대체 검토.

### react-spring

핵심 UX가 아니면 제거 후보. 간단한 애니메이션은 CSS transition 우선.

## 완료 기준

- 미사용 dependency 제거
- 미사용 import 제거
- lockfile 정리
- lint/typecheck 통과
- 남긴 패키지의 목적 문서화

## 하지 말 것

- 사용 여부 확인 없이 제거하지 않는다.
- 동작 중인 핵심 흐름을 의존성 정리 명목으로 깨지 않는다.
- 대체 패키지를 무분별하게 추가하지 않는다.

---

# Phase 8 — 관리자/신고/차단/심사 기능

## 목표

소개팅 앱 운영에 필요한 최소 안전/관리 기능을 구현한다.

## 필수 기능

- admin-only route protection
- 프로필 승인/반려
- 사진 승인/반려
- 신고 접수
- 신고 검토
- 유저 정지
- 유저 복구
- 차단
- 차단된 유저 추천 제외
- 차단된 유저 채팅 제한

## 관리자 라우트 초안

```txt
/admin
/admin/profiles
/admin/photos
/admin/reports
/admin/users
/admin/payments
/admin/identity-verifications
```

## 신고 플로우

```txt
유저가 profile/photo/message/user 신고
→ reports 생성
→ admin queue 노출
→ admin이 resolve/dismiss
→ 필요 시 user suspend 또는 content reject
```

## 차단 플로우

```txt
A가 B 차단
→ blocks 생성
→ 서로 추천에서 제외
→ 기존 match/chat 제한
```

## 완료 기준

- 유저 신고 가능
- 유저 차단 가능
- 차단 유저 추천 제외
- admin-only 페이지 보호
- admin 프로필/사진 승인 가능
- admin 신고 처리 가능
- admin 유저 정지 가능
- 정지 유저 core feature 사용 불가

## 하지 말 것

- 신고/차단을 UI 상태로만 처리하지 않는다.
- 일반 유저에게 admin records를 노출하지 않는다.
- 정지 유저가 계속 매칭/채팅하게 두지 않는다.
- 신고자 정보를 불필요하게 노출하지 않는다.

---

# Phase 9 — 유료 권한/결제 mock

## 목표

실제 결제 없이도 수익화 구조를 검증할 수 있게 만든다.

## 구현 범위

- free plan
- premium plan
- entitlement checks
- daily recommendation limit
- daily like limit
- super-like limit
- mock checkout
- mock payment records
- future PG webhook placeholder

## mock 결제 플로우

```txt
1. 요금제 페이지
2. premium 선택
3. mock payment 생성
4. mock checkout 확인
5. payment.status = mock_success
6. entitlement.planId = premium
7. 추천/좋아요 제한 변경
```

## 완료 기준

- free/premium plan 존재
- entitlement가 실제 기능 제한에 반영
- mock checkout으로 premium 전환 가능
- payment 기록 저장
- future webhook 위치 문서화

## 하지 말 것

- 실제 PG 연동 금지
- mock payment를 real payment처럼 취급하지 않음
- premium 제한을 UI에서만 적용하지 않음
- payment 정보를 public profile에 넣지 않음

---

# Phase 10 — 디자인/브랜딩 개선

## 목표

제품 신뢰감, 사용성, 전환율을 높이는 방향으로 디자인을 개선한다.

## 우선순위

1. 온보딩
2. 프로필 작성
3. 사진 업로드
4. 추천 카드
5. 프로필 상세
6. 좋아요/패스/매칭 인터랙션
7. 채팅
8. 신고/차단
9. 요금제
10. 로고/브랜드

## 디자인 원칙

앱은 다음 느낌을 가져야 한다.

- 안전함
- 신뢰감
- 깔끔함
- 현대적
- 너무 가볍거나 싸구려 같지 않음
- 모바일 친화적

## 완료 기준

- 모바일 핵심 플로우 자연스러움
- 추천 카드 UI 완성
- 프로필 상세 UI 읽기 쉬움
- empty/loading/error 상태 디자인
- 요금제 화면에서 free/premium 차이 명확
- 브랜드 스타일 일관

## 하지 말 것

- 로고를 핵심 기능보다 먼저 과하게 파지 않는다.
- 데이터 흐름이 불안정한 화면을 먼저 리디자인하지 않는다.
- 신고/차단 기능을 시각적 깔끔함 때문에 숨기지 않는다.

---

# Phase 11 — 배포/운영 인수인계 문서화

## 목표

미래의 운영자나 개발자가 프로젝트를 이해하고 배포/운영 준비를 할 수 있게 만든다.

## 필요한 문서

권장 문서:

```txt
README.md
ROADMAP.md
DATA_MODEL.md
AUTH_ONBOARDING.md
FUNCTIONS.md
FIREBASE_SETUP.md
ENV.md
ADMIN_GUIDE.md
DEPLOYMENT.md
PAYMENT_INTEGRATION_TODO.md
IDENTITY_VERIFICATION_TODO.md
OPERATION_CHECKLIST.md
```

## 실운영 전 필요 항목

운영 주체가 처리해야 할 항목:

- 사업자 등록
- PG 계약
- 이용약관 법무 검토
- 개인정보처리방침 법무 검토
- 실제 한국 본인확인 API 계약/검토
- CI/DI 등 본인확인 결과 저장 정책
- 환불 정책
- 고객센터 채널
- 신고 대응 정책
- 탈퇴/개인정보 삭제 정책
- 보안 점검
- 모니터링/로그
- 백업 정책
- 장애 대응 정책

## 완료 기준

- 다른 개발자가 로컬 실행 가능
- 환경변수 문서화
- Firebase 세팅 문서화
- Auth/Onboarding 구조 문서화
- 데이터 모델 문서화
- Functions/API 문서화
- 관리자 플로우 문서화
- mock 결제 문서화
- future identity verification 연동 항목 문서화
- 실운영 전 필요 항목 문서화

## 하지 말 것

- 법적으로 운영 준비 완료라고 주장하지 않는다.
- mock 결제를 실제 결제 준비 완료로 표현하지 않는다.
- Firebase/env 설정을 문서 없이 방치하지 않는다.
- Firebase Phone Auth를 실명 본인확인 완료로 표현하지 않는다.

---

## Product-Level Anti-Patterns

피해야 할 것:

- Firebase Phone Auth를 한국식 실명 본인확인으로 취급하기
- 전화번호 인증 성공만으로 가입 완료/추천 가능 상태로 만들기
- 모든 이성 프로필을 무제한 공개 목록처럼 보여주기
- private preference를 상대에게 노출하기
- report/block/payment/admin 데이터를 일반 유저에게 노출하기
- 승인되지 않은 프로필/사진을 추천에 노출하기
- 차단 유저를 다시 추천하거나 채팅 가능하게 두기
- match를 클라이언트에서만 생성하기
- premium 제한을 클라이언트에서만 적용하기
- mock payment를 real payment처럼 취급하기
- 실제 PG 연동을 명시적 요청 없이 시작하기
- 실제 본인확인 API 연동을 명시적 요청 없이 시작하기
- 불필요한 민감정보 수집하기
- 로고/브랜딩을 매칭/안전/데이터보다 먼저 하기
- 서버 상태를 Context, Redux slice, RTK Query에 중복 저장하기
- 데이터/API 경계가 정리되기 전에 상태관리만 대규모 변경하기
- 제품 목적 확인 없이 라이브러리 추가하기

---

## Immediate Next Actions

당장 시작할 순서:

1. 현재 앱 route/main flow 감사
2. Firebase Phone Auth 이후 흐름 분석
3. 최초 가입/기존 로그인 판단 방식 분석
4. 현재 Firebase collection/field 정리
5. 이미지 무한 로딩 해결
6. 신규 auth/onboarding/data model 초안 작성
7. 클라이언트 직접 write 중 Functions로 옮길 것 식별
8. RTK Query baseApi/domain slice 설계
9. 전체 목록 탐색을 추천 기반 플로우로 전환하는 설계 작성

---

## Claude/Codex 작업 프롬프트 예시

### Phase 1 분석만 시킬 때

```txt
CLAUDE.md와 ROADMAP.md를 먼저 읽어줘.

이번 작업은 ROADMAP.md의 Phase 1 범위 안에서 현재 앱을 분석하는 것만 해줘.
아직 코드는 수정하지 마.

특히 다음을 확인해줘.

1. 현재 route 구조
2. Firebase Phone Auth 흐름
3. 전화번호 인증 후 최초 가입/기존 로그인 판단 방식
4. 로그인 후 redirect 구조
5. 보호되어야 하는 페이지
6. 프로필 생성/수정/조회 흐름
7. 이미지 무한 로딩이 발생할 수 있는 코드
8. Firestore read/write 지점
9. Phase 2에서 바꿔야 할 데이터 구조 이슈

작업 결과는 다음 형식으로 정리해줘.

- 현재 구조 요약
- 발견한 문제
- Phase 1에서 먼저 고칠 것
- Phase 2로 넘길 설계 이슈
- 수정 제안
```

### Phase 1 수정까지 시킬 때

```txt
CLAUDE.md와 ROADMAP.md를 먼저 읽어줘.

이번 작업은 ROADMAP.md의 Phase 1 — 현재 앱 안정화만 진행해줘.

목표는 큰 리팩터링이 아니라, 현재 앱의 주요 흐름을 점검하고 불안정한 부분을 고치는 거야.

우선순위는 다음이야.

1. Firebase Phone Auth 흐름 확인
2. 최초 가입/기존 로그인 판단 방식 확인
3. 로그인/로그아웃 흐름 확인
4. 인증 필요 페이지의 route guard 확인
5. 프로필 조회/수정 흐름 확인
6. 이미지 무한 로딩 원인 파악 및 수정
7. 이미지 로딩 실패 시 fallback 처리
8. 주요 페이지의 loading/error/empty 상태 점검

제약:
- 실제 결제 구현하지 말 것
- 실제 본인확인 API 붙이지 말 것
- 데이터 모델 대개편하지 말 것
- RTK Query 마이그레이션 시작하지 말 것
- 전체 UI 리디자인하지 말 것
- 새 라이브러리는 정말 필요할 때만 추가할 것
- next build는 실행하지 말 것

검증은 다음까지만 해줘.

1. npm run lint
2. npx tsc --noEmit

작업 후에는 다음을 정리해줘.

- 수정한 파일
- 발견한 문제
- 고친 내용
- 아직 남은 문제
- Phase 2로 넘겨야 할 auth/onboarding/data model 이슈
```

---

## CLAUDE.md에 추가할 짧은 참조

`CLAUDE.md`에는 로드맵 전체를 붙이지 말고, 상단에 아래 정도만 추가한다.

```md
## Project Roadmap

Before making product-level changes, read `ROADMAP.md`.

`CLAUDE.md` defines coding conventions and implementation rules.
`ROADMAP.md` defines product direction, roadmap priority, auth/onboarding flow, data model, Firebase/Functions boundaries, RTK Query architecture, matching logic, moderation requirements, and mock payment scope.

When implementing features, follow `ROADMAP.md` unless the user explicitly gives a newer instruction.
Do not introduce broad refactors, new libraries, backend structure changes, matching logic changes, payment-related behavior, or identity verification behavior without checking `ROADMAP.md` first.
```
