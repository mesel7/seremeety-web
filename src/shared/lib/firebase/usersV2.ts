import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type {
  OnboardingStatus,
  User,
  UserRole,
  UserStatus,
} from '@/shared/types/model/user';

// 신규 도메인 모델 기준 users/{uid} 문서 접근.
// 같은 users 컬렉션을 공유하지만 onboardingStatus / role / status / authProvider
// 필드 유무로 신규 vs old-shape를 구분한다.
// 기존 lib/firebase/users.ts(old UserProfile shape)는 Slice 2-C까지 유지된다.

const COLLECTION = 'users';

export const getUserV2ByUid = async (uid: string): Promise<User | null> => {
  const docSnap = await getDoc(doc(db, COLLECTION, uid));
  if (!docSnap.exists()) {
    return null;
  }
  const data = docSnap.data();
  if (typeof data.onboardingStatus !== 'string') {
    return null;
  }
  return toPlainTimestamps({ id: docSnap.id, ...(data as Omit<User, 'id'>) });
};

export const hasUserDoc = async (uid: string): Promise<boolean> => {
  const docSnap = await getDoc(doc(db, COLLECTION, uid));
  return docSnap.exists();
};

export const createNewUserV2 = async (
  uid: string,
  phoneNumberMasked?: string
): Promise<void> => {
  await setDoc(
    doc(db, COLLECTION, uid),
    {
      authProvider: 'firebase_phone',
      phoneAuthVerified: true,
      phoneNumberMasked: phoneNumberMasked ?? '',
      role: 'user',
      status: 'active',
      onboardingStatus: 'auth_only',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );
};

// 기존 old-shape 사용자가 처음 로그인할 때 grandfather 필드를 채워준다.
// onboardingStatus를 'approved'로 마크하여 기존 사용자가 끊김없이 /matching에 진입.
export const grandfatherExistingUser = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, uid), {
    authProvider: 'firebase_phone',
    phoneAuthVerified: true,
    role: 'user',
    status: 'active',
    onboardingStatus: 'approved',
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
};

export const setOnboardingStatus = async (
  uid: string,
  onboardingStatus: OnboardingStatus
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, uid), {
    onboardingStatus,
    updatedAt: serverTimestamp(),
  });
};

export const updateLastLogin = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, uid), {
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// 운영자 권한 부여/회수. admin 부여 시 onboarding 우회 — onboardingStatus 가
// 'approved' 가 아니면 'approved' 로 함께 전이해 다음 진입에서 곧장 /admin 으로 이동.
// 회수 시엔 onboarding 흐름을 건드리지 않는다 (이미 정상 사용자였다면 그대로).
export const setUserRole = async (
  uid: string,
  role: UserRole
): Promise<void> => {
  const update: Record<string, unknown> = {
    role,
    updatedAt: serverTimestamp(),
  };
  if (role === 'admin') {
    update.onboardingStatus = 'approved';
    update.status = 'active';
  }
  await updateDoc(doc(db, COLLECTION, uid), update);
};

// admin 사용자 정지/복구. status='suspended'/'deleted' 시 resolveEntryRoute가
// /account/{suspended|deleted}로 라우팅한다.
export const setUserStatus = async (
  uid: string,
  status: UserStatus
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, uid), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'deleted' ? { deletedAt: serverTimestamp() } : {}),
  });
};

// status로 필터한 모든 사용자. admin 정지 사용자 큐에 사용.
export const getUsersByStatus = async (status: UserStatus): Promise<User[]> => {
  const q = query(collection(db, COLLECTION), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) =>
      toPlainTimestamps({ id: d.id, ...(d.data() as Omit<User, 'id'>) })
    )
    // onboardingStatus 필드가 있어야 v2 사용자로 간주.
    .filter((u) => typeof u.onboardingStatus === 'string');
};
