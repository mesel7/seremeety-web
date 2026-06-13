import { Timestamp } from 'firebase/firestore';
import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import { setEntitlementPlan } from '@/shared/lib/firebase/entitlements';
import { writeProfileStatusToLegacyUser } from '@/shared/lib/firebase/legacyBridge';
import {
  approvePendingPhotosForUser,
  getPhotosByStatus,
  getProfilePhotosByUserId,
  updateProfilePhoto,
} from '@/shared/lib/firebase/profilePhotos';
import {
  getProfileByUserId,
  getProfilesByStatus,
  updateProfile,
} from '@/shared/lib/firebase/profiles';
import {
  getReportsByStatus,
  reviewReport,
} from '@/shared/lib/firebase/reports';
import {
  getUserV2ByUid,
  getUsersByStatus,
  setOnboardingStatus,
  setUserRole as setUserRoleHelper,
  setUserStatus,
} from '@/shared/lib/firebase/usersV2';
import type { PlanId } from '@/shared/types/model/billing';
import type { ProfilePhoto } from '@/shared/types/model/photo';
import type { Profile } from '@/shared/types/model/profile';
import type { Report } from '@/shared/types/model/safety';
import type { User, UserStatus } from '@/shared/types/model/user';

interface ProfileReviewArgs {
  profileId: string;
  userId: string;
  reason?: string;
}

// 통합 검수 큐의 단일 항목. 한 사용자에 대한 프로필 + 그 사용자의 모든 사진.
// 검수 대기 사유는 다음 중 하나:
//  - profile.status === 'pending' (신규 가입자 또는 반려 후 재제출)
//  - photos 중 일부가 status === 'pending' (이미 승인된 사용자가 사진 추가/교체)
export interface ReviewQueueItem {
  profile: Profile;
  photos: ProfilePhoto[];
  hasPendingProfile: boolean;
  hasPendingPhotos: boolean;
}

interface PhotoReviewArgs {
  photoId: string;
  reason?: string;
}

interface ReportReviewArgs {
  reportId: string;
  resolutionNote?: string;
}

interface SetUserStatusArgs {
  uid: string;
  status: UserStatus;
}

interface SetUserPlanArgs {
  uid: string;
  planId: PlanId;
}

interface SetUserRoleArgs {
  uid: string;
  role: 'admin' | 'user';
}

