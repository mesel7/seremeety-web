'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid } from '@/shared/lib/store/authSlice';
import {
  createDraftProfile,
  getProfileByUserId,
  updateProfile,
} from '@/shared/lib/firebase/profiles';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';
import { writeProfileToLegacyUser } from '@/shared/lib/firebase/legacyBridge';
import { checkNicknameDuplicate } from '@/shared/lib/firebase/users';
import { placeList } from '@/shared/data/places';
import { universityList } from '@/shared/data/universities';
import Button from '@/shared/components/common/button/Button';
import CustomRadio from '@/shared/components/common/custom-radio/CustomRadio';
import DatePicker from '@/shared/components/common/date-picker/DatePicker';
import Select, { type SelectOption } from '@/shared/components/common/select/Select';
import OnboardingFooter from './OnboardingFooter';
import type { Gender } from '@/shared/types/model/profile';
import styles from './ProfileStepPage.module.scss';

const MBTI_OPTIONS = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
];

// 입력 가능한 birthdate 범위 (만 18세 이상 ~ 80세 이하).
const today = new Date();
const formatYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const MAX_BIRTHDATE = formatYmd(
  new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
);
const MIN_BIRTHDATE = formatYmd(
  new Date(today.getFullYear() - 80, today.getMonth(), today.getDate())
);

interface ProfileFormState {
  nickname: string;
  birthdate: string; // YYYY-MM-DD
  gender: Gender | '';
  locationRegion: string;
  locationDistrict: string;
  bio: string;
  mbti: string;
  university: string;
}

const initialForm: ProfileFormState = {
  nickname: '',
  birthdate: '',
  gender: '',
  locationRegion: '',
  locationDistrict: '',
  bio: '',
  mbti: '',
  university: '',
};

const REGION_OPTIONS: SelectOption[] = placeList.map(([region]) => ({
  value: region,
  label: region,
}));

const MBTI_SELECT_OPTIONS: SelectOption[] = MBTI_OPTIONS.map((option) => ({
  value: option,
  label: option,
}));

const UNIVERSITY_OPTIONS: SelectOption[] = universityList.map((option) => ({
  value: option,
  label: option,
}));

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 12;

type NicknameStatus = 'idle' | 'checking' | 'available' | 'duplicate' | 'invalid';

