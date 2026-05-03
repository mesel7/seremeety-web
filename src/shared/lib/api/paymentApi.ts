import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import { getPlanDefinition } from '@/shared/lib/billing/plans';
import { setEntitlementPlan } from '@/shared/lib/firebase/entitlements';
import {
  completeMockPayment,
  createMockPayment,
  getPaymentsByUserId,
} from '@/shared/lib/firebase/payments';
import type { Payment, PaymentStatus, PlanId } from '@/shared/types/model/billing';

interface MockCheckoutArgs {
  planId: PlanId;
}

interface MockCompleteArgs {
  paymentId: string;
  planId: PlanId;
  success: boolean;
}

export interface MockCompleteResult {
  paymentId: string;
  status: PaymentStatus;
}

// TODO(Phase 3): mock checkout 본체와 webhook 처리는 Functions로 이동.
// 현재 client에서 payments 문서 + entitlement를 모두 갱신하므로 두 단계
// 사이에 실패가 생기면 결제만 success로 남고 plan은 free로 머무를 수 있다.
// 실제 PG 연동 시에는 Functions가 webhook을 받아 두 갱신을 atomically
// 수행해야 한다.
export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // 내 결제 내역 (최신순). 요금제 페이지 하단 "결제 내역" 섹션에 사용 예정.
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

    // mock checkout 시작. mock_pending payment 문서를 만들고 paymentId 반환.
    // UI는 paymentId를 들고 mockComplete으로 success/failure를 시뮬레이션한다.
    mockCheckout: builder.mutation<{ paymentId: string }, MockCheckoutArgs>({
      async queryFn({ planId }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          const plan = getPlanDefinition(planId);
          const paymentId = await createMockPayment({
            userId: uid,
            planId,
            amount: plan.priceKrw,
          });
          return { data: { paymentId } };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Payment'],
    }),

    // mock checkout 완료. success=true면 payment.status=mock_success +
    // entitlement.planId=premium 갱신. 실패면 status=mock_failed만 기록.
    mockComplete: builder.mutation<MockCompleteResult, MockCompleteArgs>({
      async queryFn({ paymentId, planId, success }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          const status = await completeMockPayment(paymentId, success);
          if (status === 'mock_success') {
            await setEntitlementPlan(uid, planId);
          }
          return { data: { paymentId, status } };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 결제 성공 시 entitlement가 바뀌고, 그에 따라 추천/일일 한도도 다시
      // 평가되어야 한다.
      invalidatesTags: ['Payment', 'Entitlement', 'Recommendation'],
    }),

    // mock 구독 취소. mock checkout이 entitlement bit를 premium으로 플립한 것의 역.
    // 즉시 free로 다운그레이드. 환불/만료 정책은 mock 범위 밖이라 별도 payment
    // 문서는 만들지 않고 entitlement만 갱신한다.
    // TODO(Phase 3): 실제 PG 연동 시 본 함수 위치에 환불 webhook + entitlement
    // 만료(expiresAt) 처리가 들어간다. 즉시 다운그레이드 vs 기간 만료 후
    // 다운그레이드는 그 시점에 정책 결정.
    cancelMockSubscription: builder.mutation<null, void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { error: errorWithCode('not_authenticated') };
          await setEntitlementPlan(uid, 'free');
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
