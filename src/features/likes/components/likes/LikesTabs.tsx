'use client';

import { cx } from '@/shared/lib/classNames';
import styles from './LikesTabs.module.scss';

export type LikesTab = 'sent' | 'received';

interface LikesTabsProps {
  value: LikesTab;
  onChange: (tab: LikesTab) => void;
}

const LikesTabs = ({ value, onChange }: LikesTabsProps) => {
  return (
    <div className={styles.root} role="tablist" aria-label="좋아요 탭">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'sent'}
        className={cx(styles.tab, value === 'sent' && styles['tab--active'])}
        onClick={() => onChange('sent')}
      >
        보낸 좋아요
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'received'}
        className={cx(styles.tab, value === 'received' && styles['tab--active'])}
        onClick={() => onChange('received')}
      >
        받은 좋아요
      </button>
    </div>
  );
};

export default LikesTabs;
