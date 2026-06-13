'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { useAppDispatch, useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid, setAuthRole } from '@/shared/lib/store/authSlice';
import Loading from '@/shared/components/common/loading/Loading';
import {
  createDefaultEntitlement,
  getEntitlementByUserId,
} from '@/shared/lib/firebase/entitlements';
import {
  createDefaultIdentityVerification,
  getIdentityVerificationByUserId,
} from '@/shared/lib/firebase/identityVerifications';
import {
  createNewUserV2,
  getUserV2ByUid,
  setOnboardingStatus,
} from '@/shared/lib/firebase/usersV2';
import { transitionOnboardingStatus } from '@/shared/lib/onboarding/transitionOnboardingStatus';
import OnboardingStubLayout from './OnboardingStubLayout';

// /onboarding/bootstrap
// Phone Auth 직후 진입 지점. User v2 / Entitlement / IdentityVerification
// 기본 문서를 보장한다.
//
// 분기:
//  - role === 'admin' → onboardingStatus='approved' 로 즉시 전이, /admin 으로 진입.
//    어드민은 데이팅 프로필이 필요 없는 운영자 계정이라 onboarding flow 자체를 건너뜀.
//    최초 admin 은 functions/scripts/grant-admin.mjs CLI 또는 Firebase Console 로 seed,
//    이후 admin 추가는 /admin/users 콘솔에서 권한 부여.
//  - 그 외 → onboardingStatus='profile_required' 로 전이, /onboarding/profile 진입.
//
// 본 페이지는 setup 작업 동안만 잠깐 머무는 transient 페이지라 환영 메시지 같은
// 노이즈를 보이지 않고 깔끔한 page-level loader 만 노출한다.
const BootstrapPage = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const uid = useAppSelector(selectAuthUid);
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!uid || ranRef.current) {
      return;
    }
    ranRef.current = true;

    const bootstrap = async () => {
      try {
        const phone = auth.currentUser?.phoneNumber ?? '';
        let user = await getUserV2ByUid(uid);
        let userJustCreated = false;
        if (!user) {
          await createNewUserV2(uid, phone);
          user = await getUserV2ByUid(uid);
          userJustCreated = true;
        }

        const [ent, ident] = await Promise.all([
          getEntitlementByUserId(uid),
          getIdentityVerificationByUserId(uid),
        ]);
        if (!ent) await createDefaultEntitlement(uid);
        if (!ident) await createDefaultIdentityVerification(uid);

        if (user) {
          dispatch(setAuthRole(user.role));
          if (user.role === 'admin') {
            if (user.onboardingStatus !== 'approved') {
              // 캐시에 user 가 채워져 있으면 optimistic patch, 아니면 invalidate 로 refetch.
              if (userJustCreated) {
                await setOnboardingStatus(uid, 'approved');
                dispatch(baseApi.util.invalidateTags(['EntryState']));
              } else {
                await transitionOnboardingStatus(dispatch, uid, 'approved');
              }
            }
            router.replace('/admin');
            return;
          }

          if (user.onboardingStatus === 'auth_only') {
            if (userJustCreated) {
              await setOnboardingStatus(uid, 'profile_required');
              dispatch(baseApi.util.invalidateTags(['EntryState']));
            } else {
              await transitionOnboardingStatus(dispatch, uid, 'profile_required');
            }
          }
        }

        router.replace('/onboarding/profile');
      } catch (err) {
        console.error(err);
        setError('초기 설정 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
        ranRef.current = false;
      }
    };

    void bootstrap();
  }, [uid, router, dispatch]);

  if (error) {
    return (
      <OnboardingStubLayout
        title="오류"
        description={error}
        primaryAction={{ label: '다시 시도', onClick: () => router.refresh() }}
      />
    );
  }

  return <Loading variant="page" />;
};

export default BootstrapPage;
