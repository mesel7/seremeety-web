'use client';

import Header from '@/shared/components/common/Header';
import PageTransition from '@/shared/components/common/PageTransition';
import PlanContent from '@/features/plan/components/plan/PlanContent';
import styles from './PlanPage.module.scss';

const PlanPage = () => {
  return (
    <section className={styles.root} aria-labelledby="plan-heading">
      <PageTransition>
        <Header
          title="요금제"
          titleId="plan-heading"
          showBackButton
        />
        <PlanContent />
      </PageTransition>
    </section>
  );
};

export default PlanPage;
