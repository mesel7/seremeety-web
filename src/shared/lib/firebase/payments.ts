import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Payment } from '@/shared/types/model/billing';

const COLLECTION = 'payments';

// Phase 3-B: 결제 생성/완료(createMockPayment / completeMockPayment)는 Functions
// callable(functions/src/payments/checkout.ts)로 이전됐다. payments write는
// firestore.rules에서 client에 차단(server-only)되며, 여기에는 read 헬퍼만 남는다.
// 실 PG 연동 시에도 결제 상태 전이는 webhook(Functions)이 담당한다.

export const getPaymentById = async (
  paymentId: string
): Promise<Payment | null> => {
  const snap = await getDoc(doc(db, COLLECTION, paymentId));
  if (!snap.exists()) return null;
  return toPlainTimestamps({ id: snap.id, ...snap.data() } as Payment);
};

const timestampSeconds = (value: Payment['createdAt']): number => {
  if (!value) return 0;
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if ('seconds' in value) return value.seconds;
  return 0;
};

// userId 단일 where + 클라이언트 정렬. orderBy를 함께 쓰면 composite index가
// 필요해지는데, 본 컬렉션은 사용자별 결제 건수가 많지 않아 client sort가 충분하다.
export const getPaymentsByUserId = async (
  userId: string
): Promise<Payment[]> => {
  const q = query(collection(db, COLLECTION), where('userId', '==', userId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) =>
    toPlainTimestamps({ id: d.id, ...d.data() } as Payment)
  );
  return items.sort(
    (a, b) => timestampSeconds(b.createdAt) - timestampSeconds(a.createdAt)
  );
};