// TODO(Phase 3): Functions로 이동. role 검증은 서버 측이 정석. 현재는 클라이언트에서
// role==='admin' 체크 + Firestore Security Rules 보강이 임시 방어선이다.
export const adminApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    getPendingProfiles: builder.query<Profile[], void>({
      async queryFn() {
        try {
          const data = await getProfilesByStatus('pending');
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['AdminReview'],
    }),

    getPendingPhotos: builder.query<ProfilePhoto[], void>({
      async queryFn() {
        try {
          const data = await getPhotosByStatus('pending');
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['AdminReview'],
    }),

    // 통합 검수 큐: pending 프로필 + 사진 보유 사용자들을 사용자 단위로 묶는다.
    // 페이지에서 한 카드에 프로필 정보 + 모든 사진을 함께 보여주기 위해 사용.
    getReviewQueue: builder.query<ReviewQueueItem[], void>({
      async queryFn() {
        try {
          const [pendingProfiles, pendingPhotos] = await Promise.all([
            getProfilesByStatus('pending'),
            getPhotosByStatus('pending'),
          ]);
          const userIds = new Set<string>();
          pendingProfiles.forEach((p) => userIds.add(p.userId));
          pendingPhotos.forEach((p) => userIds.add(p.userId));

          // 각 user에 대해 user / 프로필 / 사진을 병렬로 가져옴.
          // role==='admin' 사용자는 큐에서 제외 — admin 은 운영자라 검수 대상이 아님.
          const items = await Promise.all(
            Array.from(userIds).map(async (uid) => {
              const [user, profile, photos] = await Promise.all([
                getUserV2ByUid(uid),
                getProfileByUserId(uid),
                getProfilePhotosByUserId(uid),
              ]);
              if (!profile) return null;
              if (user?.role === 'admin') return null;
              const hasPendingProfile = profile.status === 'pending';
              const hasPendingPhotos = photos.some((p) => p.status === 'pending');
              if (!hasPendingProfile && !hasPendingPhotos) return null;
              return {
                profile,
                photos,
                hasPendingProfile,
                hasPendingPhotos,
              } satisfies ReviewQueueItem;
            })
          );
          return {
            data: items.filter((item): item is ReviewQueueItem => item !== null),
          };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['AdminReview'],
    }),

    // 프로필 + 그 사용자의 pending 사진 일괄 승인.
    // - profile.status -> 'approved'
    // - 사용자의 모든 pending 사진 -> 'approved'
    // - users.profileStatus = 1, onboardingStatus = 'approved'
    // 사진만 pending이고 프로필이 이미 'approved'인 경우(추가 사진 검수)는 사진만 처리.
    approveProfile: builder.mutation<null, ProfileReviewArgs>({
      async queryFn({ profileId, userId }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          // 1) 프로필이 pending 일 때만 status/onboardingStatus 전이.
          //    이미 approved 상태에서 신규 사진만 검수받는 경우는 건너뜀.
          const profile = await getProfileByUserId(userId);
          const profileWasPending = profile?.status === 'pending';
          if (profileWasPending) {
            await updateProfile(profileId, {
              status: 'approved',
              reviewedAt: Timestamp.now(),
              reviewedBy: reviewerUid,
            });
          }
          // 2) pending 사진 일괄 승인.
          await approvePendingPhotosForUser(userId, reviewerUid);
          // 3) 사용자 진입 라우트 + 추천 노출.
          if (profileWasPending) {
            await writeProfileStatusToLegacyUser(userId, true);
            await setOnboardingStatus(userId, 'approved');
          }
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['AdminReview', 'Profile', 'Photo', 'Me'],
    }),

    // 프로필 + 사용자 단위 반려.
    // - profile.rejectionReason 에 사유 기록 (reason 빈 값이어도 placeholder)
    // - 프로필이 pending 이면 status -> 'rejected'. 이미 approved 인 사용자(사진 추가
    //   검수 케이스)는 status='approved' 유지하고 onboardingStatus만 review_rejected
    //   로 전이해 사용자에게 RejectedPage 노출.
    // - users.profileStatus = 0, onboardingStatus = 'review_rejected'
    rejectProfile: builder.mutation<null, ProfileReviewArgs>({
      async queryFn({ profileId, userId, reason }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          const profile = await getProfileByUserId(userId);
          const profileWasPending = profile?.status === 'pending';
          await updateProfile(profileId, {
            ...(profileWasPending ? { status: 'rejected' } : {}),
            rejectionReason: reason ?? '',
            reviewedAt: Timestamp.now(),
            reviewedBy: reviewerUid,
          });
          await writeProfileStatusToLegacyUser(userId, false);
          await setOnboardingStatus(userId, 'review_rejected');
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['AdminReview', 'Profile', 'Me'],
    }),

    approvePhoto: builder.mutation<null, PhotoReviewArgs>({
      async queryFn({ photoId }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await updateProfilePhoto(photoId, {
            status: 'approved',
            reviewedAt: Timestamp.now(),
            reviewedBy: reviewerUid,
          });
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['AdminReview', 'Photo'],
    }),

    rejectPhoto: builder.mutation<null, PhotoReviewArgs>({
      async queryFn({ photoId, reason }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await updateProfilePhoto(photoId, {
            status: 'rejected',
            rejectionReason: reason ?? '',
            reviewedAt: Timestamp.now(),
            reviewedBy: reviewerUid,
            // 반려된 사진은 메인이 될 수 없도록 isMain 해제.
            isMain: false,
          });
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['AdminReview', 'Photo'],
    }),

    getOpenReports: builder.query<Report[], void>({
      async queryFn() {
        try {
          const data = await getReportsByStatus('open');
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['Report'],
    }),

    resolveReport: builder.mutation<null, ReportReviewArgs>({
      async queryFn({ reportId, resolutionNote }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await reviewReport(reportId, {
            status: 'resolved',
            reviewedBy: reviewerUid,
            resolutionNote,
          });
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Report'],
    }),

    dismissReport: builder.mutation<null, ReportReviewArgs>({
      async queryFn({ reportId, resolutionNote }) {
        try {
          const reviewerUid = auth.currentUser?.uid;
          if (!reviewerUid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await reviewReport(reportId, {
            status: 'dismissed',
            reviewedBy: reviewerUid,
            resolutionNote,
          });
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['Report'],
    }),

    getSuspendedUsers: builder.query<User[], void>({
      async queryFn() {
        try {
          const data = await getUsersByStatus('suspended');
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      providesTags: ['AdminReview'],
    }),

    // 사용자 정지/복구. 정지 시 legacy users.profileStatus도 0으로 dual-write해
    // 추천 후보에서 즉시 제외되도록 한다. 복구 시 사용자가 매칭에 다시 노출되려면
    // 본인이 마이페이지에서 저장하거나 admin이 별도로 profileStatus=1 처리해야 함.
    setUserStatus: builder.mutation<null, SetUserStatusArgs>({
      async queryFn({ uid, status }) {
        try {
          await setUserStatus(uid, status);
          if (status !== 'active') {
            await writeProfileStatusToLegacyUser(uid, false);
          }
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      invalidatesTags: ['AdminReview', 'Recommendation'],
    }),

    // 운영자 권한 부여/회수. 최초 admin 은 functions/scripts/grant-admin.mjs CLI 로
    // seed 한 후, 이후의 admin 추가/제거는 이 mutation 으로 처리.
    setUserRole: builder.mutation<null, SetUserRoleArgs>({
      async queryFn({ uid, role }) {
        try {
          await setUserRoleHelper(uid, role);
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 본인 세션의 user 캐시는 영향 없지만, 본인을 대상으로 권한을 바꿨을 때
      // 진입 라우트가 달라지므로 EntryState 도 무효화.
      invalidatesTags: ['AdminReview', 'EntryState'],
    }),

    // 운영자 강제 플랜 변경. 결제 흐름을 거치지 않고 entitlement만 갱신한다.
    // payments 문서는 만들지 않으며(결제 기록이 아니라 운영자 조정), 대상 사용자가
    // 다음 entitlement 페치 시 새 plan을 가져간다.
    setUserPlan: builder.mutation<null, SetUserPlanArgs>({
      async queryFn({ uid, planId }) {
        try {
          await setEntitlementPlan(uid, planId);
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
      // 본인 세션의 admin 캐시는 직접 영향이 없지만, 같은 세션에서 자기 자신의
      // plan을 바꿨을 때를 대비해 Entitlement도 무효화.
      invalidatesTags: ['Entitlement', 'Recommendation'],
    }),
  }),
});

export const {
  useGetPendingProfilesQuery,
  useGetPendingPhotosQuery,
  useGetReviewQueueQuery,
  useApproveProfileMutation,
  useRejectProfileMutation,
  useApprovePhotoMutation,
  useRejectPhotoMutation,
  useGetOpenReportsQuery,
  useResolveReportMutation,
  useDismissReportMutation,
  useGetSuspendedUsersQuery,
  useSetUserStatusMutation,
  useSetUserPlanMutation,
  useSetUserRoleMutation,
} = adminApi;
