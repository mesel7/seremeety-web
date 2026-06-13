# 결제(mock) / 권한 — seremeety-web

> mock 결제로 `premium` 전환을 시뮬레이트하고, `entitlements` 문서에 일일 한도를 denormalize해 추천·좋아요·기능 노출을 제어하는 도메인. 실 PG 연동 코드는 없다. **결제 생성/완료/취소는 Functions callable**이 처리하며(Phase 3-B), client는 `payments`/`entitlements`를 직접 쓰지 않는다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / RTK Query / Functions 경계
> - [`roadmap.md`](../roadmap.md) — Phase 9 mock 결제 범위
> - [`data-model.md`](../data-model.md) — `entitlements` / `payments` 컬렉션 정의
> - [`matching.md`](./matching.md) — 좋아요/추천 한도가 실제로 소비되는 곳

---

## 1. 개요

free / premium 두 플랜만 존재한다. 플랜의 한도·가격·기간·특징은 [`plans.ts`](../../src/shared/lib/billing/plans.ts)의 `PLAN_DEFINITIONS` 한 곳에서만 정의되는 **단일 소스(SSOT)**다.

| 플랜 | 가격 | 기간 | 추천/일 | 좋아요/일 | 슈퍼좋아요/일 | 고급 필터 | 받은 좋아요 |
|---|---|---|---|---|---|---|---|
| `free` | 0원 | 무기한 | 5 | 3 | 0 | 불가 | 불가 |
| `premium` | 9,900원 | 30일 (`durationDays`) | 15 | 10 | 3 | 가능 | 가능 |

설계의 핵심은 두 가지다.

- **권한(entitlement)**: 사용자별 현재 `planId` + 일일 한도 필드를 `entitlements/{uid}` 문서에 **denormalize 저장**한다. 런타임 조회 시 `plans.ts`를 다시 읽지 않고 entitlement 문서 1회 조회로 한도 판정이 끝난다.
- **결제(payment)**: `payments/{id}` 문서에 mock 결제 이력을 남긴다. 실제 PG 호출은 없으며, 사용자가 모달에서 성공/실패를 직접 선택한다. 결제 성공 시에만 entitlement가 `premium`으로 갱신된다.

`premium` 구독 기간(30일)과 `expiresAt` 만료 정책은 **현재 구현되지 않았다** (6절 참고).

---

## 2. 핵심 흐름

### 2-1. 가입 시 기본 권한 생성

```
Phone Auth 성공 → BootstrapPage → createDefaultEntitlement(uid)
  → entitlements/{uid} = { planId: 'free', ...FREE_PLAN 한도, startsAt: serverTimestamp() }
```

[`createDefaultEntitlement`](../../src/shared/lib/firebase/entitlements.ts)는 `limitsFromPlan('free')`로 `free` 한도를 펼쳐 저장한다.

### 2-2. mock 결제로 premium 전환

[`PlanContent`](../../src/features/plan/components/plan/PlanContent.tsx)에서 "프리미엄 시작"을 누르면 2단계로 진행된다.

```
1) mockCheckout({ planId: 'premium' })
     → createMockPayment callable (Functions)
     → payments/{id} = { status: 'mock_pending', provider: 'mock', amount=server PLANS, ... }
     → paymentId 반환 → MockCheckoutModal 표시

2) 사용자가 모달에서 "결제 성공" / "결제 실패" 선택
     → mockComplete({ paymentId, success })   // planId는 더 이상 client 신뢰 안 함
         → completeMockPayment callable (Functions):
             - requireAuthedUser → 본인의 mock_pending 결제인지 검증
             - success면 batch: payment.status='mock_success' + entitlements/{uid}를 결제한 plan으로 (server PLANS 한도) atomic 갱신
             - 실패면 payment.status='mock_failed'만
     → invalidatesTags(['Payment', 'Entitlement', 'Recommendation'])
```

한도는 항상 서버 [`PLANS`](../../functions/src/lib/plans.ts)로만 적용되고, payment+entitlement가 한 batch로 갱신되어 **2단계 비원자성 문제가 해소**됐다. plan은 클라이언트 입력이 아니라 `payments` 문서의 `planId`를 신뢰원으로 쓴다.

### 2-3. 구독 취소 (mock)

```
PlanContent "구독 취소" → cancelMockSubscription
  → cancelMockSubscription callable (Functions) → entitlements/{uid}를 free로 (server PLANS) 갱신
  → invalidatesTags(['Entitlement', 'Recommendation'])
```

