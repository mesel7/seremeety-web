import { DEFAULT_PROFILE_PICTURE_URL, emptyUserProfile } from '@/shared/lib/constants';
import type {
  ChatMessageRecord,
  ChatRoomRecord,
  Gender,
  ProfileStatus,
  TimestampLike,
  UserProfile,
} from '@/shared/types/domain';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toGender = (value: unknown): Gender =>
  value === 'male' || value === 'female' ? value : '';

const toProfileStatus = (value: unknown): ProfileStatus => (value === 1 ? 1 : 0);

const toTimestampLike = (value: unknown): TimestampLike => {
  if (value instanceof Date) {
    return value;
  }

  if (isRecord(value) && typeof value.seconds === 'number') {
    return { seconds: value.seconds };
  }

  return null;
};

export const normalizeUserProfile = (value: unknown, uid?: string): UserProfile => {
  const data = isRecord(value) ? value : {};

  return {
    ...emptyUserProfile,
    uid,
    age: readString(data.age),
    birthdate: readString(data.birthdate),
    createdAt: toTimestampLike(data.createdAt),
    gender: toGender(data.gender),
    introduce: readString(data.introduce),
    mbti: readString(data.mbti),
    nickname: readString(data.nickname),
    phone: readString(data.phone),
    place: readString(data.place),
    profilePictureUrl: readString(data.profilePictureUrl) || DEFAULT_PROFILE_PICTURE_URL,
    profileStatus: toProfileStatus(data.profileStatus),
    university: readString(data.university),
  };
};

export const normalizeChatMessage = (value: unknown, id = ''): ChatMessageRecord => {
  const data = isRecord(value) ? value : {};

  return {
    id,
    sender: readString(data.sender),
    sentAt: toTimestampLike(data.sentAt),
    text: readString(data.text),
  };
};

export const normalizeChatRoom = (value: unknown, id = ''): ChatRoomRecord => {
  const data = isRecord(value) ? value : {};
  const lastMessage = isRecord(data.lastMessage) ? data.lastMessage : {};

  return {
    id,
    createdAt: toTimestampLike(data.createdAt),
    lastMessage: {
      sentAt: toTimestampLike(lastMessage.sentAt),
      text: readString(lastMessage.text),
    },
    users: readStringArray(data.users),
  };
};
