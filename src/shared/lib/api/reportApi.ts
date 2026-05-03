import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import { createReport } from '@/shared/lib/firebase/reports';
import type { ReportTargetType } from '@/shared/types/model/safety';

interface ReportArgs {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reason: string;
  description?: string;
}

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createReport: builder.mutation<null, ReportArgs>({
      async queryFn(args) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await createReport(uid, args);
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Report'],
    }),
  }),
});

export const { useCreateReportMutation } = reportApi;
