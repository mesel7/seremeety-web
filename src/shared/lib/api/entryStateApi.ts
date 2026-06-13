import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { serializeError } from '@/shared/lib/api/serializeError';
import { getLatestConsentByUserId } from '@/shared/lib/firebase/consents';
import { getPreferenceByUserId } from '@/shared/lib/firebase/preferences';
import { getProfileByUserId } from '@/shared/lib/firebase/profiles';
import { getProfilePhotosByUserId } from '@/shared/lib/firebase/profilePhotos';
import { getUserV2ByUid } from '@/shared/lib/firebase/usersV2';
import type { UserEntryState } from '@/shared/lib/onboarding/resolveEntryRoute';

const REQUIRED_TERMS_VERSION = '1.0';
const REQUIRED_PRIVACY_VERSION = '1.0';

// Phase 3-A 후속: useEntryState를 RTK Query 캐시로 통합.
// onboarding step transition 시 setOnboardingStatus 호출 후 'EntryState' 태그를
// invalidate하면 모든 라우트 게이트(AuthEntryPage, AuthenticatedRouteGate)가
// 일관된 fresh entryState를 받는다. 이전 useEffect 기반 fetch는 SPA stay 중
// stale 캐시를 유지해 stale → /onboarding/bootstrap 무한 redirect 버그 발생.
export const entryStateApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getEntryState: builder.query<UserEntryState, void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return {
              data: {
                authenticated: false,
                user: null,
                profile: null,
                hasRequiredPhotos: false,
                preference: null,
                hasRequiredConsents: false,
              },
            };
          }
          const [user, profile, preference, photos, consent] = await Promise.all([
            getUserV2ByUid(uid),
            getProfileByUserId(uid),
            getPreferenceByUserId(uid),
            getProfilePhotosByUserId(uid),
            getLatestConsentByUserId(uid),
          ]);
          const hasRequiredPhotos = photos.some(
            (p) => p.isMain && (p.status === 'approved' || p.status === 'pending')
          );
          const hasRequiredConsents = Boolean(
            consent &&
              consent.termsVersion === REQUIRED_TERMS_VERSION &&
              consent.privacyVersion === REQUIRED_PRIVACY_VERSION
          );
          return {
            data: {
              authenticated: true,
              user,
              profile,
              hasRequiredPhotos,
              preference,
              hasRequiredConsents,
            },
          };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['EntryState'],
    }),
  }),
});

export const { useGetEntryStateQuery } = entryStateApi;
