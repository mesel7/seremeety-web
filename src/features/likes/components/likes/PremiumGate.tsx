'use client';

import { Crown } from 'lucide-react';
import Link from 'next/link';
import styles from './PremiumGate.module.scss';

interface PremiumGateProps {
  description: string;
}

const PremiumGate = ({ description }: PremiumGateProps) => {
  return (
    <div className={styles.root} role="status">
      <Crown aria-hidden="true" className={styles.icon} size={36} />
      <h3 className={styles.title}>프리미엄 전용</h3>
      <p className={styles.description}>{description}</p>
      <Link href="/plan" className={styles.cta}>
        프리미엄 알아보기
      </Link>
    </div>
  );
};

export default PremiumGate;
