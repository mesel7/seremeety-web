import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import { getPaymentsByUserId } from '@/shared/lib/firebase/payments';
import type { Payment, PaymentStatus, PlanId } from '@/shared/types/model/billing';

interface MockCheckoutArgs {
  planId: PlanId;
}

interface MockCompleteArgs {
  paymentId: string;
  // planId는 더 이상 client에서 신뢰하지 않는다(server가 payment.planId로 판정).
  // PlanContent 호출 호환성을 위해 인자 형태만 유지하고 callable에는 전달하지 않는다.
  planId: PlanId;
  success: boolean;
}

export interface MockCompleteResult {
  paymentId: string;
  status: PaymentStatus;
}

// Phase 3-B: mock 결제/권한 변경은 Functions onCall로 이전됐다.
// - createMockPayment : mock_pending 결제 문서를 server에서 생성(amount는 server PLANS 기준)
// - completeMockPayment: 본인 mock_pending 결제만 종결 + entitlement를 server PLANS로 atomic 갱신
// - cancelMockSubscription: entitlement를 free로 다운그레이드(server-only)
// client는 callable만 호출하고, firestore.rules가 payments write / entitlements update의
// client 직접 쓰기를 차단한다. (admin의 플랜 보정은 adminApi.setUserPlan → isAdmin rule로 통과.)
const createMockPaymentCallable = httpsCallable<
  { planId: PlanId },
  { paymentId: string }
>(functions, 'createMockPayment');

const completeMockPaymentCallable = httpsCallable<
  { paymentId: string; success: boolean },
  { paymentId: string; status: PaymentStatus }
>(functions, 'completeMockPayment');

const cancelMockSubscriptionCallable = httpsCallable<void, { ok: true }>(
  functions,
  'cancelMockSubscription'
);

export const paymentApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    // 내 결제 내역 (최신순). 요금제 페이지 하단 "결제 내역" 섹션에 사용.
    getMyPayments: builder.query<Payment[], void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: [] };
          const payments = await getPaymentsByUserId(uid);
          return { data: payments };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Payment'],
    }),

    // mock checkout 시작. server가 mock_pending 결제를 만들고 paymentId 반환.
    mockCheckout: builder.mutation<{ paymentId: string }, MockCheckoutArgs>({
      async queryFn({ planId }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          const res = await createMockPaymentCallable({ planId });
          return { data: { paymentId: res.data.paymentId } };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Payment'],
    }),

    // mock checkout 완료. server가 payment 상태 + entitlement를 atomic 갱신한다.
    mockComplete: builder.mutation<MockCompleteResult, MockCompleteArgs>({
      async queryFn({ paymentId, success }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          const res = await completeMockPaymentCallable({ paymentId, success });
          return {
            data: { paymentId: res.data.paymentId, status: res.data.status },
          };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 결제 성공 시 entitlement가 바뀌고, 그에 따라 추천/일일 한도도 다시 평가되어야 한다.
      invalidatesTags: ['Payment', 'Entitlement', 'Recommendation'],
    }),

    // mock 구독 취소 → server가 entitlement를 free로 즉시 다운그레이드.
    cancelMockSubscription: builder.mutation<null, void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          await cancelMockSubscriptionCallable();
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Entitlement', 'Recommendation'],
    }),
  }),
});

export const {
  useGetMyPaymentsQuery,
  useMockCheckoutMutation,
  useMockCompleteMutation,
  useCancelMockSubscriptionMutation,
} = paymentApi;
