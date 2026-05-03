import { Check } from 'lucide-react';
import type { PlanDefinition } from '@/shared/lib/billing/plans';
import { cx } from '@/shared/lib/classNames';
import styles from './PlanCard.module.scss';

export interface PlanCardAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  // 'cta'는 강조형 (gradient), 'muted'는 중성형 (outline)
  tone?: 'cta' | 'muted';
}

interface PlanCardProps {
  plan: PlanDefinition;
  isCurrent: boolean;
  // null이면 카드에 액션 버튼을 노출하지 않음 (예: premium 사용자가 보는 free 카드)
  action: PlanCardAction | null;
}

const formatPrice = (priceKrw: number, durationDays?: number) => {
  if (priceKrw === 0) return '무료';
  const formatted = priceKrw.toLocaleString('ko-KR');
  return durationDays ? `${formatted}원 / ${durationDays}일` : `${formatted}원`;
};

const PlanCard = ({ plan, isCurrent, action }: PlanCardProps) => {
  const isPremium = plan.id === 'premium';

  return (
    <article
      className={cx(
        styles.root,
        isPremium && styles['root--premium'],
        isCurrent && styles['root--current']
      )}
    >
      <header className={styles.header}>
        <h3 className={styles.title}>{plan.label}</h3>
        {isCurrent && <span className={styles.badge}>현재 플랜</span>}
      </header>
      <p className={styles.price}>{formatPrice(plan.priceKrw, plan.durationDays)}</p>
      <ul className={styles.highlights}>
        {plan.highlights.map((item) => (
          <li key={item} className={styles.highlight}>
            <Check aria-hidden="true" size={16} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {action && (
        <button
          type="button"
          className={cx(
            styles.action,
            action.tone === 'cta' && styles['action--cta']
          )}
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      )}
    </article>
  );
};

export default PlanCard;
