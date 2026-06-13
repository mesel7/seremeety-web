import type { User } from '@/shared/types/model/user';
import type { Profile } from '@/shared/types/model/profile';
import type { Preference } from '@/shared/types/model/preference';

export type AppEntryRoute =
  | '/'
  | '/onboarding/bootstrap'
  | '/onboarding/profile'
  | '/onboarding/photos'
  | '/onboarding/preferences'
  | '/onboarding/consent'
  | '/onboarding/review-pending'
  | '/onboarding/rejected'
  | '/matching'
  | '/admin'
  | '/account/suspended'
  | '/account/deleted';

export interface UserEntryState {
  authenticated: boolean;
  user: User | null;
  profile: Profile | null;
  hasRequiredPhotos: boolean;
  preference: Preference | null;
  hasRequiredConsents: boolean;
}

// onboardingStatus를 primary source로 사용. profile / preference / photos / consents
// 관련 필드는 onboarding 페이지에서 prefill / cross-check 용도로 따로 읽고,
// 라우트 결정 자체는 user.onboardingStatus + user.status에만 의존한다.
// 상태 전이는 Phase 3 Functions가 enforce할 예정. Slice 2-B에서는 클라이언트가 갱신.
export function resolveEntryRoute(state: UserEntryState): AppEntryRoute {
  if (!state.authenticated) return '/';
  if (!state.user) return '/onboarding/bootstrap';
  if (state.user.status === 'suspended') return '/account/suspended';
  if (state.user.status === 'deleted') return '/account/deleted';

  switch (state.user.onboardingStatus) {
    case 'auth_only':
      return '/onboarding/bootstrap';
    case 'profile_required':
      return '/onboarding/profile';
    case 'photo_required':
      return '/onboarding/photos';
    case 'preference_required':
      return '/onboarding/preferences';
    case 'consent_required':
      return '/onboarding/consent';
    case 'review_pending':
      return '/onboarding/review-pending';
    case 'review_rejected':
      return '/onboarding/rejected';
    case 'approved':
      // admin은 운영 콘솔로 진입. 일반 유저는 추천 피드.
      return state.user.role === 'admin' ? '/admin' : '/matching';
    default:
      return '/onboarding/bootstrap';
  }
}
