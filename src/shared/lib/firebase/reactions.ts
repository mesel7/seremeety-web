import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Reaction, ReactionType } from '@/shared/types/model/reaction';

const COLLECTION = 'reactions';

// 같은 페어(from→to)의 반응은 항상 1개만 유지하기 위해 doc id를 결정적으로 만든다.
// addDoc + composite index 회피 + 중복 작성 방지 효과.
const pairId = (fromUserId: string, toUserId: string): string =>
  `${fromUserId}_${toUserId}`;

// TODO(Phase 3): Functions로 이동. 현재는 클라이언트에서 직접 write하며
// daily limit / 자기 자신 / 차단 사용자 검증은 호출 측에서 책임진다.
export const createReaction = async (
  fromUserId: string,
  toUserId: string,
  type: ReactionType
): Promise<string> => {
  const id = pairId(fromUserId, toUserId);
  const ref = doc(db, COLLECTION, id);
  await setDoc(ref, {
    fromUserId,
    toUserId,
    type,
    createdAt: serverTimestamp(),
  });
  return id;
};

export const getReaction = async (
  fromUserId: string,
  toUserId: string
): Promise<Reaction | null> => {
  const ref = doc(db, COLLECTION, pairId(fromUserId, toUserId));
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  return toPlainTimestamps({
    id: snap.id,
    ...(snap.data() as Omit<Reaction, 'id'>),
  });
};

// fromUserId가 보낸 모든 반응. Phase 5-B 추천 후보에서 이미 react한 유저
// 제외에 사용한다.
export const getReactionsFromUser = async (
  fromUserId: string
): Promise<Reaction[]> => {
  const q = query(collection(db, COLLECTION), where('fromUserId', '==', fromUserId));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toPlainTimestamps({ id: d.id, ...(d.data() as Omit<Reaction, 'id'>) })
  );
};

// toUserId로 받은 모든 반응. 받은 좋아요 페이지에서 사용한다.
// firestore.rules에서 toUserId == auth.uid에 read 권한이 부여되어야 동작.
export const getReactionsToUser = async (
  toUserId: string
): Promise<Reaction[]> => {
  const q = query(collection(db, COLLECTION), where('toUserId', '==', toUserId));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toPlainTimestamps({ id: d.id, ...(d.data() as Omit<Reaction, 'id'>) })
  );
};
