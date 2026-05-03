import { Receipt } from 'lucide-react';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import { cx } from '@/shared/lib/classNames';
import type { Payment, PaymentStatus } from '@/shared/types/model/billing';
import styles from './PaymentHistory.module.scss';

const STATUS_LABEL: Record<PaymentStatus, string> = {
  mock_pending: '대기 중',
  mock_success: '결제 완료',
  mock_failed: '결제 실패',
  cancelled: '취소됨',
  refunded: '환불됨',
};

const formatDate = (createdAt: Payment['createdAt']) => {
  if (!createdAt) return '';
  if (createdAt instanceof Date) return createdAt.toLocaleDateString('ko-KR');
  if ('seconds' in createdAt) {
    return new Date(createdAt.seconds * 1000).toLocaleDateString('ko-KR');
  }
  return '';
};

interface PaymentHistoryProps {
  payments: Payment[];
}

const PaymentHistory = ({ payments }: PaymentHistoryProps) => {
  return (
    <section className={styles.root} aria-labelledby="payment-history-heading">
      <h3 id="payment-history-heading" className={styles.heading}>
        결제 내역
      </h3>
      {payments.length === 0 ? (
        <EmptyState icon={Receipt} message="아직 결제 내역이 없어요" />
      ) : (
        <ul className={styles.list}>
          {payments.map((payment) => (
            <li key={payment.id} className={styles.item}>
              <div className={styles.row}>
                <span className={styles.plan}>
                  {payment.planId === 'premium' ? '프리미엄' : '무료'}
                </span>
                <span className={styles.amount}>
                  {payment.amount.toLocaleString('ko-KR')}원
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.date}>{formatDate(payment.createdAt)}</span>
                <span className={cx(styles.status, styles[`status--${payment.status}`])}>
                  {STATUS_LABEL[payment.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PaymentHistory;
