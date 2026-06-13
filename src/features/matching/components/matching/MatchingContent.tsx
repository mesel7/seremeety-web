'use client';

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import ProfileCardItem from './ProfileCardItem';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import { useGetAllMyReactionsQuery } from '@/shared/lib/api/reactionApi';
import type { ReactionType } from '@/shared/types/model/reaction';
import type { UserProfile } from '@/shared/types/domain';
import styles from './MatchingContent.module.scss';

interface MatchingContentProps {
  profileCards: UserProfile[];
}

const MatchingContent = ({ profileCards }: MatchingContentProps) => {
  // 카드별 본인 reaction 상태를 한 번에 받아 Map으로 lookup.
  // react mutation 후 'SentLikes'/'Reaction' 태그 invalidate로 자동 refetch.
  const { data: myReactions = [] } = useGetAllMyReactionsQuery();
  const reactionMap = useMemo(() => {
    const map = new Map<string, ReactionType>();
    for (const reaction of myReactions) {
      map.set(reaction.toUserId, reaction.type);
    }
    return map;
  }, [myReactions]);

  if (profileCards.length === 0) {
    return (
      <div className={styles.root}>
        <EmptyState
          icon={Sparkles}
          message="오늘의 추천을 모두 확인했어요. 내일 다시 와주세요"
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <p className={styles.summary}>오늘의 추천 {profileCards.length}장</p>
      <ul className={styles.grid}>
        {profileCards.map((it) => (
          <li className={styles.card} key={it.uid ?? `${it.nickname}-${it.age}`}>
            <ProfileCardItem
              {...it}
              profileStatus={1}
              myReactionType={it.uid ? reactionMap.get(it.uid) ?? null : null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MatchingContent;
