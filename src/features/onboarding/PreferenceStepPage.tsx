'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid } from '@/shared/lib/store/authSlice';
import {
  createPreference,
  getPreferenceByUserId,
  updatePreference,
} from '@/shared/lib/firebase/preferences';
import { getProfileByUserId } from '@/shared/lib/firebase/profiles';
import { goToPreviousOnboardingStep } from '@/shared/lib/onboarding/stepNavigation';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';
import { placeList } from '@/shared/data/places';
import { cx } from '@/shared/lib/classNames';
import Button from '@/shared/components/common/button/Button';
import OnboardingFooter from './OnboardingFooter';
import type { Gender } from '@/shared/types/model/profile';
import styles from './PreferenceStepPage.module.scss';

const flatLocationList = placeList.flatMap(([region]) => [region]);

const MIN_AGE_LIMIT = 18;
const MAX_AGE_LIMIT = 80;

interface PreferenceFormState {
  minAge: string;
  maxAge: string;
  preferredLocations: string[];
}

const initialForm: PreferenceFormState = {
  minAge: '20',
  maxAge: '35',
  preferredLocations: [],
};

const PreferenceStepPage = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const uid = useAppSelector(selectAuthUid);
  const [form, setForm] = useState<PreferenceFormState>(initialForm);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [userGender, setUserGender] = useState<Gender | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const load = async () => {
      const [existing, profile] = await Promise.all([
        getPreferenceByUserId(uid),
        getProfileByUserId(uid),
      ]);
      if (profile?.gender) {
        setUserGender(profile.gender);
      }
      if (existing) {
        setPreferenceId(existing.id);
        setForm({
          minAge: String(existing.minAge),
          maxAge: String(existing.maxAge),
          preferredLocations: existing.preferredLocations,
        });
      }
      setIsLoading(false);
    };
    void load();
  }, [uid]);

  const toggleLocation = (location: string) => {
    setForm((prev) => {
      const next = prev.preferredLocations.includes(location)
        ? prev.preferredLocations.filter((l) => l !== location)
        : [...prev.preferredLocations, location];
      return { ...prev, preferredLocations: next };
    });
  };

  const validate = (): string | null => {
    const min = Number(form.minAge);
    const max = Number(form.maxAge);
    if (!min || min < MIN_AGE_LIMIT || min > MAX_AGE_LIMIT) {
      return `최소 나이는 ${MIN_AGE_LIMIT}~${MAX_AGE_LIMIT} 사이로 입력해주세요`;
    }
    if (!max || max < MIN_AGE_LIMIT || max > MAX_AGE_LIMIT) {
      return `최대 나이는 ${MIN_AGE_LIMIT}~${MAX_AGE_LIMIT} 사이로 입력해주세요`;
    }
    if (min > max) return '최소 나이가 최대 나이보다 클 수 없어요';
    if (!userGender) return '프로필 성별 정보를 불러오지 못했어요. 새로고침해주세요.';
    return null;
  };

  const handleSubmit = async () => {
    if (!uid) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const validationError = validate();
      if (validationError) {
        setError(validationError);
        setIsSubmitting(false);
        return;
      }

      // 매칭 대상 성별은 사용자 본인 성별의 반대로 자동 결정.
      // (다양한 지향성 옵션은 추후 별도 슬라이스.)
      const targetGender: Gender = userGender === 'male' ? 'female' : 'male';

      const payload = {
        targetGender,
        minAge: Number(form.minAge),
        maxAge: Number(form.maxAge),
        preferredLocations: form.preferredLocations,
      };

      if (preferenceId) {
        await updatePreference(preferenceId, payload);
      } else {
        await createPreference(uid, payload);
      }

      await transitionOnboardingStatus(dispatch, uid, 'consent_required');
      router.replace('/onboarding/consent');
    } catch (err) {
      console.error(err);
      setError('저장 중 오류가 발생했어요.');
      setIsSubmitting(false);
    }
  };

  const handleBack = async () => {
    if (!uid || isSubmitting || isGoingBack) return;
    setIsGoingBack(true);
    try {
      const target = await goToPreviousOnboardingStep(dispatch, uid, 'preference_required');
      if (target) {
        router.replace(target.href);
      }
    } catch (err) {
      console.error(err);
      setError('이전 단계로 이동 중 오류가 발생했어요.');
      setIsGoingBack(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.root}>
        <p className={styles.step}>STEP 3 / 5</p>
        <h1 className={styles.title}>매칭 선호 조건</h1>
        <p className={styles.description}>잠시만 기다려주세요...</p>
      </section>
    );
  }

  return (
    <section className={styles.root}>
      <p className={styles.step}>STEP 3 / 5</p>
      <h1 className={styles.title}>매칭 선호 조건</h1>
      <p className={styles.description}>
        상대에게는 보이지 않아요. 매칭에만 사용됩니다.
      </p>

      <div className={styles.ageRow}>
        <label className={styles.field}>
          <span className={styles.label}>최소 나이</span>
          <input
            type="number"
            value={form.minAge}
            onChange={(e) => setForm((prev) => ({ ...prev, minAge: e.target.value }))}
            min={MIN_AGE_LIMIT}
            max={MAX_AGE_LIMIT}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>최대 나이</span>
          <input
            type="number"
            value={form.maxAge}
            onChange={(e) => setForm((prev) => ({ ...prev, maxAge: e.target.value }))}
            min={MIN_AGE_LIMIT}
            max={MAX_AGE_LIMIT}
          />
        </label>
      </div>

      <div className={styles.field}>
        <span className={styles.label} id="onboarding-locations-label">
          선호 지역 (다중 선택, 미선택 시 전체)
        </span>
        <div
          className={styles.chipGroup}
          role="group"
          aria-labelledby="onboarding-locations-label"
        >
          {flatLocationList.map((p) => {
            const selected = form.preferredLocations.includes(p);
            return (
              <button
                key={p}
                type="button"
                className={cx(styles.chip, selected && styles['chip--selected'])}
                aria-pressed={selected}
                onClick={() => toggleLocation(p)}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          text={isSubmitting ? '저장 중...' : '다음으로'}
          onClick={isSubmitting ? undefined : () => void handleSubmit()}
        />
        <Button
          type="secondary"
          text={isGoingBack ? '이동 중...' : '이전 단계'}
          onClick={isGoingBack || isSubmitting ? undefined : () => void handleBack()}
        />
      </div>
      <OnboardingFooter />
    </section>
  );
};

export default PreferenceStepPage;
