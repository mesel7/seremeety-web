import { baseApi } from '@/shared/lib/api/baseApi';
import { serializeError } from '@/shared/lib/api/serializeError';
import { getProfilePhotosByUserId } from '@/shared/lib/firebase/profilePhotos';
import type { ProfilePhoto } from '@/shared/types/model/photo';

// 사진 mutation(create/setMain/delete)은 ProfilePhotosManager가 자체적으로
// 캐시 + dual-write를 관리하므로 본 api는 read 전용. 컴포넌트가 mutation 후
// `Photo` 태그를 명시적으로 invalidate해 다른 소비자(MyProfilePreview 완성도 계산,
// ProfilePage 추가 사진 표시)가 새 데이터를 받도록 한다.
export const photoApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfilePhotos: builder.query<ProfilePhoto[], string>({
      async queryFn(userId) {
        try {
          const data = await getProfilePhotosByUserId(userId);
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: (_r, _e, userId) => [{ type: 'Photo', id: userId }],
      // 사진은 자주 바뀌지 않음. mutation 시 invalidate되므로 길게 캐싱.
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useGetProfilePhotosQuery } = photoApi;
