import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/admin';
import { requireAuthedUser } from '../lib/auth';

export type ReactionType = 'like' | 'pass' | 'superLike';

export interface ReactInput {
  toUserId: string;
  type: ReactionType;
}

export type ReactOutput =
  | { ok: true; matched: boolean }
  | { ok: false; reason: 'daily_limit' | 'blocked' };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Phase 5/6과 동일한 KST 자정 기준으로 reactions count.
const getKstTodayStartTimestamp = (): Timestamp => {
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const todayKstMidnightMs = Math.floor(nowKstMs / DAY_MS) * DAY_MS;
  return Timestamp.fromMillis(todayKstMidnightMs - KST_OFFSET_MS);
};

const reactionId = (fromUid: string, toUid: string) => `${fromUid}_${toUid}`;
const sortedPairId = (a: string, b: string) =>
  a < b ? `${a}_${b}` : `${b}_${a}`;

const FREE_LIKE_LIMIT = 3;
const FREE_SUPER_LIKE_LIMIT = 0;

// reactions.react onCall — 한도 검증 + reaction 작성 + mutual like 시 match 생성을
// server-side에서 일관 처리한다. 기존 client reactionApi.react가 호출했던
// firebase 헬퍼(createReaction, getReaction, createMatch, writeMatchToLegacyChatRoom,
// markRecommendationReacted)의 책임이 본 함수로 이전된다.
export const react = onCall<ReactInput, Promise<ReactOutput>>(
  // setGlobalOptions의 default를 받지만, 보험으로 함수 수준에서도 maxInstances 명시.
  { maxInstances: 5 },
  async (request) => {
    const me = await requireAuthedUser(request);
    const uid = me.uid;
    const { toUserId, type } = request.data ?? ({} as ReactInput);

    if (!toUserId || typeof toUserId !== 'string') {
      throw new HttpsError('invalid-argument', 'invalid_to_user');
    }
    if (uid === toUserId) {
      throw new HttpsError('invalid-argument', 'self_reaction');
    }
    if (type !== 'like' && type !== 'pass' && type !== 'superLike') {
      throw new HttpsError('invalid-argument', 'invalid_type');
    }

    // 양방향 차단 검증. 어느 한쪽이라도 차단했으면 reaction 생성 거부.
    const [aBlocksB, bBlocksA] = await Promise.all([
      db.doc(`blocks/${uid}_${toUserId}`).get(),
      db.doc(`blocks/${toUserId}_${uid}`).get(),
    ]);
    if (aBlocksB.exists || bBlocksA.exists) {
      return { ok: false, reason: 'blocked' };
    }

    // 한도 검증 (like, superLike만). pass는 무제한.
    if (type === 'like' || type === 'superLike') {
      const entSnap = await db.doc(`entitlements/${uid}`).get();
      const ent = entSnap.exists ? entSnap.data() : null;
      const limit =
        type === 'like'
          ? typeof ent?.dailyLikeLimit === 'number'
            ? ent.dailyLikeLimit
            : FREE_LIKE_LIMIT
          : typeof ent?.dailySuperLikeLimit === 'number'
            ? ent.dailySuperLikeLimit
            : FREE_SUPER_LIKE_LIMIT;

      const todayStart = getKstTodayStartTimestamp();
      const usedSnap = await db
        .collection('reactions')
        .where('fromUserId', '==', uid)
        .where('type', '==', type)
        .where('createdAt', '>=', todayStart)
        .count()
        .get();
      const used = usedSnap.data().count;
      if (used >= limit) {
        return { ok: false, reason: 'daily_limit' };
      }
    }

    // reaction 작성 (deterministic ID라 idempotent. 같은 페어 재호출 시 덮어씀).
    const myReactionRef = db.doc(`reactions/${reactionId(uid, toUserId)}`);
    await myReactionRef.set({
      id: reactionId(uid, toUserId),
      fromUserId: uid,
      toUserId,
      type,
      createdAt: FieldValue.serverTimestamp(),
    });

    // recommendation log 갱신은 best effort (로그 부재 시 무시).
    db.doc(`recommendationLogs/${uid}_${toUserId}`)
      .update({
        reactedAt: FieldValue.serverTimestamp(),
        reactionType: type,
      })
      .catch((error) => {
        logger.debug('recommendationLog update skipped', { uid, toUserId, error });
      });

    if (type === 'pass') {
      return { ok: true, matched: false };
    }

    // 상대 반응 검증. 둘 다 like/superLike여야 매칭 성립.
    const theirSnap = await db.doc(`reactions/${reactionId(toUserId, uid)}`).get();
    if (!theirSnap.exists) {
      return { ok: true, matched: false };
    }
    const theirType = theirSnap.data()?.type;
    if (theirType !== 'like' && theirType !== 'superLike') {
      return { ok: true, matched: false };
    }

    // match + legacy chatRoom dual-write를 batch로 atomic 처리.
    const sortedUids = uid < toUserId ? [uid, toUserId] : [toUserId, uid];
    const matchDocId = sortedPairId(uid, toUserId);

    const batch = db.batch();
    batch.set(
      db.doc(`matches/${matchDocId}`),
      {
        id: matchDocId,
        users: sortedUids,
        reactions: [reactionId(uid, toUserId), reactionId(toUserId, uid)],
        active: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    // legacy chatRooms (Phase 1 호환). users 배열 + createdAt + lastMessage 까지 set.
    // lastMessage.sentAt 는 client subscribeToChatRooms 가 orderBy 하는 필드라
    // 누락되면 채팅방 목록에서 제외됨 (Firestore orderBy 는 missing field 도큐먼트
    // 를 결과에서 빼버린다). 빈 텍스트 + 생성 시점 timestamp 로 초기화.
    batch.set(
      db.doc(`chatRooms/${matchDocId}`),
      {
        users: sortedUids,
        createdAt: FieldValue.serverTimestamp(),
        lastMessage: {
          text: '',
          sentAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
    await batch.commit();

    return { ok: true, matched: true };
  }
);
