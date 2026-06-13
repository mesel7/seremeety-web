import { Heart, MessageCircle, Sparkles, UserRound } from 'lucide-react';
import { placeList } from '@/shared/data/places';
import { universityList } from '@/shared/data/universities';
import type {
  MenuItemConfig,
  ProfileFormItem,
  UserProfile,
} from '@/shared/types/domain';

export const DEFAULT_PROFILE_PICTURE_URL =
  'https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/img_default_profile.png?alt=media&token=d11a843f-1611-4f8f-be26-c7438842fd29';

export const emptyUserProfile: UserProfile = {
  age: '',
  birthdate: '',
  createdAt: null,
  gender: '',
  introduce: '',
  mbti: '',
  nickname: '',
  phone: '',
  place: '',
  profilePictureUrl: DEFAULT_PROFILE_PICTURE_URL,
  profileStatus: 0,
  university: '',
};

export const menuItems: MenuItemConfig[] = [
  {
    icon: Heart,
    dataRoute: '/matching',
    label: 'DISCOVER',
  },
  {
    icon: Sparkles,
    dataRoute: '/likes',
    label: 'LIKES',
  },
  {
    icon: MessageCircle,
    dataRoute: '/chat-list',
    label: 'CHATS',
  },
  {
    icon: UserRound,
    dataRoute: '/mypage',
    label: 'MYPAGE',
  },
];

export const myProfileForm: ProfileFormItem[] = [
  {
    field: '닉네임',
    type: 'text',
    id: 'nickname',
  },
  {
    field: '나이',
    type: 'date',
    id: 'birthdate',
  },
  {
    field: '성별',
    type: 'radio',
    id: 'gender',
    options: ['male', 'female'],
  },
  {
    field: 'MBTI',
    type: 'select',
    id: 'mbti',
    options: [
      'ISTJ',
      'ISFJ',
      'INFJ',
      'INTJ',
      'ISTP',
      'ISFP',
      'INFP',
      'INTP',
      'ESTP',
      'ESFP',
      'ENFP',
      'ENTP',
      'ESTJ',
      'ESFJ',
      'ENFJ',
      'ENTJ',
    ],
  },
  {
    field: '학교',
    type: 'select',
    id: 'university',
    options: universityList,
  },
  {
    field: '지역',
    type: 'select',
    id: 'place',
    options: placeList,
  },
  {
    field: '자기소개',
    type: 'textarea',
    id: 'introduce',
  },
];

