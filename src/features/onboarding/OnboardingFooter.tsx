'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Trash2 } from 'lucide-react';
import Modal, { type ModalConfig } from '@/shared/components/common/modal/Modal';
import { useAppSelector } from '@/shared/lib/store/hooks';
import { selectAuthUid } from '@/shared/lib/store/authSlice';
import {
  cancelSignupAndSignOut,
  onboardingSignOut,
} from '@/shared/lib/onboarding/cancelSignup';
import styles from './OnboardingFooter.module.scss';

// 모든 onboarding step 페이지 하단에 노출되는 공통 footer.
// - 로그아웃: 세션만 종료. 데이터는 보존되어 다음 로그인 시 같은 step부터 재개.
// - 가입 그만두기: 사용자 onboarding 데이터를 모두 삭제하고 signOut. confirm 필수.
const OnboardingFooter = () => {
  const router = useRouter();
  const uid = useAppSelector(selectAuthUid);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const handleSignOut = () => {
    setModal({
      title: '로그아웃',
      description: '입력한 내용은 그대로 저장돼요. 다시 로그인하면 이어서 작성할 수 있어요.',
      actions: [
        { label: '취소', tone: 'secondary' },
        {
          label: '로그아웃',
          autoClose: false,
          onClick: () => {
            void runSignOut();
          },
        },
      ],
    });
  };

  const handleCancelSignup = () => {
    setModal({
      title: '가입 그만두기',
      description:
        '입력한 프로필, 사진, 선호 조건, 동의 내역이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.',
      actions: [
        { label: '취소', tone: 'secondary' },
        {
          label: '데이터 삭제 후 종료',
          autoClose: false,
          onClick: () => {
            void runCancelSignup();
          },
        },
      ],
    });
  };

  const runSignOut = async () => {
    setIsBusy(true);
    try {
      await onboardingSignOut();
      setModal(null);
      router.replace('/');
    } catch (error) {
      console.error(error);
      setModal({
        title: '오류',
        description: '로그아웃 중 문제가 발생했어요.',
        actions: [{ label: '확인' }],
      });
    } finally {
      setIsBusy(false);
    }
  };

  const runCancelSignup = async () => {
    if (!uid) return;
    setIsBusy(true);
    try {
      await cancelSignupAndSignOut(uid);
      setModal(null);
      router.replace('/');
    } catch (error) {
      console.error(error);
      setModal({
        title: '오류',
        description: '데이터 삭제 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
        actions: [{ label: '확인' }],
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <footer className={styles.root}>
        <button
          type="button"
          className={styles.linkButton}
          onClick={handleSignOut}
          disabled={isBusy}
        >
          <LogOut aria-hidden="true" size={14} />
          로그아웃
        </button>
        <span className={styles.separator} aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={handleCancelSignup}
          disabled={isBusy}
        >
          <Trash2 aria-hidden="true" size={14} />
          가입 그만두기
        </button>
      </footer>
      <Modal
        open={modal !== null}
        title={modal?.title ?? ''}
        description={modal?.description}
        actions={modal?.actions}
        onClose={() => !isBusy && setModal(null)}
      />
    </>
  );
};

export default OnboardingFooter;
