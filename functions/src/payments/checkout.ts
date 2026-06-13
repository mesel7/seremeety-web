import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { requireAuthedUser } from '../lib/auth';
import { PLANS, isPlanId, type PlanId, type PlanLimits } from '../lib/plans';

// Phase 3-B: mock 결제/권한 변경을 Functions로 이전.
// 기존 client paymentApi(createMockPayment / completeMockPayment + setEntitlementPlan,
// cancelMockSubscription)가 payments·entitlements를 직접 write하던 것을 server로 옮겨,
// 클라이언트가 entitlement 한도를 임의로 쓰지 못하게 한다(firestore.rules에서
// entitlements update / payments write를 client에 차단).
//
// 주의: mock은 실제 결제 검증이 없어 "success"가 클라이언트 트리거다. 따라서 본 이전이
// mock self-upgrade 자체를 막지는 못한다. 다만 (1) 한도를 항상 서버 PLANS로만 적용하고,
// (2) payment+entitlement를 atomic하게 갱신하며, (3) 실 PG webhook으로 교체할 지점을
// 한 곳에 모은다. 실 PG 도입 시 completeMockPayment 본체를 결제 검증 → webhook으로 대체한다.

const entitlementFields = (uid: string, plan: PlanLimits) => ({
  userId: uid,
  planId: plan.planId,
  dailyRecommendationLimit: plan.dailyRecommendationLimit,
  dailyLikeLimit: plan.dailyLikeLimit,
  dailySuperLikeLimit: plan.dailySuperLikeLimit,
  canUseAdvancedFilter: plan.canUseAdvancedFilter,
  canSeeReceivedLikes: plan.canSeeReceivedLikes,
  startsAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp(),
});

interface CreateInput {
  planId: PlanId;
}
interface CreateOutput {
  paymentId: string;
}

// mock checkout 시작. 'mock_pending' 결제 문서를 server에서 생성한다.
// amount는 클라이언트 입력이 아니라 서버 PLANS의 가격으로 기록한다.
export const createMockPayment = onCall<CreateInput, Promise<CreateOutput>>(
  { maxInstances: 5 },
  async (request) => {
    const { uid } = await requireAuthedUser(request);
    const planId = request.data?.planId;
    if (!isPlanId(planId)) {
      throw new HttpsError('invalid-argument', 'invalid_plan');
    }
    if (planId === 'free') {
      throw new HttpsError('invalid-argument', 'free_not_purchasable');
    }
    const plan = PLANS[planId];
    const ref = db.collection('payments').doc();
    await ref.set({
      id: ref.id,
      userId: uid,
      provider: 'mock',
      planId,
      amount: plan.priceKrw,
      currency: 'KRW',
      status: 'mock_pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { paymentId: ref.id };
  }
);

interface CompleteInput {
  paymentId: string;
  success: boolean;
}
interface CompleteOutput {
  paymentId: string;
  status: 'mock_success' | 'mock_failed';
}

// mock checkout 완료. 본인의 mock_pending 결제만 종결할 수 있다.
// success면 payment.status=mock_success + entitlement를 결제한 plan으로 atomic 갱신.
// plan은 클라이언트 입력이 아니라 payment 문서의 planId를 신뢰원으로 사용한다.
export const completeMockPayment = onCall<CompleteInput, Promise<CompleteOutput>>(
  { maxInstances: 5 },
  async (request) => {
    const { uid } = await requireAuthedUser(request);
    const paymentId = request.data?.paymentId;
    const success = request.data?.success;
    if (!paymentId || typeof paymentId !== 'string') {
      throw new HttpsError('invalid-argument', 'invalid_payment');
    }
    if (typeof success !== 'boolean') {
      throw new HttpsError('invalid-argument', 'invalid_success');
    }

    const payRef = db.doc(`payments/${paymentId}`);
    const snap = await payRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'payment_not_found');
    }
    const pay = snap.data() ?? {};
    if (pay.userId !== uid) {
      throw new HttpsError('permission-denied', 'not_your_payment');
    }
    if (pay.status !== 'mock_pending') {
      throw new HttpsError('failed-precondition', 'not_pending');
    }
    const planId: PlanId = isPlanId(pay.planId) ? pay.planId : 'free';

    if (!success) {
      await payRef.update({
        status: 'mock_failed',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { paymentId, status: 'mock_failed' };
    }

    // payment 성공 + entitlement 갱신을 atomic batch로.
    const plan = PLANS[planId];
    const batch = db.batch();
    batch.update(payRef, {
      status: 'mock_success',
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.doc(`entitlements/${uid}`), entitlementFields(uid, plan), {
      merge: true,
    });
    await batch.commit();
    return { paymentId, status: 'mock_success' };
  }
);

interface CancelOutput {
  ok: true;
}

// mock 구독 취소 → entitlement를 free로 즉시 다운그레이드 (server-only).
// 환불/만료(expiresAt) 정책은 mock 범위 밖. 실 PG 도입 시 환불 webhook으로 교체.
export const cancelMockSubscription = onCall<void, Promise<CancelOutput>>(
  { maxInstances: 5 },
  async (request) => {
    const { uid } = await requireAuthedUser(request);
    await db
      .doc(`entitlements/${uid}`)
      .set(entitlementFields(uid, PLANS.free), { merge: true });
    return { ok: true };
  }
);
