import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { serializeError } from '@/shared/lib/api/serializeError';
import { getActiveMatchByUsers } from '@/shared/lib/firebase/matches';

export const matchApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    // 특정 상대와 active match 존재 여부. ProfilePage에서 채팅 이동 버튼 노출에 사용.
    getActiveMatchExists: builder.query<boolean, string>({
      async queryFn(otherUserId) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: false };
          const match = await getActiveMatchByUsers(uid, otherUserId);
          return { data: match !== null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: (_r, _e, otherUserId) => [
        { type: 'Match', id: `me_${otherUserId}` },
      ],
    }),
  }),
});

export const { useGetActiveMatchExistsQuery } = matchApi;
