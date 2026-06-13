'use client';

import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import Loading from '@/shared/components/common/loading/Loading';
import ProfileCardItem from '@/features/matching/components/matching/ProfileCardItem';
import { useGetSentLikeProfilesQuery } from '@/shared/lib/api/reactionApi';
import styles from './SentLikesContent.module.scss';

const SentLikesContent = () => {
  const { data: entries = [], isLoading } = useGetSentLikeProfilesQuery();

  const { likes, superLikes } = useMemo(() => {
    return {
      likes: entries.filter((e) => e.type === 'like'),
      superLikes: entries.filter((e) => e.type === 'superLike'),
    };
  }, [entries]);

  if (isLoading) {
    return <Loading className={styles.loading} />;
  }

  if (entries.length === 0) {
    return (
      <div className={styles.root}>
        <EmptyState icon={Heart} message="아직 보낸 좋아요가 없어요" />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {superLikes.length > 0 && (
        <section className={styles.section} aria-labelledby="super-likes-heading">
          <h3 id="super-likes-heading" className={styles.heading}>
            슈퍼 좋아요 ({superLikes.length})
          </h3>
          <ul className={styles.grid}>
            {superLikes.map((entry) => (
              <li key={entry.profile.uid} className={styles.card}>
                <ProfileCardItem
                  {...entry.profile}
                  profileStatus={1}
                  myReactionType={entry.type}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {likes.length > 0 && (
        <section className={styles.section} aria-labelledby="likes-heading">
          <h3 id="likes-heading" className={styles.heading}>
            좋아요 ({likes.length})
          </h3>
          <ul className={styles.grid}>
            {likes.map((entry) => (
              <li key={entry.profile.uid} className={styles.card}>
                <ProfileCardItem
                  {...entry.profile}
                  profileStatus={1}
                  myReactionType={entry.type}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default SentLikesContent;
