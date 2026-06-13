import {
  collection,
  doc,
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
import type { Preference } from '@/shared/types/model/preference';

const COLLECTION = 'preferences';

export const getPreferenceByUserId = async (userId: string): Promise<Preference | null> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId), fsLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const docSnap = snap.docs[0];
  return toPlainTimestamps({ id: docSnap.id, ...(docSnap.data() as Omit<Preference, 'id'>) });
};

export const createPreference = async (
  userId: string,
  partial: Omit<Preference, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    userId,
    ...partial,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updatePreference = async (
  preferenceId: string,
  data: Partial<Omit<Preference, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, preferenceId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};
