import type { TimestampLike } from '@/shared/types/domain';

export type Gender = 'male' | 'female';

export type ProfileStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'deleted';

export type SmokingHabit = 'yes' | 'no' | 'occasionally';

export type DrinkingHabit = 'none' | 'occasionally' | 'socially' | 'often';

export type DatingIntent = 'serious' | 'casual' | 'friendship' | 'unsure';

export interface Profile {
  id: string;
  userId: string;
  nickname: string;
  birthYear: number;
  // 생년월일 보강. age 계산을 만 나이 기준으로 정확히 하기 위해 month/day까지 받는다.
  // 신규 가입 사용자에게는 required, 기존 사용자(legacy)는 optional.
  birthMonth?: number;
  birthDay?: number;
  gender: Gender;
  // location은 시/도 (예: "서울"). locationDistrict는 시/구 (예: "강남구").
  location: string;
  locationDistrict?: string;
  height?: number;
  jobCategory?: string;
  educationLevel?: string;
  university?: string;
  mbti?: string;
  smoking?: SmokingHabit;
  drinking?: DrinkingHabit;
  religion?: string;
  datingIntent?: DatingIntent;
  bio: string;
  tags: string[];
  mainPhotoId?: string;
  status: ProfileStatus;
  rejectionReason?: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  submittedAt?: TimestampLike;
  reviewedAt?: TimestampLike;
  reviewedBy?: string;
}
