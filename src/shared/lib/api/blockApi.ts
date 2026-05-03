import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import {
  createBlock,
  getBlockedUserIds,
  isBlockedBetween,
} from '@/shared/lib/firebase/blocks';

interface BlockArgs {
  blockedUserId: string;
  reason?: string;
}

export const blockApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // 내가 차단한 사용자 uid 목록. ProfilePage 차단 상태 표시에 사용.
    getMyBlockedUserIds: builder.query<string[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: [] };
          const set = await getBlockedUserIds(uid);
          return { data: Array.from(set) };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Block'],
      // 차단 목록은 거의 변하지 않음.
      keepUnusedDataFor: 300,
    }),

    // 두 사용자 간 어느 한쪽이라도 차단했는지. ChatRoom 메시지 송신 가드에 사용.
    isChatBlocked: builder.query<boolean, string>({
      async queryFn(otherUserId) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: false };
          const blocked = await isBlockedBetween(uid, otherUserId);
          return { data: blocked };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: (_r, _e, otherUserId) => [
        'Block',
        { type: 'Block', id: `between_${otherUserId}` },
      ],
    }),

    block: builder.mutation<null, BlockArgs>({
      // Optimistic update: 차단 즉시 헤더 차단 버튼이 사라지도록 캐시에 추가.
      async onQueryStarted({ blockedUserId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          blockApi.util.updateQueryData('getMyBlockedUserIds', undefined, (draft) => {
            if (!draft.includes(blockedUserId)) {
              draft.push(blockedUserId);
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      async queryFn({ blockedUserId, reason }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await createBlock(uid, blockedUserId, reason);
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 차단 시 추천도 다시 페치되도록 Recommendation도 무효화.
      invalidatesTags: ['Block', 'Recommendation'],
    }),
  }),
});

export const {
  useGetMyBlockedUserIdsQuery,
  useBlockMutation,
  useIsChatBlockedQuery,
} = blockApi;
