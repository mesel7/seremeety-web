'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid } from '@/shared/lib/store/authSlice';
import { createConsent } from '@/shared/lib/firebase/consents';
import { getProfileByUserId, updateProfile } from '@/shared/lib/firebase/profiles';
import { goToPreviousOnboardingStep } from '@/shared/lib/onboarding/stepNavigation';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';
import { writeProfileStatusToLegacyUser } from '@/shared/lib/firebase/legacyBridge';
import OnboardingStubLayout from './OnboardingStubLayout';
import styles from './ConsentStepPage.module.scss';

// /onboarding/consent
// 약관/개인정보 동의 후 프로필을 심사 제출. profile.status -> 'pending',
// user.onboardingStatus -> 'review_pending'.
// admin 사용자는 BootstrapPage 에서 onboarding 자체를 건너뛰므로 여기 도달하지 않는다.
const REQUIRED_TERMS_VERSION = '1.0';
const REQUIRED_PRIVACY_VERSION = '1.0';

const ConsentStepPage = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const uid = useAppSelector(selectAuthUid);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllChecked = agreedTerms && agreedPrivacy && agreedMarketing;
  const canSubmit = agreedTerms && agreedPrivacy && !isSubmitting && !isGoingBack;

  const handleToggleAll = (next: boolean) => {
    setAgreedTerms(next);
    setAgreedPrivacy(next);
    setAgreedMarketing(next);
  };

  const handleSubmit = async () => {
    if (!uid || !canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createConsent(uid, {
        termsVersion: REQUIRED_TERMS_VERSION,
        privacyVersion: REQUIRED_PRIVACY_VERSION,
        marketingAgreed: agreedMarketing,
        agreedAt: Timestamp.now(),
      });

      const profile = await getProfileByUserId(uid);
      if (profile) {
        await updateProfile(profile.id, {
          status: 'pending',
          submittedAt: Timestamp.now(),
        });
      }

      // /admin/profiles 큐에서 승인 후 onboardingStatus 'approved' 전이.
      // 그 전까지는 추천에서 제외되도록 legacy users.profileStatus도 0 유지.
      await writeProfileStatusToLegacyUser(uid, false);
      await transitionOnboardingStatus(dispatch, uid, 'review_pending');
      router.replace('/onboarding/review-pending');
    } catch (err) {
      console.error(err);
      setError('제출 중 오류가 발생했어요.');
      setIsSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (!uid || isSubmitting || isGoingBack) return;
    setIsGoingBack(true);
    try {
      const target = await goToPreviousOnboardingStep(dispatch, uid, 'consent_required');
      if (target) {
        router.replace(target.href);
      }
    } catch (err) {
      console.error(err);
      setError('이전 단계로 이동 중 오류가 발생했어요.');
      setIsGoingBack(false);
    }
  };

  return (
    <OnboardingStubLayout
      step="STEP 4 / 5"
      title="약관 및 개인정보 동의"
      description="동의 후 프로필 심사가 시작됩니다. 약관 본문은 Phase 11에서 정식 텍스트로 교체됩니다."
      primaryAction={{
        label: isSubmitting ? '제출 중...' : '동의하고 심사 제출',
        onClick: handleSubmit,
        disabled: !canSubmit,
      }}
      secondaryAction={{
        label: isGoingBack ? '이동 중...' : '이전 단계',
        onClick: () => void handleBack(),
      }}
    >
      <div className={styles.list}>
        <label className={styles.itemAll}>
          <input
            type="checkbox"
            checked={isAllChecked}
            onChange={(e) => handleToggleAll(e.target.checked)}
            className={styles.checkbox}
          />
          <span className={styles.itemAllLabel}>전체 동의</span>
        </label>
        <span className={styles.divider} aria-hidden="true" />
        <label className={styles.item}>
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className={styles.checkbox}
          />
          이용약관에 동의합니다 (필수)
        </label>
        <label className={styles.item}>
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)}
            className={styles.checkbox}
          />
          개인정보처리방침에 동의합니다 (필수)
        </label>
        <label className={styles.item}>
          <input
            type="checkbox"
            checked={agreedMarketing}
            onChange={(e) => setAgreedMarketing(e.target.checked)}
            className={styles.checkbox}
          />
          마케팅 정보 수신에 동의합니다 (선택)
        </label>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </OnboardingStubLayout>
  );
};

export default ConsentStepPage;
