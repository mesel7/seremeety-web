import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import { getBlockedUserIds } from '@/shared/lib/firebase/blocks';
import {
  getReaction,
  getReactionsFromUser,
  getReactionsToUser,
} from '@/shared/lib/firebase/reactions';
import { getUserDataByUid } from '@/shared/lib/firebase/users';
import type { Reaction, ReactionType } from '@/shared/types/model/reaction';
import type { UserProfile } from '@/shared/types/domain';

export type ReactionResult =
  | { ok: true; matched: boolean }
  | { ok: false; reason: 'daily_limit' | 'blocked' };

interface ReactArgs {
  toUserId: string;
  type: ReactionType;
}

export interface SentLikeEntry {
  profile: UserProfile;
  type: 'like' | 'superLike';
  // createdAt은 raw Reaction에서 client filter/정렬 후 결과에는 포함하지 않는다.
}

export interface ReceivedLikeEntry {
  profile: UserProfile;
  type: 'like' | 'superLike';
}

// Phase 3-A: react 흐름은 Functions onCall(react)로 이전되었다.
// - 한도 검증 (dailyLikeLimit / dailySuperLikeLimit)
// - 양방향 차단 검증
// - reaction 작성 (deterministic ID)
// - mutual like 시 match + legacy chatRoom batch 작성
// 모두 server-side에서 일관 처리. client는 callable만 호출하고, firestore.rules가
// reactions/matches collection의 client write를 차단한다.
const reactCallable = httpsCallable<ReactArgs, ReactionResult>(functions, 'react');

const toMillis = (value: Reaction['createdAt']): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'seconds' in value) {
    return value.seconds * 1000;
  }
  return 0;
};

export const reactionApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    // 본인이 보낸 reaction 조회는 client read 권한이 그대로 (rules가 fromUserId
    // == auth.uid 조건으로 read만 허용).
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

    // 본인이 보낸 모든 reaction을 한 번에 가져와서 매칭 페이지 카드의 reaction
    // 상태 lookup에 사용. Map<toUserId, type> 형태로 변환은 호출 측에서.
    getAllMyReactions: builder.query<Reaction[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: [] };
          const reactions = await getReactionsFromUser(uid);
          return { data: reactions };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['SentLikes', 'Reaction'],
    }),

    // 보낸 좋아요 페이지 — 본인이 like/superLike 한 사람들의 profile + type.
    // 최신순 정렬, 차단된 페어는 제외, 매칭 페어는 그대로 노출 (MVP).
    getSentLikeProfiles: builder.query<SentLikeEntry[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: [] };
          const [reactions, blockedSet] = await Promise.all([
            getReactionsFromUser(uid),
            getBlockedUserIds(uid),
          ]);
          const liked = reactions
            .filter((r) => r.type === 'like' || r.type === 'superLike')
            .filter((r) => !blockedSet.has(r.toUserId))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          const profiles = await Promise.all(
            liked.map(async (r) => {
              const profile = await getUserDataByUid(r.toUserId);
              if (!profile) return null;
              return { profile, type: r.type as 'like' | 'superLike' };
            })
          );
          return { data: profiles.filter((p): p is SentLikeEntry => p !== null) };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['SentLikes'],
    }),

    // 받은 좋아요 페이지 (프리미엄 UI 가드) — 본인을 toUserId로 한 like/superLike
    // 중 본인이 그 사람한테 reaction 안 한 페어만. 본인이 차단한 사람은 제외.
    // firestore.rules에 toUserId == auth.uid read 권한이 부여되어야 동작.
    getReceivedLikeProfiles: builder.query<ReceivedLikeEntry[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: [] };
          const [received, sent, blockedSet] = await Promise.all([
            getReactionsToUser(uid),
            getReactionsFromUser(uid),
            getBlockedUserIds(uid),
          ]);
          const sentSet = new Set(sent.map((r) => r.toUserId));
          const liked = received
            .filter((r) => r.type === 'like' || r.type === 'superLike')
            // 본인이 그 사람한테 reaction 안 한 경우만 (매칭/패스된 페어 제외)
            .filter((r) => !sentSet.has(r.fromUserId))
            // 본인이 차단한 사람의 좋아요는 안 보여줌
            .filter((r) => !blockedSet.has(r.fromUserId))
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          const profiles = await Promise.all(
            liked.map(async (r) => {
              const profile = await getUserDataByUid(r.fromUserId);
              if (!profile) return null;
              return { profile, type: r.type as 'like' | 'superLike' };
            })
          );
          return { data: profiles.filter((p): p is ReceivedLikeEntry => p !== null) };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['ReceivedLikes'],
    }),

    react: builder.mutation<ReactionResult, ReactArgs>({
      // Optimistic update: 버튼 클릭 즉시 캐시에 반응을 반영해
      // ProfilePage가 곧장 disabled 상태로 전환되도록 한다. mutation이
      // 실패하거나 daily_limit/blocked 응답을 받으면 patch.undo()로 되돌린다.
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
          const result = await reactCallable({ toUserId, type });
          return { data: result.data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // SentLikes/ReceivedLikes/Recommendation 모두 갱신해 본인 내역과 매칭
      // 페이지 시각 표시가 즉시 반영되도록 한다.
      invalidatesTags: (_result, _error, { toUserId }) => [
        { type: 'Reaction', id: `me_${toUserId}` },
        { type: 'Match', id: `me_${toUserId}` },
        'Recommendation',
        'SentLikes',
        'ReceivedLikes',
      ],
    }),
  }),
});

export const {
  useGetMyReactionQuery,
  useGetAllMyReactionsQuery,
  useGetSentLikeProfilesQuery,
  useGetReceivedLikeProfilesQuery,
  useReactMutation,
} = reactionApi;
