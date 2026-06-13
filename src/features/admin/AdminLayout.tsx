'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { auth } from '@/firebase';
import { cx } from '@/shared/lib/classNames';
import styles from './AdminLayout.module.scss';

interface AdminLayoutProps {
  children: ReactNode;
}

// "프로필 검수" 카드에 그 사용자의 모든 사진이 같이 노출되어 한 화면에서 처리되므로
// "사진 검수" 별도 항목은 nav에서 제거. (/admin/photos 라우트는 단건 검수용 fallback
// 으로 살려두지만 직접 navigation은 안 함.)
const NAV_ITEMS = [
  { href: '/admin', label: 'OVERVIEW' },
  { href: '/admin/profiles', label: '검수 큐' },
  { href: '/admin/reports', label: '신고' },
  { href: '/admin/users', label: '사용자' },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut(auth);
      router.replace('/');
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>ADMIN</h1>
          <button
            type="button"
            className={styles.logout}
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            aria-label="로그아웃"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{isSigningOut ? '로그아웃 중...' : '로그아웃'}</span>
          </button>
        </div>
        <nav className={styles.nav} aria-label="관리자 메뉴">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                styles.navItem,
                pathname === item.href && styles['navItem--active']
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
};

export default AdminLayout;
