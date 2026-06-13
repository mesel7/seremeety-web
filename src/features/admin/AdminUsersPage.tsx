'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import {
  useGetSuspendedUsersQuery,
  useSetUserPlanMutation,
  useSetUserRoleMutation,
  useSetUserStatusMutation,
} from '@/shared/lib/api/adminApi';
import EmptyState from '@/shared/components/common/empty-state/EmptyState';
import Loading from '@/shared/components/common/loading/Loading';
import type { PlanId } from '@/shared/types/model/billing';
import type { User } from '@/shared/types/model/user';
import styles from './AdminQueuePage.module.scss';

const AdminUsersPage = () => {
  const { data: suspended = [], isLoading } = useGetSuspendedUsersQuery();
  const [setUserStatus, { isLoading: isUpdating }] = useSetUserStatusMutation();
  const [setUserPlan, { isLoading: isPlanUpdating }] = useSetUserPlanMutation();
  const [setUserRole, { isLoading: isRoleUpdating }] = useSetUserRoleMutation();
  const [manualUid, setManualUid] = useState('');
  const [planUid, setPlanUid] = useState('');
  const [planSelection, setPlanSelection] = useState<PlanId>('premium');
  const [roleUid, setRoleUid] = useState('');
  const [roleSelection, setRoleSelection] = useState<'admin' | 'user'>('admin');

  if (isLoading) {
    return <Loading />;
  }

  const handleSuspendByUid = () => {
    const trimmed = manualUid.trim();
    if (!trimmed) return;
    void setUserStatus({ uid: trimmed, status: 'suspended' });
    setManualUid('');
  };

  const handleSetPlanByUid = () => {
    const trimmed = planUid.trim();
    if (!trimmed) return;
    void setUserPlan({ uid: trimmed, planId: planSelection });
    setPlanUid('');
  };

  const handleSetRoleByUid = () => {
    const trimmed = roleUid.trim();
    if (!trimmed) return;
    void setUserRole({ uid: trimmed, role: roleSelection });
    setRoleUid('');
  };

  return (
    <section className={styles.root} aria-labelledby="admin-users-title">
      <h2 id="admin-users-title" className={styles.heading}>
        사용자 관리
      </h2>

      <div className={styles.item}>
        <header className={styles.itemHeader}>
          <strong className={styles.nickname}>UID로 직접 정지</strong>
        </header>
        <p className={styles.subText}>
          신고 큐 외에서 정지가 필요할 때 UID를 직접 입력해 정지합니다.
        </p>
        <div className={styles.actions}>
          <input
            type="text"
            placeholder="user uid"
            className={styles.reason}
            value={manualUid}
            onChange={(e) => setManualUid(e.target.value)}
            disabled={isUpdating}
          />
          <button
            type="button"
            className={styles.reject}
            onClick={handleSuspendByUid}
            disabled={isUpdating || !manualUid.trim()}
          >
            정지
          </button>
        </div>
      </div>

      <div className={styles.item}>
        <header className={styles.itemHeader}>
          <strong className={styles.nickname}>관리자 권한 부여 / 회수</strong>
        </header>
        <p className={styles.subText}>
          최초 관리자는 functions/scripts/grant-admin.mjs CLI 로 1회 seed 한 후, 이후 admin 추가/제거는 여기서 처리합니다. admin 부여 시 onboarding 상태가 자동으로 approved 로 전이되어 곧장 /admin 진입 가능.
        </p>
        <div className={styles.actions}>
          <input
            type="text"
            placeholder="user uid"
            className={styles.reason}
            value={roleUid}
            onChange={(e) => setRoleUid(e.target.value)}
            disabled={isRoleUpdating}
          />
          <select
            className={styles.reason}
            value={roleSelection}
            onChange={(e) => setRoleSelection(e.target.value as 'admin' | 'user')}
            disabled={isRoleUpdating}
            aria-label="부여할 권한"
          >
            <option value="admin">admin (관리자)</option>
            <option value="user">user (일반 사용자)</option>
          </select>
          <button
            type="button"
            className={styles.approve}
            onClick={handleSetRoleByUid}
            disabled={isRoleUpdating || !roleUid.trim()}
          >
            적용
          </button>
        </div>
      </div>

      <div className={styles.item}>
        <header className={styles.itemHeader}>
          <strong className={styles.nickname}>UID로 플랜 변경</strong>
        </header>
        <p className={styles.subText}>
          결제 흐름을 거치지 않고 entitlement만 직접 변경합니다 (운영자 보정용).
        </p>
        <div className={styles.actions}>
          <input
            type="text"
            placeholder="user uid"
            className={styles.reason}
            value={planUid}
            onChange={(e) => setPlanUid(e.target.value)}
            disabled={isPlanUpdating}
          />
          <select
            className={styles.reason}
            value={planSelection}
            onChange={(e) => setPlanSelection(e.target.value as PlanId)}
            disabled={isPlanUpdating}
            aria-label="변경할 플랜"
          >
            <option value="free">free</option>
            <option value="premium">premium</option>
          </select>
          <button
            type="button"
            className={styles.approve}
            onClick={handleSetPlanByUid}
            disabled={isPlanUpdating || !planUid.trim()}
          >
            적용
          </button>
        </div>
      </div>

      <h3 className={styles.heading}>정지된 사용자 ({suspended.length})</h3>
      {suspended.length === 0 ? (
        <EmptyState icon={Users} message="현재 정지된 사용자가 없어요" />
      ) : (
        <ul className={styles.list}>
          {suspended.map((user) => (
            <SuspendedUserItem
              key={user.id}
              user={user}
              disabled={isUpdating}
              onRestore={() =>
                void setUserStatus({ uid: user.id, status: 'active' })
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
};

interface SuspendedUserItemProps {
  user: User;
  disabled: boolean;
  onRestore: () => void;
}

const SuspendedUserItem = ({ user, disabled, onRestore }: SuspendedUserItemProps) => {
  return (
    <li className={styles.item}>
      <header className={styles.itemHeader}>
        <strong className={styles.nickname}>{user.id.slice(0, 8)}</strong>
        <span className={styles.meta}>
          {user.role} · onboarding: {user.onboardingStatus}
        </span>
      </header>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.approve}
          onClick={onRestore}
          disabled={disabled}
        >
          복구
        </button>
      </div>
    </li>
  );
};

export default AdminUsersPage;
