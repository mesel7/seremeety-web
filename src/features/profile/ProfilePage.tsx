'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Flag,
  GraduationCap,
  Heart,
  Mars,
  Navigation,
  UserRound,
  UserX,
  Venus,
} from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import sereMeetyLogo from '@/shared/assets/images/seremeety-logo.png';
import PageTransition from '@/shared/components/common/PageTransition';
import Loading from '@/shared/components/common/loading/Loading';
import Header from '@/shared/components/common/Header';
import {
  useGetMeQuery,
  useGetPublicProfileQuery,
} from '@/shared/lib/api/profileApi';
import { useGetMyBlockedUserIdsQuery, useBlockMutation } from '@/shared/lib/api/blockApi';
import { useGetMyReactionQuery, useReactMutation } from '@/shared/lib/api/reactionApi';
import { useGetActiveMatchExistsQuery } from '@/shared/lib/api/matchApi';
import { useGetProfilePhotosQuery } from '@/shared/lib/api/photoApi';
import { useCreateReportMutation } from '@/shared/lib/api/reportApi';
import Button from '@/shared/components/common/button/Button';
import Modal, { type ModalConfig } from '@/shared/components/common/modal/Modal';
import ReportModal from '@/shared/components/common/report-modal/ReportModal';
import { cx } from '@/shared/lib/classNames';
import type { ProfilePhoto } from '@/shared/types/model/photo';
import type { ReactionType } from '@/shared/types/model/reaction';
import styles from './ProfilePage.module.scss';