// 기존 birthYear/Month/Day → "YYYY-MM-DD" 문자열로 합치기.
const toBirthdateString = (
  year?: number,
  month?: number,
  day?: number
): string => {
  if (!year || !month || !day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const ProfileStepPage = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const uid = useAppSelector(selectAuthUid);
  const [form, setForm] = useState<ProfileFormState>(initialForm);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const initialNicknameRef = useRef<string>('');
  const nicknameCheckSeqRef = useRef(0);

  // 선택된 region에 해당하는 district 옵션. region이 바뀌면 district는 리셋.
  const districtOptions = useMemo<SelectOption[]>(() => {
    const entry = placeList.find(([region]) => region === form.locationRegion);
    if (!entry || entry[1].length === 0) return [];
    return entry[1].map((d) => ({ value: d, label: d }));
  }, [form.locationRegion]);

  useEffect(() => {
    if (!uid) {
      return;
    }
    const load = async () => {
      const existing = await getProfileByUserId(uid);
      if (existing) {
        setProfileId(existing.id);
        initialNicknameRef.current = existing.nickname ?? '';
        setForm({
          nickname: existing.nickname ?? '',
          birthdate: toBirthdateString(
            existing.birthYear,
            existing.birthMonth,
            existing.birthDay
          ),
          gender: existing.gender ?? '',
          locationRegion: existing.location ?? '',
          locationDistrict: existing.locationDistrict ?? '',
          bio: existing.bio ?? '',
          mbti: existing.mbti ?? '',
          university: existing.university ?? '',
        });
      }
      setIsLoading(false);
    };
    void load();
  }, [uid]);

  const updateField = <K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) => {
    setForm((prev) => {
      // region이 변경되면 district 리셋.
      if (key === 'locationRegion' && prev.locationRegion !== value) {
        return { ...prev, [key]: value, locationDistrict: '' };
      }
      return { ...prev, [key]: value };
    });
    if (key === 'nickname') {
      setNicknameStatus('idle');
    }
  };

  // 닉네임 onBlur — 길이 / 중복 즉시 안내. 동시 호출 방지를 위해 seq 카운터 사용.
  const handleNicknameBlur = async () => {
    const name = form.nickname.trim();
    if (!name) {
      setNicknameStatus('idle');
      return;
    }
    if (name.length < NICKNAME_MIN || name.length > NICKNAME_MAX) {
      setNicknameStatus('invalid');
      return;
    }
    if (name === initialNicknameRef.current) {
      setNicknameStatus('available');
      return;
    }
    nicknameCheckSeqRef.current += 1;
    const seq = nicknameCheckSeqRef.current;
    setNicknameStatus('checking');
    try {
      const isAvailable = await checkNicknameDuplicate(name);
      if (seq !== nicknameCheckSeqRef.current) {
        return;
      }
      setNicknameStatus(isAvailable ? 'available' : 'duplicate');
    } catch {
      if (seq !== nicknameCheckSeqRef.current) {
        return;
      }
      setNicknameStatus('idle');
    }
  };

  const validate = async (): Promise<string | null> => {
    if (!form.nickname.trim()) return '닉네임을 입력해주세요';
    if (form.nickname.length < NICKNAME_MIN || form.nickname.length > NICKNAME_MAX) {
      return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요`;
    }
    if (form.nickname.trim() !== initialNicknameRef.current) {
      const isAvailable = await checkNicknameDuplicate(form.nickname.trim());
      if (!isAvailable) return '이미 사용 중인 닉네임이에요';
    }

    if (!form.birthdate) return '생년월일을 선택해주세요';
    if (form.birthdate < MIN_BIRTHDATE || form.birthdate > MAX_BIRTHDATE) {
      return '만 18세 이상만 가입 가능해요';
    }

    if (form.gender !== 'male' && form.gender !== 'female') {
      return '성별을 선택해주세요';
    }
    if (!form.locationRegion.trim()) return '지역을 선택해주세요';
    if (districtOptions.length > 0 && !form.locationDistrict.trim()) {
      return '세부 지역을 선택해주세요';
    }
    if (!form.bio.trim() || form.bio.length < 10) {
      return '자기소개를 10자 이상 입력해주세요';
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!uid) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const validationError = await validate();
      if (validationError) {
        setError(validationError);
        setIsSubmitting(false);
        return;
      }

      const [yStr, mStr, dStr] = form.birthdate.split('-');
      const birthYear = Number(yStr);
      const birthMonth = Number(mStr);
      const birthDay = Number(dStr);

      const profilePayload = {
        nickname: form.nickname.trim(),
        birthYear,
        birthMonth,
        birthDay,
        gender: form.gender as Gender,
        location: form.locationRegion,
        locationDistrict: form.locationDistrict || undefined,
        bio: form.bio.trim(),
        mbti: form.mbti || undefined,
        university: form.university || undefined,
      };

      let pid = profileId;
      if (pid) {
        await updateProfile(pid, profilePayload);
      } else {
        pid = await createDraftProfile(uid, profilePayload);
        setProfileId(pid);
      }

      // legacy users.* 에는 birthMonth/Day나 locationDistrict가 없으니 dual-write에선
      // 기존 필드(legacy "location"은 "서울 강남구" 합성)만 보낸다.
      const displayLocation = profilePayload.locationDistrict
        ? `${profilePayload.location} ${profilePayload.locationDistrict}`
        : profilePayload.location;
      await writeProfileToLegacyUser(uid, {
        nickname: profilePayload.nickname,
        birthYear: profilePayload.birthYear,
        gender: profilePayload.gender,
        location: displayLocation,
        bio: profilePayload.bio,
        mbti: profilePayload.mbti,
        university: profilePayload.university,
      });

      await transitionOnboardingStatus(dispatch, uid, 'photo_required');
      router.replace('/onboarding/photos');
    } catch (err) {
      console.error(err);
      setError('저장 중 오류가 발생했어요.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.root}>
        <p className={styles.step}>STEP 1 / 5</p>
        <h1 className={styles.title}>기본 프로필 작성</h1>
        <p className={styles.description}>잠시만 기다려주세요...</p>
      </section>
    );
  }

  const nicknameMessage = (() => {
    switch (nicknameStatus) {
      case 'checking':
        return { text: '확인 중...', tone: 'muted' as const };
      case 'available':
        return { text: '사용 가능한 닉네임이에요', tone: 'ok' as const };
      case 'duplicate':
        return { text: '이미 사용 중인 닉네임이에요', tone: 'error' as const };
      case 'invalid':
        return {
          text: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요`,
          tone: 'error' as const,
        };
      default:
        return null;
    }
  })();

  return (
    <section className={styles.root}>
      <p className={styles.step}>STEP 1 / 5</p>
      <h1 className={styles.title}>기본 프로필 작성</h1>
      <p className={styles.description}>
        상대에게 보여질 프로필이에요. 정확하게 작성해주세요.
      </p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>닉네임</span>
          <input
            type="text"
            value={form.nickname}
            onChange={(e) => updateField('nickname', e.target.value)}
            onBlur={() => void handleNicknameBlur()}
            maxLength={NICKNAME_MAX}
            required
          />
          {nicknameMessage && (
            <span
              className={
                nicknameMessage.tone === 'error'
                  ? styles.fieldError
                  : nicknameMessage.tone === 'ok'
                    ? styles.fieldOk
                    : styles.fieldHint
              }
              role={nicknameMessage.tone === 'error' ? 'alert' : 'status'}
            >
              {nicknameMessage.text}
            </span>
          )}
        </label>

        <div className={styles.field}>
          <span className={styles.label} id="onboarding-birth-label">생년월일</span>
          <DatePicker
            value={form.birthdate}
            onChange={(next) => updateField('birthdate', next)}
            min={MIN_BIRTHDATE}
            max={MAX_BIRTHDATE}
            placeholder="생년월일 선택"
            aria-labelledby="onboarding-birth-label"
          />
        </div>

        <fieldset className={styles.field}>
          <legend className={styles.label}>성별</legend>
          <div className={styles.radioGroup}>
            <div className={styles.radioItem}>
              <CustomRadio
                name="gender"
                value="male"
                checked={form.gender === 'male'}
                onChange={() => updateField('gender', 'male')}
                label="남성"
              />
            </div>
            <div className={styles.radioItem}>
              <CustomRadio
                name="gender"
                value="female"
                checked={form.gender === 'female'}
                onChange={() => updateField('gender', 'female')}
                label="여성"
              />
            </div>
          </div>
        </fieldset>

        <div className={styles.field}>
          <span className={styles.label} id="onboarding-location-label">지역</span>
          <div className={styles.locationRow} aria-labelledby="onboarding-location-label">
            <Select
              value={form.locationRegion}
              onChange={(next) => updateField('locationRegion', next)}
              options={REGION_OPTIONS}
              placeholder="시/도"
              aria-label="시/도"
            />
            <Select
              value={form.locationDistrict}
              onChange={(next) => updateField('locationDistrict', next)}
              options={districtOptions}
              placeholder={districtOptions.length === 0 ? '해당 없음' : '시/구'}
              disabled={districtOptions.length === 0}
              aria-label="시/구"
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label} id="onboarding-mbti-label">MBTI (선택)</span>
          <Select
            value={form.mbti}
            onChange={(next) => updateField('mbti', next)}
            options={MBTI_SELECT_OPTIONS}
            placeholder="선택 안 함"
            isClearable
            aria-labelledby="onboarding-mbti-label"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label} id="onboarding-university-label">학교 (선택)</span>
          <Select
            value={form.university}
            onChange={(next) => updateField('university', next)}
            options={UNIVERSITY_OPTIONS}
            placeholder="학교 선택 또는 검색"
            searchable
            searchPlaceholder="학교 이름 검색"
            isClearable
            aria-labelledby="onboarding-university-label"
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>자기소개</span>
          <textarea
            value={form.bio}
            onChange={(e) => updateField('bio', e.target.value)}
            rows={5}
            maxLength={500}
            required
          />
        </label>

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
        </div>
      </div>
      <OnboardingFooter />
    </section>
  );
};

export default ProfileStepPage;
