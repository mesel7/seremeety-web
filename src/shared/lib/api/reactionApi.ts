import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import {
  countLikesToday,
  countSuperLikesToday,
} from '@/shared/lib/firebase/dailyLimits';
import { getEntitlementByUserId } from '@/shared/lib/firebase/entitlements';
import { writeMatchToLegacyChatRoom } from '@/shared/lib/firebase/legacyBridge';
import { createMatch } from '@/shared/lib/firebase/matches';
import {
  createReaction,
  getReaction,
} from '@/shared/lib/firebase/reactions';
import { markRecommendationReacted } from '@/shared/lib/firebase/recommendationLogs';
import type { ReactionType } from '@/shared/types/model/reaction';

export type ReactionResult =
  | { ok: true; matched: boolean }
  | { ok: false; reason: 'daily_limit' };

interface ReactArgs {
  toUserId: string;
  type: ReactionType;
}

// TODO(Phase 3): Functions로 이동. mutual like 검증, daily limit, match 생성을 서버에서.
export const reactionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyReaction: builder.query<ReactionType | null, string>({
      async queryFn(toUserId) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: null };
          const reaction = await getReaction(uid, toUserId);
          return { data: reaction?.type ?? null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: (_r, _e, toUserId) => [
        { type: 'Reaction', id: `me_${toUserId}` },
      ],
    }),

    react: builder.mutation<ReactionResult, ReactArgs>({
      // Optimistic update: 버튼 클릭 즉시 캐시에 반응을 반영해
      // ProfilePage가 곧장 disabled 상태로 전환되도록 한다. mutation이
      // 실패하거나 daily limit으로 ok=false가 오면 patch.undo()로 되돌린다.
      async onQueryStarted({ toUserId, type }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          reactionApi.util.updateQueryData('getMyReaction', toUserId, () => type)
        );
        try {
          const { data } = await queryFulfilled;
          if (!data.ok) {
            patch.undo();
          }
        } catch {
          patch.undo();
        }
      },
      async queryFn({ toUserId, type }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { error: errorWithCode('not_authenticated') };
          }

          if (type === 'like' || type === 'superLike') {
            const entitlement = await getEntitlementByUserId(uid);
            const limit =
              type === 'like'
                ? entitlement?.dailyLikeLimit ?? 3
                : entitlement?.dailySuperLikeLimit ?? 0;
            const used =
              type === 'like'
                ? await countLikesToday(uid)
                : await countSuperLikesToday(uid);
            if (used >= limit) {
              return { data: { ok: false, reason: 'daily_limit' } };
            }
          }

          const myReactionId = await createReaction(uid, toUserId, type);
          void markRecommendationReacted(uid, toUserId, type);

          if (type === 'like' || type === 'superLike') {
            const theirs = await getReaction(toUserId, uid);
            if (theirs?.type === 'like' || theirs?.type === 'superLike') {
              await createMatch(uid, toUserId, [myReactionId, theirs.id]);
              await writeMatchToLegacyChatRoom(uid, toUserId);
              return { data: { ok: true, matched: true } };
            }
          }

          return { data: { ok: true, matched: false } };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: (_result, _error, { toUserId }) => [
        { type: 'Reaction', id: `me_${toUserId}` },
        { type: 'Match', id: `me_${toUserId}` },
        'Recommendation',
      ],
    }),
  }),
});

export const { useGetMyReactionQuery, useReactMutation } = reactionApi;
