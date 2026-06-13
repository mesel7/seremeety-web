import { Timestamp } from 'firebase/firestore';
import { createChatRoom } from '@/shared/lib/firebase/chat';
import { updateUserDataByUid } from '@/shared/lib/firebase/users';
import type { Profile } from '@/shared/types/model/profile';
import type { UserProfile } from '@/shared/types/domain';

// Slice 2-C: 신규 도메인 모델을 메인으로 사용하되, 기존 페이지(MyProfilePage,
// MatchingPage, ProfilePage)가 그대로 동작하도록 old `users/{uid}` 문서에도
// 같은 데이터를 dual-write한다. 추후 기존 페이지가 신규 컬렉션으로
// 마이그레이션되면 이 어댑터는 폐기된다.

const computeAge = (birthYear: number): string => {
  if (!birthYear || birthYear <= 0) {
    return '';
  }
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  return age > 0 ? `${age}세` : '';
};

const toLegacyBirthdate = (birthYear: number): string => {
  if (!birthYear || birthYear <= 0) {
    return '';
  }
  return `${birthYear}-01-01`;
};

// 신규 Profile 필드를 old UserProfile 필드로 매핑.
export const writeProfileToLegacyUser = async (
  uid: string,
  profile: Pick<
    Profile,
    'nickname' | 'birthYear' | 'gender' | 'location' | 'bio' | 'mbti' | 'university'
  >
): Promise<void> => {
  const payload: Partial<UserProfile> = {
    nickname: profile.nickname,
    birthdate: toLegacyBirthdate(profile.birthYear),
    age: computeAge(profile.birthYear),
    gender: profile.gender,
    place: profile.location,
    introduce: profile.bio,
    mbti: profile.mbti ?? '',
    university: profile.university ?? '',
  };
  await updateUserDataByUid(uid, payload);
};

export const writePhotoToLegacyUser = async (
  uid: string,
  photoUrl: string
): Promise<void> => {
  await updateUserDataByUid(uid, { profilePictureUrl: photoUrl });
};

// 신규 ProfileStatus → old profileStatus (0|1) 매핑.
// approved → 1 (추천 노출), 그 외 → 0 (비공개)
export const writeProfileStatusToLegacyUser = async (
  uid: string,
  isApproved: boolean
): Promise<void> => {
  await updateUserDataByUid(uid, { profileStatus: isApproved ? 1 : 0 });
};

// Phase 5-A: Match가 생성되면 기존 chatRooms에도 같은 페어로 채팅방을 만들어
// ChatList/ChatRoom 페이지가 변경 없이 동작하도록 dual-write한다.
// Phase 6 RTK Query 마이그레이션 시 chat은 matches 기반으로 전환되며 폐기.
export const writeMatchToLegacyChatRoom = async (
  userA: string,
  userB: string
): Promise<string> => {
  const now = Timestamp.now();
  return createChatRoom({
    users: [userA, userB],
    createdAt: now,
    lastMessage: { text: '', sentAt: now },
  });
};
