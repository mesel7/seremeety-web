import type { SerializedError } from '@reduxjs/toolkit';
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

// ROADMAP Phase 6: 모든 도메인 API slice는 baseApi.injectEndpoints로 확장한다.
// 옵션 A — Phase 3(Functions) 도입 전까지 queryFn은 src/shared/lib/firebase/* 헬퍼를
// 직접 호출하고, 추후 Functions 이전 시 queryFn 본체만 교체하면 컴포넌트는 그대로 둔다.
// queryFn이 반환하는 error는 plain serializable object여야 한다. catch에서는
// `serializeError(error)` 헬퍼를, 사전 검증 실패는 `errorWithCode('not_authenticated')`
// 같은 형태로 변환한 뒤 반환할 것 (`./serializeError.ts`).
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<SerializedError>(),
  tagTypes: [
    'Me',
    'EntryState',
    'Onboarding',
    'Profile',
    'Preference',
    'Photo',
    'Recommendation',
    'Reaction',
    'SentLikes',
    'ReceivedLikes',
    'Match',
    'Message',
    'Block',
    'Report',
    'IdentityVerification',
    'Entitlement',
    'Payment',
    'AdminReview',
  ],
  endpoints: () => ({}),
});
