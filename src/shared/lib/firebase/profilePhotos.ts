import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { PhotoStatus, ProfilePhoto } from '@/shared/types/model/photo';

const COLLECTION = 'profilePhotos';

export const MAX_PROFILE_PHOTOS = 6;

// Firestore composite index를 요구하지 않도록 where(userId)만 서버에서 필터하고
// status / order는 클라이언트에서 처리한다. 사진 수가 사용자당 작아서 비용 부담 없음.
export const getProfilePhotosByUserId = async (userId: string): Promise<ProfilePhoto[]> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) =>
      toPlainTimestamps({ id: d.id, ...(d.data() as Omit<ProfilePhoto, 'id'>) })
    )
    .filter((p) => p.status !== 'deleted')
    .sort((a, b) => a.order - b.order);
};

// admin 검수 큐용. status로 필터한 모든 사진.
export const getPhotosByStatus = async (
  status: PhotoStatus
): Promise<ProfilePhoto[]> => {
  const q = query(collection(db, COLLECTION), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toPlainTimestamps({ id: d.id, ...(d.data() as Omit<ProfilePhoto, 'id'>) })
  );
};

// 한 사용자의 pending 사진을 모두 approved로 일괄 전이. admin 큐의 단일 "승인"
// 액션에서 프로필 + 그 사용자의 pending 사진들을 한꺼번에 처리할 때 사용.
export const approvePendingPhotosForUser = async (
  userId: string,
  reviewerUid: string
): Promise<void> => {
  const photos = await getProfilePhotosByUserId(userId);
  const pending = photos.filter((p) => p.status === 'pending');
  if (pending.length === 0) return;
  const batch = writeBatch(db);
  for (const p of pending) {
    batch.update(doc(db, COLLECTION, p.id), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerUid,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
};

export const createProfilePhoto = async (
  userId: string,
  profileId: string,
  partial: Omit<
    ProfilePhoto,
    'id' | 'userId' | 'profileId' | 'status' | 'createdAt' | 'updatedAt'
  >
): Promise<string> => {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    userId,
    profileId,
    ...partial,
    // 신규 사진은 admin 검수 대기 상태로 시작. /admin/photos 큐에서 승인/반려.
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateProfilePhoto = async (
  photoId: string,
  data: Partial<Omit<ProfilePhoto, 'id' | 'userId' | 'profileId' | 'createdAt'>>
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, photoId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

// 한 사진을 메인으로 지정하고 나머지 사용자 사진의 isMain을 false로 일괄 갱신.
// Firestore writeBatch 한 번에 처리하여 일관성 보장.
export const setMainProfilePhoto = async (userId: string, photoId: string): Promise<void> => {
  const photos = await getProfilePhotosByUserId(userId);
  const batch = writeBatch(db);
  photos.forEach((photo) => {
    const shouldBeMain = photo.id === photoId;
    if (photo.isMain !== shouldBeMain) {
      batch.update(doc(db, COLLECTION, photo.id), {
        isMain: shouldBeMain,
        updatedAt: serverTimestamp(),
      });
    }
  });
  await batch.commit();
};

// 사진 soft delete. Storage 파일은 별도 cleanup job 영역(Phase 11).
export const softDeleteProfilePhoto = async (photoId: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, photoId), {
    status: 'deleted',
    isMain: false,
    updatedAt: serverTimestamp(),
  });
};
