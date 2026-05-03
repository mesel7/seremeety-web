import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import {
  compressImage,
  dataURLToFile,
  uploadImageToStorage,
} from '@/shared/lib/media';
import {
  getUserDataByUid,
  updateUserDataByUid,
} from '@/shared/lib/firebase/users';
import type { UserProfile } from '@/shared/types/domain';

// ROADMAP Phase 6 / 옵션 A: queryFn에서 firebase 헬퍼를 직접 호출.
// Phase 3 도입 시 본 파일의 queryFn 본체만 Functions 호출로 교체한다.
export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMe: builder.query<UserProfile | null, void>({
      async queryFn() {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { data: null };
          }
          const data = await getUserDataByUid(uid);
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Me'],
      // 마이페이지/매칭 등 자주 진입하는 화면이지만 mutation 시 invalidate되므로
      // unused 캐시는 길게 유지. 신선도가 중요한 호출자(MyProfilePage 등)는
      // 훅 호출 시 `refetchOnMountOrArgChange: 30`을 직접 지정한다.
      keepUnusedDataFor: 120,
    }),

    getPublicProfile: builder.query<UserProfile | null, string>({
      async queryFn(uid) {
        try {
          const data = await getUserDataByUid(uid);
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: (_result, _error, uid) => [{ type: 'Profile', id: uid }],
      // 다른 사용자 프로필은 자주 안 바뀜.
      keepUnusedDataFor: 300,
    }),

    // 프로필 데이터 업데이트. profilePictureUrl이 'data:'로 시작하면 압축/업로드 후 URL 교체.
    // coin 갱신처럼 이미지가 무관한 호출도 동일 mutation으로 처리.
    updateMe: builder.mutation<null, Partial<UserProfile>>({
      async queryFn(payload) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { error: errorWithCode('not_authenticated') };
          }

          const next: Partial<UserProfile> = { ...payload };
          if (next.profilePictureUrl?.startsWith('data:')) {
            const file = dataURLToFile(next.profilePictureUrl, 'profile_picture.jpg');
            const compressed = await compressImage(file);
            next.profilePictureUrl = await uploadImageToStorage(compressed, uid);
          }

          await updateUserDataByUid(uid, next);
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 프로필 저장 시 (특히 처음 저장으로 profileStatus 0→1 전환 시) 추천 후보가 새로
      // 노출돼야 하므로 Recommendation 캐시도 무효화한다.
      invalidatesTags: ['Me', 'Recommendation'],
    }),
  }),
});

export const {
  useGetMeQuery,
  useGetPublicProfileQuery,
  useUpdateMeMutation,
} = profileApi;
