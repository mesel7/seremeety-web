'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ClipboardCheck } from 'lucide-react';
import {
  useApproveProfileMutation,
  useGetReviewQueueQuery,
  useRejectProfileMutation,
  type ReviewQueueItem,
} from '@/shared/lib/api/adminApi';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import Loading from '@/shared/components/common/loading/Loading';
import sereMeetyLogo from '@/shared/assets/images/seremeety-logo.png';
import { cx } from '@/shared/lib/classNames';
import type { ProfilePhoto } from '@/shared/types/model/photo';
import styles from './AdminQueuePage.module.scss';

// 통합 검수 큐 — 사용자 단위로 프로필 + 사진을 한 카드에 같이 보여주고
// 단일 승인/반려 액션으로 처리한다. 별도 사진 검수 페이지는 nav에서 빠지고
// 본 페이지가 모든 검수 대상(프로필 pending 또는 사진 pending)을 다룬다.
const AdminProfilesPage = () => {
  const { data: queue = [], isLoading } = useGetReviewQueueQuery();
  const [approveProfile, { isLoading: isApproving }] = useApproveProfileMutation();
  const [rejectProfile, { isLoading: isRejecting }] = useRejectProfileMutation();
  const isBusy = isApproving || isRejecting;

  if (isLoading) {
    return <Loading />;
  }

  if (queue.length === 0) {
    return (
      <EmptyState icon={ClipboardCheck} message="검수 대기 중인 항목이 없어요" />
    );
  }

  return (
    <section className={styles.root} aria-labelledby="admin-queue-title">
      <h2 id="admin-queue-title" className={styles.heading}>
        검수 큐 ({queue.length})
      </h2>
      <ul className={styles.list}>
        {queue.map((item) => (
          <ReviewItem
            key={item.profile.id}
            item={item}
            disabled={isBusy}
            onApprove={() =>
              void approveProfile({
                profileId: item.profile.id,
                userId: item.profile.userId,
              })
            }
            onReject={(reason) =>
              void rejectProfile({
                profileId: item.profile.id,
                userId: item.profile.userId,
                reason,
              })
            }
          />
        ))}
      </ul>
    </section>
  );
};

interface ReviewItemProps {
  item: ReviewQueueItem;
  disabled: boolean;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

const computeAge = (year: number, month?: number, day?: number): string => {
  if (!year) return '';
  const today = new Date();
  let age = today.getFullYear() - year;
  if (month && day) {
    const beforeBirthday =
      today.getMonth() + 1 < month ||
      (today.getMonth() + 1 === month && today.getDate() < day);
    if (beforeBirthday) age -= 1;
  }
  return age > 0 ? `만 ${age}세` : '';
};

const formatBirthdate = (
  year: number,
  month?: number,
  day?: number
): string => {
  if (!year) return '';
  if (month && day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return `${year}년생`;
};

const ReviewItem = ({ item, disabled, onApprove, onReject }: ReviewItemProps) => {
  const { profile, photos, hasPendingProfile, hasPendingPhotos } = item;
  const [reason, setReason] = useState('');

  const age = computeAge(profile.birthYear, profile.birthMonth, profile.birthDay);
  const birthdate = formatBirthdate(
    profile.birthYear,
    profile.birthMonth,
    profile.birthDay
  );
  const location = profile.locationDistrict
    ? `${profile.location} ${profile.locationDistrict}`
    : profile.location;
  const genderLabel = profile.gender === 'male' ? '남성' : '여성';

  // 시각 검수에 의미 있는 사진만 노출 (deleted 제외).
  const visiblePhotos = photos.filter((p) => p.status !== 'deleted');

  const tag = (() => {
    // 프로필이 pending 이면 신규 가입 / 재제출 케이스. 사진이 이미 같이 pending 인 게 정상.
    if (hasPendingProfile) return '프로필 검수';
    // 프로필은 이미 approved 인데 사진만 pending — 가입 후 사진을 새로 올린 케이스.
    if (hasPendingPhotos) return '사진 검수';
    return '검수';
  })();

  return (
    <li className={styles.item}>
      <header className={styles.itemHeader}>
        <strong className={styles.nickname}>{profile.nickname}</strong>
        <span className={styles.tag}>{tag}</span>
        <span className={styles.meta}>
          {genderLabel} · {age || birthdate} · {location}
        </span>
      </header>

      {visiblePhotos.length > 0 && (
        <div className={styles.photoGrid}>
          {visiblePhotos.map((photo) => (
            <PhotoCell key={photo.id} photo={photo} />
          ))}
        </div>
      )}

      {profile.bio && <p className={styles.bio}>{profile.bio}</p>}

      <dl className={styles.fields}>
        {profile.mbti && (
          <>
            <dt>MBTI</dt>
            <dd>{profile.mbti}</dd>
          </>
        )}
        {profile.university && (
          <>
            <dt>학교</dt>
            <dd>{profile.university}</dd>
          </>
        )}
        {profile.jobCategory && (
          <>
            <dt>직군</dt>
            <dd>{profile.jobCategory}</dd>
          </>
        )}
        {profile.height && (
          <>
            <dt>키</dt>
            <dd>{profile.height}cm</dd>
          </>
        )}
      </dl>

      {profile.rejectionReason && profile.status === 'rejected' && (
        <p className={styles.subText}>이전 반려 사유: {profile.rejectionReason}</p>
      )}

      <div className={styles.actionsColumn}>
        <textarea
          className={styles.reasonArea}
          placeholder="반려 사유 (반려 시 필수). 사용자에게 표시됩니다."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          disabled={disabled}
        />
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.reject}
            onClick={() => onReject(reason)}
            disabled={disabled || !reason.trim()}
          >
            반려
          </button>
          <button
            type="button"
            className={styles.approve}
            onClick={onApprove}
            disabled={disabled}
          >
            승인
          </button>
        </div>
      </div>
    </li>
  );
};

const PhotoCell = ({ photo }: { photo: ProfilePhoto }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <figure className={styles.photoCell}>
      <Image
        alt={photo.isMain ? '메인 사진' : '사진'}
        src={imgError ? sereMeetyLogo.src : photo.displayUrl}
        fill
        sizes="120px"
        className={styles.photoImage}
        onError={() => setImgError(true)}
      />
      <figcaption
        className={cx(
          styles.photoBadge,
          photo.status === 'pending' && styles['photoBadge--pending'],
          photo.status === 'rejected' && styles['photoBadge--rejected'],
          photo.status === 'approved' && styles['photoBadge--approved']
        )}
      >
        {photo.isMain && <span className={styles.mainTick}>★</span>}
        {photo.status === 'pending' && '검수 대기'}
        {photo.status === 'approved' && '승인됨'}
        {photo.status === 'rejected' && '반려됨'}
      </figcaption>
    </figure>
  );
};

export default AdminProfilesPage;
