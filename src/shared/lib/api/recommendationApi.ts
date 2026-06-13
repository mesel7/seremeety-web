import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { serializeError } from '@/shared/lib/api/serializeError';
import { getUserDataByUid } from '@/shared/lib/firebase/users';
import { getTodayRecommendations } from '@/shared/lib/firebase/recommendations';
import type { UserProfile } from '@/shared/types/domain';

export const recommendationApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getTodayRecommendations: builder.query<UserProfile[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { data: [] };
          }
          const me = await getUserDataByUid(uid);
          if (!me || me.profileStatus !== 1) {
            // 프로필 미완성 사용자는 추천을 받지 않는다 — MatchingPage 가드와 일치.
            return { data: [] };
          }
          const data = await getTodayRecommendations(me);
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Recommendation'],
    }),
  }),
});

export const { useGetTodayRecommendationsQuery } = recommendationApi;
