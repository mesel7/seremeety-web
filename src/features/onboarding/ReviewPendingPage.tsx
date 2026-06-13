'use client';

import OnboardingStubLayout from './OnboardingStubLayout';

// /onboarding/review-pending
// 관리자 심사 대기 화면. 사용자 액션 없음. 관리자 승인은 Phase 8에서 구현.
const ReviewPendingPage = () => {
  return (
    <OnboardingStubLayout
      step="STEP 5 / 5"
      title="심사 중"
      description="제출하신 프로필을 관리자가 검토하고 있어요. 보통 24시간 이내에 알려드립니다."
    />
  );
};

export default ReviewPendingPage;
