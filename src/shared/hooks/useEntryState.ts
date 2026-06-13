'use client';

import { useGetEntryStateQuery } from '@/shared/lib/api/entryStateApi';
import { useAppSelector } from '@/shared/lib/store/hooks';
import {
  selectAuthUid,
  selectIsAuthLoading,
} from '@/shared/lib/store/authSlice';
import type { UserEntryState } from '@/shared/lib/onboarding/resolveEntryRoute';

interface UseEntryStateResult {
  entryState: UserEntryState | null;
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
}

// Phase 3-A 후속: 본 hook은 entryStateApi의 wrapper.
// 외부 인터페이스(entryState/isLoading/isError/refresh)는 호출부 호환을 위해 유지.
//
// 다른 계정으로 로그아웃→재로그인 시 RTK Query 캐시는 이전 사용자의 EntryState 를
// 그대로 들고 있다 — refetch 트리거 후 새 응답 도착 전까지 stale data 노출. 그대로
// AuthEntryPage 가 resolveEntryRoute 돌리면 이전 사용자의 target 으로 잠깐 redirect →
// fresh data 도착 후 다시 redirect 하는 깜빡임. 이를 막기 위해 캐시된 data.user.id 가
// 현재 authUid 와 다르면 stale 로 간주하고 loading 으로 노출.
//
// 주의: 신규 가입 직후 data.user 는 null 일 수 있다 (bootstrap 전). 이 경우는 stale
// 이 아니라 정상 상태이므로 user 자체가 set 되어 있을 때만 mismatch 검사를 한다.
export function useEntryState(): UseEntryStateResult {
  const isAuthLoading = useAppSelector(selectIsAuthLoading);
  const uid = useAppSelector(selectAuthUid);
  const { data, isLoading, isError, refetch } = useGetEntryStateQuery(undefined, {
    skip: isAuthLoading,
  });

  const isStale = Boolean(uid) && Boolean(data?.user) && data?.user?.id !== uid;
  const effectiveData = isStale ? undefined : data;
  const effectiveLoading = isAuthLoading || isLoading || isStale;

  return {
    entryState: effectiveData ?? null,
    isLoading: effectiveLoading,
    isError,
    refresh: async () => {
      await refetch();
    },
  };
}
