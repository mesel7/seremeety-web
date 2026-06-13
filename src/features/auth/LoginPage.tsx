'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Hash, KeyRound, LockKeyholeOpen, Phone } from 'lucide-react';
import React from 'react';
import LoginLogo from '@/features/auth/components/LoginLogo';
import { toIntlPhoneNumber, toLocalePhoneNumber } from '@/shared/lib/format';
import { signInWithPhoneNumber } from 'firebase/auth';
import { auth, setupRecaptchaVerifier, teardownRecaptchaVerifier } from '@/firebase';
import Button from '@/shared/components/common/button/Button';
import Modal, { type ModalConfig } from '@/shared/components/common/modal/Modal';
import styles from './LoginPage.module.scss';

const LoginPage = () => {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const recaptchaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (recaptchaRef.current) {
      setupRecaptchaVerifier(recaptchaRef.current);
    }
    // unmount 시점에 verifier 의 DOM 컨테이너가 사라지므로 같이 cleanup.
    // 다음 mount 에서 setupRecaptchaVerifier 가 새 verifier 를 만든다.
    return () => {
      teardownRecaptchaVerifier();
    };
  }, []);

  const handlePhoneNumberChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    if (/^[\d-]*$/.test(input)) {
      setPhoneNumber(toLocalePhoneNumber(input));
    }
  }, []);

  const handleCodeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    if (/^\d*$/.test(input)) {
      setVerificationCode(input);
    }
  }, []);

  const openAlert = useCallback((title: string, description?: string, children?: ReactNode) => {
    setModal({
      actions: [{ label: '확인' }],
      children,
      closeOnBackdrop: false,
      description,
      showCloseButton: false,
      title,
    });
  }, []);

  const handleSendCode = useCallback(async () => {
    if (!phoneNumber) {
      openAlert('전화번호 입력', '전화번호를 입력해주세요');
      return;
    }

    const appVerifier = typeof window !== 'undefined' ? window.recaptchaVerifier : null;

    if (!appVerifier) {
      openAlert('인증번호 전송 실패', '보안 인증을 불러오지 못했습니다');
      return;
    }

    try {
      await appVerifier.render();
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        toIntlPhoneNumber(phoneNumber),
        appVerifier
      );
      window.confirmationResult = confirmationResult;
      openAlert('인증번호 전송', '인증번호가 전송되었습니다');
    } catch (error) {
      console.error(error);
      openAlert('인증번호 전송 실패', '잘못된 전화번호이거나 오류가 발생했습니다');
    }
  }, [openAlert, phoneNumber]);

  const handleVerifyCode = useCallback(async () => {
    const confirmationResult =
      typeof window !== 'undefined' ? window.confirmationResult ?? null : null;

    if (!verificationCode) {
      openAlert('인증번호 입력', '인증번호를 입력해주세요');
      return;
    }

    if (!confirmationResult) {
      openAlert('인증 실패', '인증에 오류가 발생했습니다');
      return;
    }

    try {
      await confirmationResult.confirm(verificationCode);
    } catch (error) {
      console.error(error);
      openAlert('로그인 실패', '잘못된 인증번호이거나 오류가 발생했습니다');
    }
  }, [openAlert, verificationCode]);

  const handleNoAccountClick = useCallback(() => {
    openAlert(
      '안내 / お知らせ',
      undefined,
      <>
        <p>
          테스트 번호 01011111111을 입력 후 인증 버튼을 누르세요. 인증번호 111111을 입력하면 로그인
          가능합니다.
        </p>
        <p>
          テスト番号 01011111111 を入力し、認証ボタン を押していただきます。認証コード 111111 を入力いただくと、ログイン可能です。
        </p>
      </>
    );
  }, [openAlert]);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <div className={styles.root}>
      <LoginLogo />
      <div className={styles.form}>
        <div className={styles.inputs}>
          <div className={styles.field}>
            <Phone aria-hidden="true" className={styles.icon} size="1em" />
            <label className="sr-only" htmlFor="phone">
              전화번호
            </label>
            <input
              className={styles.input}
              id="phone"
              name="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              placeholder="전화번호"
              maxLength={13}
            />
          </div>

          <div className={styles.field}>
            <Hash aria-hidden="true" className={styles.icon} size="1em" />
            <label className="sr-only" htmlFor="code">
              인증번호
            </label>
            <input
              className={styles.input}
              id="code"
              name="code"
              type="text"
              value={verificationCode}
              onChange={handleCodeChange}
              placeholder="인증번호"
              maxLength={6}
            />
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            text={'인증 / 認証'}
            icon={KeyRound}
            type={'light'}
            onClick={handleSendCode}
          />
          <Button
            text={'로그인 / ログイン'}
            icon={LockKeyholeOpen}
            onClick={handleVerifyCode}
          />
        </div>
      </div>
      <button className={styles.hint} type="button" onClick={handleNoAccountClick}>
        테스트 로그인 안내 / テスト用ログインのご案内
      </button>
      <div ref={recaptchaRef} />
      <Modal
        open={modal !== null}
        title={modal?.title ?? ''}
        description={modal?.description}
        actions={modal?.actions}
        closeOnBackdrop={modal?.closeOnBackdrop}
        showCloseButton={modal?.showCloseButton}
        onClose={closeModal}
      >
        {modal?.children}
      </Modal>
    </div>
  );
};

export default React.memo(LoginPage);
