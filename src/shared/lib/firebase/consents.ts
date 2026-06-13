import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Consent } from '@/shared/types/model/consent';

const COLLECTION = 'consents';

export const getLatestConsentByUserId = async (userId: string): Promise<Consent | null> => {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    orderBy('agreedAt', 'desc'),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  const docSnap = snap.docs[0];
  return toPlainTimestamps({ id: docSnap.id, ...(docSnap.data() as Omit<Consent, 'id'>) });
};

export const createConsent = async (
  userId: string,
  partial: Omit<Consent, 'id' | 'userId' | 'createdAt'>
): Promise<string> => {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    userId,
    ...partial,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};
