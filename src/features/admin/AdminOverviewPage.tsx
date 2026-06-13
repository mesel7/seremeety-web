'use client';

import {
  useGetOpenReportsQuery,
  useGetReviewQueueQuery,
  useGetSuspendedUsersQuery,
} from '@/shared/lib/api/adminApi';
import styles from './AdminOverviewPage.module.scss';

const AdminOverviewPage = () => {
  // 검수 카운트는 통합 큐와 동일한 소스를 사용 — admin 사용자, 데이터 잔여물 등을
  // 모두 동일 규칙으로 필터해야 카드와 큐 페이지의 숫자가 어긋나지 않는다.
  const { data: queue = [], isLoading: isQueueLoading } = useGetReviewQueueQuery();
  const { data: openReports = [], isLoading: isReportsLoading } =
    useGetOpenReportsQuery();
  const { data: suspendedUsers = [], isLoading: isSuspendedLoading } =
    useGetSuspendedUsersQuery();

  return (
    <section className={styles.root} aria-labelledby="admin-overview-title">
      <h2 id="admin-overview-title" className={styles.heading}>
        대시보드
      </h2>
      <ul className={styles.cards}>
        <li className={styles.card}>
          <p className={styles.cardLabel}>검수 대기</p>
          <p className={styles.cardValue}>
            {isQueueLoading ? '...' : queue.length}
          </p>
        </li>
        <li className={styles.card}>
          <p className={styles.cardLabel}>처리 대기 신고</p>
          <p className={styles.cardValue}>
            {isReportsLoading ? '...' : openReports.length}
          </p>
        </li>
        <li className={styles.card}>
          <p className={styles.cardLabel}>정지된 사용자</p>
          <p className={styles.cardValue}>
            {isSuspendedLoading ? '...' : suspendedUsers.length}
          </p>
        </li>
      </ul>
      <p className={styles.note}>
        상단 메뉴에서 각 큐로 이동해 검수를 진행해주세요.
      </p>
    </section>
  );
};

export default AdminOverviewPage;
