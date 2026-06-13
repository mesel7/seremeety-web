'use client';

import { Heart, X } from 'lucide-react';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import Loading from '@/shared/components/common/loading/Loading';
import ProfileCardItem from '@/features/matching/components/matching/ProfileCardItem';
import { useGetMyEntitlementQuery } from '@/shared/lib/api/entitlementApi';
import {
  useGetReceivedLikeProfilesQuery,
  useReactMutation,
  type ReceivedLikeEntry,
} from '@/shared/lib/api/reactionApi';
import { cx } from '@/shared/lib/classNames';
import PremiumGate from './PremiumGate';
import styles from './ReceivedLikesContent.module.scss';

const ReceivedLikesContent = () => {
  const { data: entitlement, isLoading: isEntitlementLoading } = useGetMyEntitlementQuery();
  const isPremium = entitlement?.planId === 'premium';

  // entitlement 결정 전까지는 로딩, 결정 후 free면 PremiumGate, premium이면 받은 좋아요 query.
  if (isEntitlementLoading) {
    return <Loading className={styles.loading} />;
  }
  if (!isPremium) {
    return (
      <PremiumGate description="누가 나에게 좋아요를 보냈는지는 프리미엄에서 확인할 수 있어요." />
    );
  }
  return <ReceivedLikesList />;
};

const ReceivedLikesList = () => {
  const { data: entries = [], isLoading } = useGetReceivedLikeProfilesQuery();
  const [react, { isLoading: isReactPending }] = useReactMutation();

  if (isLoading) {
    return <Loading className={styles.loading} />;
  }

  if (entries.length === 0) {
    return (
      <div className={styles.root}>
        <EmptyState icon={Heart} message="아직 받은 좋아요가 없어요" />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <p className={styles.summary}>받은 좋아요 {entries.length}개</p>
      <ul className={styles.list}>
        {entries.map((entry) => (
          <ReceivedLikeItem
            key={entry.profile.uid}
            entry={entry}
            disabled={isReactPending}
            onLike={() => {
              if (entry.profile.uid) {
                void react({ toUserId: entry.profile.uid, type: 'like' });
              }
            }}
            onPass={() => {
              if (entry.profile.uid) {
                void react({ toUserId: entry.profile.uid, type: 'pass' });
              }
            }}
          />
        ))}
      </ul>
    </div>
  );
};

interface ReceivedLikeItemProps {
  entry: ReceivedLikeEntry;
  disabled: boolean;
  onLike: () => void;
  onPass: () => void;
}

const ReceivedLikeItem = ({
  entry,
  disabled,
  onLike,
  onPass,
}: ReceivedLikeItemProps) => {
  return (
    <li className={styles.item}>
      <div className={styles.cardWrap}>
        <ProfileCardItem
          {...entry.profile}
          profileStatus={1}
          // 프로필 카드는 클릭 시 ProfilePage로 이동.
          // 본인 reaction은 아직 없으므로 myReactionType은 전달 안 함.
        />
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={cx(styles.action, styles['action--pass'])}
          onClick={onPass}
          disabled={disabled}
          aria-label="패스"
        >
          <X aria-hidden="true" size={20} />
        </button>
        <button
          type="button"
          className={cx(styles.action, styles['action--like'])}
          onClick={onLike}
          disabled={disabled}
          aria-label="좋아요"
        >
          <Heart aria-hidden="true" size={20} />
        </button>
      </div>
    </li>
  );
};

export default ReceivedLikesContent;
