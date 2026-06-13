'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid } from '@/shared/lib/store/authSlice';
import { getProfileByUserId } from '@/shared/lib/firebase/profiles';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';
import Button from '@/shared/components/common/button/Button';
import OnboardingFooter from './OnboardingFooter';
import styles from './RejectedPage.module.scss';

// /onboarding/rejected
// 관리자 검수 결과 반려된 사용자 진입점.
// 반려 사유를 prominent하게 노출하고 어느 단계를 고칠지 선택할 수 있게 한다.
//   - 프로필 수정 → onboardingStatus = 'profile_required' → /onboarding/profile
//   - 사진 수정 → onboardingStatus = 'photo_required' → /onboarding/photos
// 둘 다 기존 데이터는 보존되며, 수정 후 "다음으로" 를 따라가면 자동으로 consent
// 단계까지 흘러서 review_pending 으로 재제출된다.
const RejectedPage = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const uid = useAppSelector(selectAuthUid);
  const [reason, setReason] = useState<string | null>(null);
  const [pending, setPending] = useState<'profile' | 'photo' | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const load = async () => {
      const profile = await getProfileByUserId(uid);
      setReason(profile?.rejectionReason ?? null);
    };
    void load();
  }, [uid]);

  const goTo = async (step: 'profile' | 'photo') => {
    if (!uid || pending) return;
    setPending(step);
    try {
      const status = step === 'profile' ? 'profile_required' : 'photo_required';
      await transitionOnboardingStatus(dispatch, uid, status);
      router.replace(step === 'profile' ? '/onboarding/profile' : '/onboarding/photos');
    } catch {
      setPending(null);
    }
  };

  return (
    <section className={styles.root}>
      <h1 className={styles.title}>프로필이 반려되었어요</h1>
      <p className={styles.description}>
        관리자가 프로필을 검토한 결과 일부 수정이 필요해요.
      </p>

      <div className={styles.reasonBox} role="region" aria-label="반려 사유">
        <span className={styles.reasonLabel}>반려 사유</span>
        <p className={styles.reasonText}>
          {reason && reason.trim().length > 0
            ? reason
            : '관리자가 별도 사유를 남기지 않았어요. 프로필과 사진을 다시 검토해주세요.'}
        </p>
      </div>

      <p className={styles.hint}>
        수정할 항목을 선택해주세요. 기존에 입력한 정보는 그대로 유지돼요. 수정 후 &quot;다음으로&quot;를 따라가면 자동으로 다시 심사가 신청됩니다.
      </p>

      <div className={styles.actions}>
        <Button
          text={pending === 'profile' ? '이동 중...' : '프로필 수정'}
          onClick={pending ? undefined : () => void goTo('profile')}
        />
        <Button
          type="secondary"
          text={pending === 'photo' ? '이동 중...' : '사진 수정'}
          onClick={pending ? undefined : () => void goTo('photo')}
        />
      </div>

      <OnboardingFooter />
    </section>
  );
};

export default RejectedPage;