const ProfilePage = () => {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const { uid } = useParams<{ uid: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isViewOnly = searchParams.get('viewOnly') === '1';
  const isUidValid = Boolean(uid) && !Array.isArray(uid);
  const targetUid = isUidValid ? (uid as string) : '';

  const { data: state, isLoading: isMypageFetching } = useGetMeQuery();
  const canView = state?.profileStatus === 1;
  const {
    data: userProfile,
    isLoading: isProfileLoading,
  } = useGetPublicProfileQuery(targetUid, {
    skip: !isUidValid || !canView,
  });

  const skipReactionState = !isUidValid || isViewOnly;
  const { data: myReactionType = null } = useGetMyReactionQuery(targetUid, {
    skip: skipReactionState,
  });
  const { data: isAlreadyMatched = false } = useGetActiveMatchExistsQuery(
    targetUid,
    { skip: skipReactionState }
  );
  const { data: blockedIds = [] } = useGetMyBlockedUserIdsQuery(undefined, {
    skip: skipReactionState,
  });
  const isBlocked = isUidValid && blockedIds.includes(targetUid);

  const [react, { isLoading: isReactPending }] = useReactMutation();
  const [block] = useBlockMutation();
  const [createReport, { isLoading: isReporting }] = useCreateReportMutation();
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [imgError, setImgError] = useState(false);
  // selectFromResult로 메모이즈된 파생 셀렉터를 사용해 다른 사진 필드 변화 시
  // 불필요한 리렌더를 막는다.
  const { extraPhotos } = useGetProfilePhotosQuery(targetUid, {
    skip: !isUidValid || !canView,
    selectFromResult: ({ data }) => ({
      extraPhotos: (data ?? []).filter(
        (p) => !p.isMain && p.status === 'approved'
      ),
    }),
  });

  const openAlert = useCallback(
    (title: string, description: string, onConfirm?: () => void) => {
      setModal({
        actions: [{ label: '확인', onClick: onConfirm }],
        closeOnBackdrop: false,
        description,
        showCloseButton: false,
        title,
      });
    },
    []
  );

  // 프로필 미완성 사용자가 다른 프로필을 열람하려 하면 안내 후 마이페이지로.
  useEffect(() => {
    if (isMypageFetching || !state || !isUidValid) {
      return;
    }
    if (state.profileStatus !== 1) {
      openAlert('프로필 열람', '먼저 프로필을 완성해주세요', () =>
        router.replace('/my-profile')
      );
    }
  }, [isMypageFetching, state, isUidValid, openAlert, router]);

  // RTK Query가 null을 반환하면 존재하지 않는 프로필.
  useEffect(() => {
    if (!canView || isProfileLoading) return;
    if (userProfile === null) {
      openAlert('오류', '존재하지 않는 프로필입니다', () => router.back());
    }
  }, [canView, isProfileLoading, userProfile, openAlert, router]);

  useEffect(() => {
    setImgError(false);
  }, [userProfile?.profilePictureUrl]);

  const handleReact = async (type: ReactionType) => {
    if (!isUidValid || isReactPending) return;
    try {
      const result = await react({ toUserId: targetUid, type }).unwrap();
      if (!result.ok) {
        if (result.reason === 'daily_limit') {
          openAlert(
            type === 'like' ? '좋아요 한도' : '슈퍼좋아요 한도',
            '오늘의 한도를 모두 사용했어요. 내일 다시 시도해주세요'
          );
        } else if (result.reason === 'blocked') {
          openAlert(
            '전송 불가',
            '차단된 사용자에게는 반응을 보낼 수 없어요'
          );
        }
        return;
      }
      if (result.matched) {
        setModal({
          actions: [
            { label: '계속 둘러보기', tone: 'secondary' },
            { label: '채팅으로', onClick: () => router.push('/chat-list') },
          ],
          closeOnBackdrop: true,
          showCloseButton: true,
          title: '매칭 성공',
          description: '서로 좋아요를 보내 매칭되었어요!',
        });
        return;
      }
      if (type === 'like' || type === 'superLike') {
        openAlert('좋아요 전송', '상대방도 좋아요를 보내면 매칭이 돼요');
        return;
      }
      // pass: 별도 모달 없이 뒤로 이동.
      router.back();
    } catch {
      openAlert('오류', '처리 중 오류가 발생했어요');
    }
  };

  const handleReportSubmit = async (reason: string, description: string) => {
    if (!isUidValid) return;
    try {
      await createReport({
        targetType: 'profile',
        targetId: targetUid,
        targetUserId: targetUid,
        reason,
        description: description || undefined,
      }).unwrap();
      setIsReportOpen(false);
      openAlert(
        '신고 접수',
        '신고가 접수되었어요. 관리자가 검토할게요'
      );
    } catch {
      openAlert('오류', '신고 처리 중 오류가 발생했어요');
    }
  };

  const handleBlockClick = () => {
    setModal({
      actions: [
        { label: '취소', tone: 'secondary' },
        {
          label: '차단',
          onClick: async () => {
            if (!isUidValid) return;
            try {
              await block({ blockedUserId: targetUid }).unwrap();
              openAlert('차단 완료', '해당 사용자가 추천에서 제외됩니다', () =>
                router.replace('/matching')
              );
            } catch {
              openAlert('오류', '차단 중 오류가 발생했어요');
            }
          },
        },
      ],
      closeOnBackdrop: true,
      showCloseButton: true,
      title: '사용자 차단',
      description: '서로 추천/매칭에서 제외돼요. 진행할까요?',
    });
  };

  const modalElement = (
    <Modal
      open={modal !== null}
      title={modal?.title ?? ''}
      description={modal?.description}
      actions={modal?.actions}
      closeOnBackdrop={modal?.closeOnBackdrop}
      showCloseButton={modal?.showCloseButton}
      onClose={() => setModal(null)}
    >
      {modal?.children}
    </Modal>
  );

  const isContentLoading = isMypageFetching || isProfileLoading;
  const GenderIcon = userProfile?.gender === 'male' ? Mars : Venus;

  return (
    <PageTransition>
      <section className={styles.root} aria-labelledby="profile-title">
        <Header
          variant="profile"
          title="PROFILE"
          titleId="profile-title"
          headingLevel="h1"
          showBackButton
          menuAriaLabel="프로필 메뉴"
          menu={
            !isViewOnly && userProfile && !isBlocked ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  aria-label="이 사용자 신고"
                >
                  <Flag aria-hidden="true" size="1em" />
                </button>
                <button
                  type="button"
                  onClick={handleBlockClick}
                  aria-label="이 사용자 차단"
                >
                  <UserX aria-hidden="true" size="1em" />
                </button>
              </>
            ) : undefined
          }
        />

        <article className={styles.content}>
          {isContentLoading ? (
            <Loading className={styles.loading} />
          ) : (
            userProfile && (
              <>
                <figure className={styles.media}>
                  <Image
                    alt={`${userProfile.nickname} 프로필 사진`}
                    src={imgError ? sereMeetyLogo.src : userProfile.profilePictureUrl}
                    fill
                    priority
                    sizes="(max-width: 480px) calc(100vw - 3rem), 432px"
                    onError={() => setImgError(true)}
                    className={styles.image}
                  />
                </figure>

                {extraPhotos.length > 0 && (
                  <div
                    className={styles['extra-photos']}
                    aria-label={`${userProfile.nickname}님의 추가 사진`}
                  >
                    {extraPhotos.map((photo) => (
                      <ExtraPhotoThumb key={photo.id} photo={photo} />
                    ))}
                  </div>
                )}

                <header className={styles['info-header']}>
                  <h2 className={styles.nickname}>{userProfile.nickname}</h2>
                  <p className={styles.meta}>
                    {userProfile.age}
                    <GenderIcon
                      aria-hidden="true"
                      className={cx(
                        styles['gender-icon'],
                        styles[userProfile.gender]
                      )}
                      size="1em"
                    />
                  </p>
                </header>

                <ul className={styles['info-list']}>
                  <li className={styles.info}>
                    <Heart aria-hidden="true" size="1em" />
                    {userProfile.mbti}
                  </li>
                  <li className={styles.info}>
                    <GraduationCap aria-hidden="true" size="1em" />
                    {userProfile.university}
                  </li>
                  <li className={styles.info}>
                    <Navigation aria-hidden="true" size="1em" />
                    {userProfile.place}
                  </li>
                </ul>

                <section className={styles.intro} aria-labelledby="profile-intro-title">
                  <h3 className={styles['intro-heading']} id="profile-intro-title">
                    <UserRound aria-hidden="true" size="1em" />
                    자기소개
                  </h3>
                  <p className={styles['intro-text']}>{userProfile.introduce}</p>
                </section>

                {!isViewOnly && (
                  <footer className={styles.actions}>
                    {isAlreadyMatched ? (
                      <Button
                        text="채팅으로 이동"
                        onClick={() => router.push('/chat-list')}
                      />
                    ) : myReactionType === 'like' ? (
                      <Button text="좋아요 보냄" disabled />
                    ) : myReactionType === 'pass' ? (
                      <Button text="패스함" disabled />
                    ) : (
                      <>
                        <Button
                          text="패스"
                          type="light"
                          onClick={() => void handleReact('pass')}
                          disabled={isReactPending}
                        />
                        <Button
                          text="좋아요"
                          onClick={() => void handleReact('like')}
                          disabled={isReactPending}
                        />
                      </>
                    )}
                  </footer>
                )}
              </>
            )
          )}
        </article>
      </section>
      {modalElement}
      <ReportModal
        open={isReportOpen}
        isSubmitting={isReporting}
        onClose={() => setIsReportOpen(false)}
        onSubmit={(reason, description) =>
          void handleReportSubmit(reason, description)
        }
      />
    </PageTransition>
  );
};

interface ExtraPhotoThumbProps {
  photo: ProfilePhoto;
}

const ExtraPhotoThumb = ({ photo }: ExtraPhotoThumbProps) => {
  const [thumbError, setThumbError] = useState(false);
  return (
    <figure className={styles['extra-photo']}>
      <Image
        alt="추가 프로필 사진"
        src={thumbError ? sereMeetyLogo.src : photo.displayUrl}
        fill
        sizes="160px"
        loading="eager"
        className={styles.image}
        onError={() => setThumbError(true)}
      />
    </figure>
  );
};

export default ProfilePage;
