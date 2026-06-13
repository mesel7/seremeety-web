import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Profile, ProfileStatus } from '@/shared/types/model/profile';

const COLLECTION = 'profiles';

export const getProfileByUserId = async (userId: string): Promise<Profile | null> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId), fsLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const docSnap = snap.docs[0];
  return toPlainTimestamps({ id: docSnap.id, ...(docSnap.data() as Omit<Profile, 'id'>) });
};

// admin 검수 큐용. status로 필터한 모든 프로필을 반환한다.
// MVP 운영 도구라 페이징은 생략 — 검수 대기 큐는 작게 유지된다는 가정.
export const getProfilesByStatus = async (
  status: ProfileStatus
): Promise<Profile[]> => {
  const q = query(collection(db, COLLECTION), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toPlainTimestamps({ id: d.id, ...(d.data() as Omit<Profile, 'id'>) })
  );
};

export const getProfileById = async (profileId: string): Promise<Profile | null> => {
  const docSnap = await getDoc(doc(db, COLLECTION, profileId));
  if (!docSnap.exists()) {
    return null;
  }
  return toPlainTimestamps({ id: docSnap.id, ...(docSnap.data() as Omit<Profile, 'id'>) });
};

export const createDraftProfile = async (
  userId: string,
  partial: Partial<Omit<Profile, 'id' | 'userId' | 'status' | 'createdAt' | 'updatedAt'>> = {}
): Promise<string> => {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    userId,
    nickname: '',
    birthYear: 0,
    gender: 'male',
    location: '',
    bio: '',
    tags: [],
    ...partial,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateProfile = async (
  profileId: string,
  data: Partial<Omit<Profile, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, profileId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