환불 처리나 별도 `payments` 문서는 만들지 않는다. 서버가 즉시 free로 플립할 뿐이다.

### 2-4. 한도·기능 게이팅

| 게이트 | 위치 | 검증 방식 |
|---|---|---|
| 일일 추천 노출 | [`recommendations.ts`](../../src/shared/lib/firebase/recommendations.ts) (클라이언트) | `entitlement.dailyRecommendationLimit`로 오늘 노출 수 제한 |
| 좋아요 / 슈퍼좋아요 | [`functions react onCall`](../../functions/src/reactions/react.ts) (서버) | `entitlements/{uid}` 직접 조회 → KST 자정 기준 `count()` → 초과 시 `{ ok: false, reason: 'daily_limit' }` |
| 받은 좋아요 페이지 | [`ReceivedLikesContent`](../../src/features/likes/components/likes/ReceivedLikesContent.tsx) | `entitlement.planId !== 'premium'`이면 `PremiumGate` 렌더 |
| 마이페이지 왕관 | [`MypagePage`](../../src/features/profile/MypagePage.tsx) | `planId === 'premium'`이면 크라운 활성화 |

좋아요 한도만 서버(Functions)에서 강제되고, 추천 한도는 클라이언트 조회로 처리된다 (5절 트레이드오프 참고).

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`billing.ts`](../../src/shared/types/model/billing.ts) | `PlanId` / `Entitlement` / `Payment` / `PaymentStatus` / `PaymentProvider` 타입 중앙 정의 |
| [`plans.ts`](../../src/shared/lib/billing/plans.ts) | `PLAN_DEFINITIONS` (free/premium 한도·가격·기간·특징)의 단일 소스 |
| [`entitlements.ts`](../../src/shared/lib/firebase/entitlements.ts) | `entitlements` 컬렉션 — `createDefaultEntitlement`(bootstrap free 생성), `setEntitlementPlan`(admin 보정용). 결제 전환은 Functions가 처리 |
| [`payments.ts`](../../src/shared/lib/firebase/payments.ts) | `payments` 컬렉션 **read 전용** 헬퍼(`getMyPayments`/`getPaymentById`). 생성/완료는 Functions로 이전됨 |
| [`functions/src/payments/checkout.ts`](../../functions/src/payments/checkout.ts) | **결제 callable** — `createMockPayment`/`completeMockPayment`/`cancelMockSubscription` (payment+entitlement atomic) |
| [`functions/src/lib/plans.ts`](../../functions/src/lib/plans.ts) | 서버 권위 plan 한도(`PLANS`) — entitlement 기록은 이 값만 사용 |
| [`paymentApi.ts`](../../src/shared/lib/api/paymentApi.ts) | RTK Query 슬라이스 — `getMyPayments`(read) + `mockCheckout`/`mockComplete`/`cancelMockSubscription`(callable 호출) |
| [`entitlementApi.ts`](../../src/shared/lib/api/entitlementApi.ts) | RTK Query 슬라이스 — `getMyEntitlement` (현재 plan + 한도 조회) |
| [`PlanPage.tsx`](../../src/features/plan/PlanPage.tsx) | 요금제 페이지 진입점 |
| [`PlanContent.tsx`](../../src/features/plan/components/plan/PlanContent.tsx) | 요금제 비교 UI, 구독/취소 로직, checkout/결과 모달 상태 관리 |
| [`MockCheckoutModal.tsx`](../../src/features/plan/components/plan/MockCheckoutModal.tsx) | mock 결제 시뮬레이션 모달 (성공/실패 직접 선택) |
| [`PlanCard.tsx`](../../src/features/plan/components/plan/PlanCard.tsx) | 개별 플랜 카드 (이름·가격·특징·CTA) |
| [`PaymentHistory.tsx`](../../src/features/plan/components/plan/PaymentHistory.tsx) | 결제 내역 테이블 (날짜 역순, status 배지) |
| [`BootstrapPage.tsx`](../../src/features/onboarding/BootstrapPage.tsx) | 가입 시 기본 free entitlement 생성 |
| [`recommendations.ts`](../../src/shared/lib/firebase/recommendations.ts) | `dailyRecommendationLimit` 기반 추천 노출 제한 |
| [`react.ts`](../../functions/src/reactions/react.ts) | 좋아요/슈퍼좋아요 한도 서버 검증 (Functions onCall) |
| [`ReceivedLikesContent.tsx`](../../src/features/likes/components/likes/ReceivedLikesContent.tsx) | premium 전용 게이팅 (`PremiumGate`) |

