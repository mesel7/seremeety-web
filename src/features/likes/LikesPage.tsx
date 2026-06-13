'use client';

import { useState } from 'react';
import Header from '@/shared/components/common/Header';
import PageTransition from '@/shared/components/common/PageTransition';
import LikesTabs, { type LikesTab } from './components/likes/LikesTabs';
import SentLikesContent from './components/likes/SentLikesContent';
import ReceivedLikesContent from './components/likes/ReceivedLikesContent';
import styles from './LikesPage.module.scss';

const LikesPage = () => {
  const [tab, setTab] = useState<LikesTab>('sent');

  return (
    <section className={styles.root} aria-labelledby="likes-heading">
      <PageTransition>
        <Header title="LIKES" titleId="likes-heading" headingLevel="h1" />
        <LikesTabs value={tab} onChange={setTab} />
        {tab === 'sent' ? <SentLikesContent /> : <ReceivedLikesContent />}
      </PageTransition>
    </section>
  );
};

export default LikesPage;
