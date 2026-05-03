import Modal from '@/shared/components/common/modal/Modal';
import type { PlanDefinition } from '@/shared/lib/billing/plans';
import styles from './MockCheckoutModal.module.scss';

interface MockCheckoutModalProps {
  plan: PlanDefinition | null;
  open: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onResult: (success: boolean) => void;
}

// Phase 9 mock checkout: 실제 PG 대신 사용자가 성공/실패를 직접 선택해
// 결제 흐름과 entitlement 갱신을 시뮬레이션한다. ROADMAP "하지 말 것"의
// "mock payment를 real payment처럼 취급하지 않음" 항목을 만족시킨다.
const MockCheckoutModal = ({
  plan,
  open,
  isProcessing,
  onClose,
  onResult,
}: MockCheckoutModalProps) => {
  if (!plan) return null;

  const priceLabel = `${plan.priceKrw.toLocaleString('ko-KR')}원${
    plan.durationDays ? ` / ${plan.durationDays}일` : ''
  }`;

  return (
    <Modal
      open={open}
      title="mock 결제 시뮬레이션"
      closeOnBackdrop={false}
      showCloseButton={!isProcessing}
      onClose={isProcessing ? undefined : onClose}
      actions={[
        {
          label: '결제 실패',
          tone: 'secondary',
          disabled: isProcessing,
          autoClose: false,
          onClick: () => onResult(false),
        },
        {
          label: '결제 성공',
          disabled: isProcessing,
          autoClose: false,
          onClick: () => onResult(true),
        },
      ]}
    >
      <div className={styles.summary}>
        <span className={styles.label}>{plan.label}</span>
        <strong className={styles.price}>{priceLabel}</strong>
      </div>
      <p className={styles.notice}>
        실제 결제는 발생하지 않습니다. 결과를 직접 선택해 결제 흐름을 시뮬레이션해 주세요.
      </p>
    </Modal>
  );
};

export default MockCheckoutModal;