---

## 4. 데이터·상태

### entitlements/{uid}

`planId`만 저장하지 않고 한도 필드를 denormalize해 함께 저장한다.

```ts
interface Entitlement {
  userId: string;
  planId: 'free' | 'premium';
  dailyRecommendationLimit: number;   // free 5 / premium 15
  dailyLikeLimit: number;             // free 3 / premium 10
  dailySuperLikeLimit: number;        // free 0 / premium 3
  canUseAdvancedFilter: boolean;
  canSeeReceivedLikes: boolean;
  startsAt: TimestampLike;            // 플랜 변경/갱신 시점 (KST 카운터 기준)
  expiresAt?: TimestampLike;          // 타입에만 존재, 현재 미사용
  updatedAt: TimestampLike;
}
```

`setEntitlementPlan`은 plan 전환 시 `limitsFromPlan(planId)`로 모든 한도 필드를 동시에 덮어쓰고, `startsAt`을 `serverTimestamp()`로 갱신한다.

### payments/{id}

```ts
interface Payment {
  id: string;
  userId: string;
  provider: 'mock' | 'future_pg';     // 현재 항상 'mock'
  providerPaymentId?: string;         // 미사용 (PG 연동 시 채움)
  planId: PlanId;
  amount: number;                     // plan.priceKrw 그대로 기록 (9900)
  currency: 'KRW';
  status: PaymentStatus;
  createdAt; updatedAt;
}
```

`PaymentStatus`는 `'mock_pending' | 'mock_success' | 'mock_failed' | 'cancelled' | 'refunded'`로 정의돼 있으나, **현재 실제로 쓰이는 값은 `mock_pending` / `mock_success` / `mock_failed` 3개뿐**이다. `cancelled` / `refunded`는 향후 PG 연동용 placeholder다.

`getPaymentsByUserId`는 `userId` 단일 where + 클라이언트 정렬을 쓴다 (composite index 회피, 사용자별 결제 건수가 적다는 가정).

### RTK Query 캐시

| 슬라이스 / 엔드포인트 | 태그 |
|---|---|
| `entitlementApi.getMyEntitlement` | `provides: ['Entitlement']`, `keepUnusedDataFor: 120` |
| `paymentApi.getMyPayments` | `provides: ['Payment']` |
| `paymentApi.mockCheckout` | `invalidates: ['Payment']` |
| `paymentApi.mockComplete` | `invalidates: ['Payment', 'Entitlement', 'Recommendation']` |
| `paymentApi.cancelMockSubscription` | `invalidates: ['Entitlement', 'Recommendation']` |

`mockComplete` / `cancelMockSubscription`이 `Entitlement`를 invalidate하므로, 마이페이지·받은 좋아요 등 `useGetMyEntitlementQuery`를 구독하는 화면이 plan 변경을 즉시 반영한다. `Recommendation` invalidate로 한도 변경이 추천 피드에도 전파된다.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| `plans.ts`를 free/premium 정의의 단일 소스(SSOT)로 | 한도 변경 시 한 파일만 수정하면 UI·초기화·제약이 자동 동기화 | 이미 생성된 `entitlements` 문서는 자동 갱신되지 않음 → 마이그레이션 필요 |
| entitlement 문서에 한도 필드를 **denormalize** 저장 | 런타임에 `plans.ts` fetch 없이 문서 1회 조회로 완결. plan 정의 변경이 과거 사용자 한도를 소급 변경하는 것 방지 | plan 전환 시 모든 한도 필드를 동시 갱신해야 함 — 일관성 책임이 `setEntitlementPlan`에 집중 |
| 추천 한도는 **클라이언트**, 좋아요 한도는 **Functions**에서 검증 | 추천은 조회(read)라 클라이언트로 충분, 좋아요는 mutation이라 서버 강제가 필수(우회 방지) | 한도 검증 로직이 두 곳에 산재 — 동작 차이 시 버그 위험 |
| mock 결제 생성/완료/취소를 **Functions callable**로 처리 (Phase 3-B) | 한도를 항상 서버 `PLANS`로만 적용해 클라이언트의 임의 한도 주입을 차단하고, payment+entitlement를 atomic하게 갱신. 실 PG webhook 교체 지점을 한 곳에 모음 | mock은 결제 검증이 없어 "success"가 클라이언트 트리거 — premium 자가 획득 자체는 실 PG 검증 전까지 가능. server `PLANS`를 client `plans.ts`와 수동 동기화해야 함 |
| `setEntitlementPlan` 시 `startsAt = serverTimestamp()` 기록 | 일일 한도가 KST 자정 기준이라, plan 전환 시점을 기준으로 새 한도가 자연스럽게 적용 | `dailyLimits.ts`의 `getKstTodayStartMs()`와 `startsAt`이 함께 동작 — 한쪽만 바꾸면 offset 버그 |
| 받은 좋아요 페이지를 premium 전용으로 제약 | 수익화 구조 (free는 보낸 좋아요까지, premium은 받은 좋아요 + 고급 필터) | **UI 레벨 제약만** — free 사용자가 `getReceivedLikeProfiles` 쿼리를 직접 호출하는 우회를 막으려면 Rules 강제 필요 |

