import { Timestamp } from 'firebase/firestore';
import {
  getBlockedUserIds,
  getBlockerUserIds,
} from '@/shared/lib/firebase/blocks';
import { getEntitlementByUserId } from '@/shared/lib/firebase/entitlements';
import {
  createRecommendationLog,
  getRecommendationLogsByUser,
} from '@/shared/lib/firebase/recommendationLogs';
import { getReactionsFromUser } from '@/shared/lib/firebase/reactions';
import { getKstTodayStartMs } from '@/shared/lib/firebase/dailyLimits';
import { getUserDataByUid, getUserProfiles } from '@/shared/lib/firebase/users';
import type { RecommendationLog } from '@/shared/types/model/recommendation';
import type { TimestampLike, UserProfile } from '@/shared/types/domain';

const FREE_RECOMMENDATION_LIMIT = 5;

const toMillis = (value: TimestampLike): number => {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'seconds' in value) {
    return value.seconds * 1000;
  }
  return 0;
};

const shuffle = <T>(items: T[]): T[] => {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// TODO(Phase 3): Functions로 이동. 현재는 클라이언트가 후보 쿼리/필터/로그 작성을 직접 수행.
// 점수 계산(score)은 0으로 두고 reasonCodes는 빈 배열. 본격 점수화는 후속 슬라이스.
export const getTodayRecommendations = async (
  currentUser: UserProfile
): Promise<UserProfile[]> => {
  const currentUid = currentUser.uid;
  if (!currentUid) {
    return [];
  }

  const [
    entitlement,
    allLogs,
    myReactions,
    candidates,
    blockedByMe,
    blockersOfMe,
  ] = await Promise.all([
    getEntitlementByUserId(currentUid),
    getRecommendationLogsByUser(currentUid),
    getReactionsFromUser(currentUid),
    getUserProfiles(currentUser),
    getBlockedUserIds(currentUid),
    getBlockerUserIds(currentUid),
  ]);

  const limit = entitlement?.dailyRecommendationLimit ?? FREE_RECOMMENDATION_LIMIT;
  const todayStartMs = getKstTodayStartMs();

  const allShownIds = new Set(allLogs.map((log) => log.recommendedUserId));
  const todayShownIds = new Set(
    allLogs
      .filter((log: RecommendationLog) => toMillis(log.shownAt) >= todayStartMs)
      .map((log) => log.recommendedUserId)
  );
  const reactedIds = new Set(myReactions.map((r) => r.toUserId));

  // 1) 오늘 이미 노출된 카드는 동일하게 다시 보여준다(이탈/재진입 안정성).
  //    react 한 카드도 포함시켜 화면에서 disabled 상태로 표시되도록 한다.
  const todayShownProfiles = (
    await Promise.all(
      Array.from(todayShownIds).map((uid) => getUserDataByUid(uid))
    )
  ).filter((p): p is UserProfile => p !== null);

  // 2) 잔여 슬롯 = limit - 오늘 노출 수. 신규 추천을 더 받아올 여력.
  const remaining = Math.max(0, limit - todayShownProfiles.length);

  // 3) 신규 후보: 자기 자신 / 모든 노출 이력 / react한 유저 / 양방향 차단 제외.
  const fresh =
    remaining === 0
      ? []
      : candidates.filter((profile) => {
          if (!profile.uid || profile.uid === currentUid) return false;
          if (allShownIds.has(profile.uid)) return false;
          if (reactedIds.has(profile.uid)) return false;
          if (blockedByMe.has(profile.uid)) return false;
          if (blockersOfMe.has(profile.uid)) return false;
          return true;
        });

  // 4) 단순 셔플 후 잔여 슬롯만큼 선별. score/reasonCodes는 후속 작업.
  const picked = shuffle(fresh).slice(0, remaining);

  // 5) 선택된 카드에 대해 recommendationLogs 작성.
  await Promise.all(
    picked.map((profile) =>
      profile.uid
        ? createRecommendationLog(currentUid, profile.uid, 0, [])
        : Promise.resolve('')
    )
  );

  const combined = [...todayShownProfiles, ...picked];

  // 6) Fallback — 오늘 노출 0개 + 신규 후보도 0개인 경우(예: KST 자정 직후
  //    재진입 + 후보 풀이 작아 어제 다 본 상태). 한 번이라도 추천받았던 카드는
  //    화면에서 사라지지 않도록 가장 최근 logs 기준 limit개를 표시한다.
  //    react 한 카드는 화면에서 disabled 상태로 자연스레 노출된다.
  if (combined.length === 0 && allLogs.length > 0) {
    const recentLogIds = allLogs
      .slice()
      .sort((a, b) => toMillis(b.shownAt) - toMillis(a.shownAt))
      .slice(0, limit)
      .map((log) => log.recommendedUserId);
    const recentProfiles = (
      await Promise.all(recentLogIds.map((uid) => getUserDataByUid(uid)))
    ).filter((p): p is UserProfile => p !== null);
    return recentProfiles;
  }

  return combined;
};
