import type { OnboardingStatus } from '@/shared/types/model/user';
import type { AppDispatch } from '@/shared/lib/store/store';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';

// 온보딩 step 간 "이전 단계" 매핑. 해당 step에서 한 단계 뒤로 갈 때 쓸 onboardingStatus와
// route를 함께 반환. 첫 단계나 review-pending 같은 "되돌릴 수 없는" 단계는 null.
interface StepBackTarget {
  status: OnboardingStatus;
  href: string;
}

const PREV_STEP: Partial<Record<OnboardingStatus, StepBackTarget>> = {
  photo_required: { status: 'profile_required', href: '/onboarding/profile' },
  preference_required: { status: 'photo_required', href: '/onboarding/photos' },
  consent_required: { status: 'preference_required', href: '/onboarding/preferences' },
};

export const getOnboardingBackTarget = (
  current: OnboardingStatus
): StepBackTarget | null => PREV_STEP[current] ?? null;

export const goToPreviousOnboardingStep = async (
  dispatch: AppDispatch,
  uid: string,
  current: OnboardingStatus
): Promise<StepBackTarget | null> => {
  const target = getOnboardingBackTarget(current);
  if (!target) return null;
  await transitionOnboardingStatus(dispatch, uid, target.status);
  return target;
};
