import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { getPlanDefinition } from '@/shared/lib/billing/plans';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Entitlement, PlanId } from '@/shared/types/model/billing';

const COLLECTION = 'entitlements';

// PlanDefinition에서 entitlement 문서에 들어갈 한도 필드만 추출.
const limitsFromPlan = (planId: PlanId) => {
  const plan = getPlanDefinition(planId);
  return {
    dailyRecommendationLimit: plan.dailyRecommendationLimit,
    dailyLikeLimit: plan.dailyLikeLimit,
    dailySuperLikeLimit: plan.dailySuperLikeLimit,
    canUseAdvancedFilter: plan.canUseAdvancedFilter,
    canSeeReceivedLikes: plan.canSeeReceivedLikes,
  };
};

export const getEntitlementByUserId = async (userId: string): Promise<Entitlement | null> => {
  const docSnap = await getDoc(doc(db, COLLECTION, userId));
  if (!docSnap.exists()) {
    return null;
  }
  return toPlainTimestamps(docSnap.data() as Entitlement);
};

export const createDefaultEntitlement = async (userId: string): Promise<void> => {
  await setDoc(doc(db, COLLECTION, userId), {
    userId,
    planId: 'free',
    ...limitsFromPlan('free'),
    startsAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const setEntitlementPlan = async (userId: string, planId: PlanId): Promise<void> => {
  // setDoc + merge로 upsert. Phase 6 이전부터 존재하던 사용자(BootstrapPage에서
  // createDefaultEntitlement를 거치지 않은)가 결제하거나 운영자가 plan을
  // 강제 변경하는 경우에도 idempotent 동작하도록 한다. updateDoc은 doc 부재 시
  // throw하므로 본 함수에는 부적합.
  // premium 전환 시 한도 + 시작 시각을 함께 갱신해 KST 기준 카운터가 자연스럽게
  // 새 한도로 전환되도록 한다.
  await setDoc(
    doc(db, COLLECTION, userId),
    {
      userId,
      planId,
      ...limitsFromPlan(planId),
      startsAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
