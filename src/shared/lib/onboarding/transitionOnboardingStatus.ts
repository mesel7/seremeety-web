import { entryStateApi } from '@/shared/lib/api/entryStateApi';
import { setOnboardingStatus } from '@/shared/lib/firebase/usersV2';
import type { AppDispatch } from '@/shared/lib/store/store';
import type { OnboardingStatus } from '@/shared/types/model/user';

// 온보딩 status 전이 + RTK Query 캐시 optimistic patch.
//
// invalidateTags(['EntryState']) 방식은 refetch 트리거 후 새 응답이 도착할 때까지
// 캐시는 이전 status 를 그대로 노출 → AuthenticatedRouteGate 가 stale data 로
// 잘못된 target 을 계산해 <Loading /> 으로 가려버린다. step 전환마다 깜빡임.
//
// 본 helper 는 firestore update 후 entryState 캐시의 user.onboardingStatus 만
// 즉시 patch 해서 gate 가 곧장 새 target 으로 통과시킨다. profile/preference/photo
// 같은 다른 필드는 각 페이지가 own fetch 로 다루고, resolveEntryRoute 는
// user.onboardingStatus 만 보므로 user 필드 한 줄 patch 면 충분.
export const transitionOnboardingStatus = async (
  dispatch: AppDispatch,
  uid: string,
  next: OnboardingStatus
): Promise<void> => {
  await setOnboardingStatus(uid, next);
  dispatch(
    entryStateApi.util.updateQueryData('getEntryState', undefined, (draft) => {
      if (draft.user) {
        draft.user.onboardingStatus = next;
      }
    })
  );
};
