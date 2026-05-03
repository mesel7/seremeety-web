import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { toPlainTimestamps } from '@/shared/lib/firebase/serialize';
import type { Payment, PaymentStatus, PlanId } from '@/shared/types/model/billing';

const COLLECTION = 'payments';

interface CreateMockPaymentInput {
  userId: string;
  planId: PlanId;
  amount: number;
}

// Phase 9 mock checkout 진입 시 'mock_pending' 상태 결제 문서를 만든다.
// providerPaymentId는 mock에서는 비워두고, 추후 PG 연동 시 채운다.
export const createMockPayment = async (
  input: CreateMockPaymentInput
): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    userId: input.userId,
    provider: 'mock',
    planId: input.planId,
    amount: input.amount,
    currency: 'KRW',
    status: 'mock_pending' satisfies PaymentStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(ref, { id: ref.id });
  return ref.id;
};

// mock checkout 종료 시 success/failure에 따라 status를 갱신한다.
//
// === future PG webhook placeholder (ROADMAP Phase 3) ===
// 실제 PG 연동 시 본 함수의 client-side 호출은 사라지고, 다음 흐름이 들어선다.
//   1) client는 PG SDK를 통해 결제 요청만 시작하고 즉시 returnUrl로 리디렉션.
//   2) PG 서버가 결제 처리 후 우리 Functions endpoint
//      (`functions/payments/webhook`) 로 webhook을 보낸다.
//   3) Functions endpoint는 PG 서명 검증 → providerPaymentId 매핑 →
//      payments.{id}.status 갱신 + entitlement.planId 갱신을 batched write/
//      transaction으로 한 번에 처리한다.
//   4) client는 returnUrl 페이지에서 Entitlement query를 invalidate해 최신화.
// 위 단계 중 atomicity가 핵심이라 client에서 두 갱신을 분리한 본 mock 흐름은
// 임시 구현이다. PG 도입 시 mockComplete 호출부 + 본 함수는 제거하고,
// Functions webhook + client redirect 흐름으로 대체한다.
export const completeMockPayment = async (
  paymentId: string,
  success: boolean
): Promise<PaymentStatus> => {
  const status: PaymentStatus = success ? 'mock_success' : 'mock_failed';
  await updateDoc(doc(db, COLLECTION, paymentId), {
    status,
    updatedAt: serverTimestamp(),
  });
  return status;
};

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
