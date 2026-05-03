'use client';

import { useState } from 'react';
import Loading from '@/shared/components/common/loading/Loading';
import Modal, { type ModalConfig } from '@/shared/components/common/modal/Modal';
import { useGetMyEntitlementQuery } from '@/shared/lib/api/entitlementApi';
import {
  useCancelMockSubscriptionMutation,
  useGetMyPaymentsQuery,
  useMockCheckoutMutation,
  useMockCompleteMutation,
} from '@/shared/lib/api/paymentApi';
import { FREE_PLAN, PREMIUM_PLAN } from '@/shared/lib/billing/plans';
import type { PlanId } from '@/shared/types/model/billing';
import MockCheckoutModal from './MockCheckoutModal';
import PaymentHistory from './PaymentHistory';
import PlanCard, { type PlanCardAction } from './PlanCard';
import styles from './PlanContent.module.scss';

// free 카드의 액션. 사용자가 free 사용 중이면 비활성 "사용 중" 표시,
// premium 사용자에게는 다운그레이드 흐름이 아직 없으므로 액션 자체를 비노출.
const freeCardAction = (currentPlanId: PlanId): PlanCardAction | null => {
  if (currentPlanId === 'free') {
    return { label: '사용 중', disabled: true };
  }
  return null;
};

// premium 카드의 액션. 미사용자에게는 결제 시작 CTA, premium 사용자에게는 구독 취소 진입.
const premiumCardAction = (
  currentPlanId: PlanId,
  isBusy: boolean,
  onStart: () => void,
  onCancel: () => void
): PlanCardAction => {
  if (currentPlanId === 'premium') {
    return {
      label: '구독 취소',
      onClick: onCancel,
      disabled: isBusy,
      tone: 'muted',
    };
  }
  return {
    label: '프리미엄 시작',
    onClick: onStart,
    disabled: isBusy,
    tone: 'cta',
  };
};

const PlanContent = () => {
  const { data: entitlement, isLoading: isEntitlementLoading } =
    useGetMyEntitlementQuery();
  const { data: payments = [], isLoading: isPaymentsLoading } =
    useGetMyPaymentsQuery();
  const [mockCheckout, { isLoading: isCheckoutPending }] = useMockCheckoutMutation();
  const [mockComplete, { isLoading: isCompletePending }] = useMockCompleteMutation();
  const [cancelSubscription, { isLoading: isCancelPending }] =
    useCancelMockSubscriptionMutation();

  // checkoutPlan + pendingPaymentId가 함께 set되면 mock checkout 모달이 열린다.
  // 결과(success/fail)를 받으면 둘 다 null로 리셋되고 result 모달이 표시된다.
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<ModalConfig | null>(null);

  const currentPlanId = entitlement?.planId ?? 'free';
  const isBusy = isCheckoutPending || isCompletePending || isCancelPending;

  if (isEntitlementLoading) {
    return <Loading className={styles.loading} />;
  }

  const handleStartPremium = async () => {
    try {
      const { paymentId } = await mockCheckout({ planId: 'premium' }).unwrap();
      setPendingPaymentId(paymentId);
      setCheckoutPlan('premium');
    } catch {
      setResultModal({
        actions: [{ label: '확인' }],
        title: '결제 준비 실패',
        description: '잠시 후 다시 시도해 주세요.',
      });
    }
  };

  const runCancelSubscription = async () => {
    try {
      await cancelSubscription().unwrap();
      setResultModal({
        actions: [{ label: '확인' }],
        title: '구독 취소 완료',
        description: '무료 플랜으로 변경되었어요.',
      });
    } catch {
      setResultModal({
        actions: [{ label: '확인' }],
        title: '오류',
        description: '구독 취소 중 문제가 발생했어요.',
      });
    }
  };

  const handleCancelPremium = () => {
    // mock 환경: 즉시 entitlement를 free로 플립한다. 환불/만료 정책은 mock 범위 밖.
    setResultModal({
      title: '구독 취소',
      description: '프리미엄 구독을 취소하시겠어요? 즉시 무료 플랜으로 변경됩니다.',
      actions: [
        { label: '아니요', tone: 'secondary' },
        {
          label: '구독 취소',
          onClick: () => {
            void runCancelSubscription();
          },
        },
      ],
    });
  };

  const handleCheckoutResult = async (success: boolean) => {
    if (!pendingPaymentId || !checkoutPlan) return;
    try {
      const { status } = await mockComplete({
        paymentId: pendingPaymentId,
        planId: checkoutPlan,
        success,
      }).unwrap();
      setCheckoutPlan(null);
      setPendingPaymentId(null);
      setResultModal({
        actions: [{ label: '확인' }],
        title: status === 'mock_success' ? '결제 완료' : '결제 실패',
        description:
          status === 'mock_success'
            ? '프리미엄 플랜이 활성화되었어요.'
            : '결제가 실패 처리되었어요. 다시 시도해 주세요.',
      });
    } catch {
      setResultModal({
        actions: [{ label: '확인' }],
        title: '오류',
        description: '결제 처리 중 문제가 발생했어요.',
      });
    }
  };

  const handleCloseCheckout = () => {
    // mock_pending 상태로 남은 payment 문서는 별도 정리하지 않는다.
    // 사용자가 다시 시도하면 새 payment가 생성된다 (idempotency 비요구).
    setCheckoutPlan(null);
    setPendingPaymentId(null);
  };

  return (
    <div className={styles.root}>
      <p className={styles.notice} role="note">
        세레미티는 현재 mock 결제 환경입니다. 실제 결제는 발생하지 않아요.
      </p>
      <div className={styles.planList}>
        <PlanCard
          plan={FREE_PLAN}
          isCurrent={currentPlanId === 'free'}
          action={freeCardAction(currentPlanId)}
        />
        <PlanCard
          plan={PREMIUM_PLAN}
          isCurrent={currentPlanId === 'premium'}
          action={premiumCardAction(currentPlanId, isBusy, handleStartPremium, handleCancelPremium)}
        />
      </div>
      {isPaymentsLoading ? (
        <Loading className={styles.historyLoading} />
      ) : (
        <PaymentHistory payments={payments} />
      )}
      <MockCheckoutModal
        plan={checkoutPlan === 'premium' ? PREMIUM_PLAN : null}
        open={checkoutPlan !== null}
        isProcessing={isCompletePending}
        onClose={handleCloseCheckout}
        onResult={handleCheckoutResult}
      />
      <Modal
        open={resultModal !== null}
        title={resultModal?.title ?? ''}
        description={resultModal?.description}
        actions={resultModal?.actions}
        onClose={() => setResultModal(null)}
      />
    </div>
  );
};

export default PlanContent;