---

## 6. 현재 상태

### 구현됨

- free/premium 플랜 정의 (`plans.ts`의 `PLAN_DEFINITIONS`)
- `entitlements` 컬렉션 CRUD — 가입 시 기본 free 생성, `setEntitlementPlan` 전환(merge upsert)
- `payments` 컬렉션 + mock 결제 흐름 (`mockCheckout` → `mockComplete`) — **Functions callable 기반**, payment+entitlement atomic
- 결제/권한 write의 server-only 잠금 (Phase 3-B): `payments` write server-only, `entitlements` update admin-only
- RTK Query 슬라이스(`entitlementApi`, `paymentApi`)와 태그 기반 cache invalidation
- 추천 페이지의 `dailyRecommendationLimit` 노출 제한
- Functions `react` onCall의 `dailyLikeLimit` / `dailySuperLikeLimit` 서버 검증
- 요금제 UI (`PlanCard`, `MockCheckoutModal`, `PaymentHistory`)
- 마이페이지 왕관 + 받은 좋아요의 `planId` 기반 UI 게이팅
- "mock 결제 환경" 안내 배너 상시 노출 (`role="note"`)

### 남은 작업

- 실제 PG 연동 (Stripe / KakaoPay / Toss 등) — `completeMockPayment` 본체를 결제 검증 + webhook으로 대체
- `payment.providerPaymentId` 채우기 (mock에서는 미사용)
- 서버 `PLANS`(functions)와 클라이언트 `plans.ts`의 한도 동기화 자동화 (현재 수동)
- 구독 만료(`expiresAt`) / 환불 정책 구현 (현재 mock 범위 밖)
- admin 콘솔에서 사용자 plan 수동 변경
- 일일 한도 검증 위치 통일 (클라이언트 추천 vs Functions 좋아요)
- plan 정의 변경 시 기존 `entitlements` 문서 일괄 업그레이드 마이그레이션 스크립트

### 알려진 위험

- **mock의 본질적 한계 (남은 핵심)**: write는 Functions로 잠갔고 한도는 서버 `PLANS`로만 적용되지만, mock은 실제 결제 검증이 없어 "success"가 클라이언트 트리거다 → 사용자가 mock으로 **premium 자체는 자가 획득** 가능. 임의 한도 주입·타인 데이터 접근은 차단됨. 실 PG 결제 검증이 들어와야 닫힌다.
- **server/client plan 정의 이중화**: 한도가 `functions/src/lib/plans.ts`(기록용)와 `src/shared/lib/billing/plans.ts`(UI용) 두 곳에 있어 수동 동기화가 필요하다.
- **denormalize 정합성**: plan 정의 변경이 기존 사용자 entitlement 문서에 자동 반영되지 않는다(마이그레이션 필요).
- **`mock_pending` 누적**: 사용자가 결제 모달을 닫고 재시도하면 이전 `mock_pending` 문서를 정리하지 않고 새 payment를 만든다 (`handleCloseCheckout` 주석 명시). 정리 정책 미정.
- **KST 카운터 의존**: `entitlements.startsAt`과 `getKstTodayStartMs()`가 어긋나면 일일 한도 리셋 시점에 offset이 생길 수 있다.
- **받은 좋아요 게이트는 UI 레벨만**: free 사용자가 쿼리를 우회 호출해도 Rules가 막지 않는다 (응답만 비는 수준).
