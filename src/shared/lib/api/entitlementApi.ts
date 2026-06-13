import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { serializeError } from '@/shared/lib/api/serializeError';
import { getEntitlementByUserId } from '@/shared/lib/firebase/entitlements';
import type { Entitlement } from '@/shared/types/model/billing';

export const entitlementApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    // 내 entitlement(현재 plan + 일일 한도). 요금제 페이지 / 한도 안내에 사용.
    // 결제 완료 시 paymentApi.mockComplete가 'Entitlement' 태그를 무효화한다.
    getMyEntitlement: builder.query<Entitlement | null, void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) return { data: null };
          const entitlement = await getEntitlementByUserId(uid);
          return { data: entitlement };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Entitlement'],
      keepUnusedDataFor: 120,
    }),
  }),
});

export const { useGetMyEntitlementQuery } = entitlementApi;
