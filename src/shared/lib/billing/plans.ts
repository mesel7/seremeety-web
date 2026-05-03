import type { PlanId } from '@/shared/types/model/billing';

// Phase 9: free/premium plan 정의는 본 모듈이 단일 소스다.
// entitlement 문서 생성/갱신, mock checkout 금액 계산, 요금제 UI 모두
// PLAN_DEFINITIONS를 읽어야 한다. 한도 변경 시 본 파일만 수정한다.
export interface PlanDefinition {
  id: PlanId;
  label: string;
  // 0 = 무료. mock checkout은 priceKrw를 그대로 payments.amount에 기록한다.
  priceKrw: number;
  // premium 구독 기간(일). free는 무기한이라 미정의.
  durationDays?: number;
  dailyRecommendationLimit: number;
  dailyLikeLimit: number;
  dailySuperLikeLimit: number;
  canUseAdvancedFilter: boolean;
  canSeeReceivedLikes: boolean;
  highlights: string[];
}

export const FREE_PLAN: PlanDefinition = {
  id: 'free',
  label: '무료',
  priceKrw: 0,
  dailyRecommendationLimit: 5,
  dailyLikeLimit: 3,
  dailySuperLikeLimit: 0,
  canUseAdvancedFilter: false,
  canSeeReceivedLikes: false,
  highlights: [
    '하루 추천 5명',
    '하루 좋아요 3회',
    '기본 필터',
  ],
};

export const PREMIUM_PLAN: PlanDefinition = {
  id: 'premium',
  label: '프리미엄',
  priceKrw: 9900,
  durationDays: 30,
  dailyRecommendationLimit: 15,
  dailyLikeLimit: 10,
  dailySuperLikeLimit: 3,
  canUseAdvancedFilter: true,
  canSeeReceivedLikes: true,
  highlights: [
    '하루 추천 15명',
    '하루 좋아요 10회',
    '슈퍼 좋아요 3회',
    '받은 좋아요 확인',
    '고급 필터',
  ],
};

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  free: FREE_PLAN,
  premium: PREMIUM_PLAN,
};

export const getPlanDefinition = (planId: PlanId): PlanDefinition =>
  PLAN_DEFINITIONS[planId];
