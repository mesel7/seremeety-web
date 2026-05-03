import type { LucideIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { FieldValue, Timestamp } from 'firebase/firestore';

export type Gender = '' | 'male' | 'female';
export type ProfileStatus = 0 | 1;
export type ProfileFieldId =
  | 'nickname'
  | 'birthdate'
  | 'gender'
  | 'mbti'
  | 'university'
  | 'place'
  | 'introduce';
export type ProfileFieldType = 'text' | 'date' | 'radio' | 'select' | 'textarea';
export type TimestampLike =
  | Date
  | Timestamp
  | {
      seconds: number;
    }
  | null
  | undefined;
export type FirestoreTimestampInput = TimestampLike | FieldValue;
export type ValidationResult = true | string;
export type ValidationRule = (value: string) => ValidationResult | Promise<ValidationResult>;
export type Nullable<T> = T | null;
export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type PlaceEntry = [string, string[]];

export interface MenuItemConfig {
  icon: LucideIcon;
  dataRoute: string;
  label: string;
}

export interface ProfileFormItem {
  field: string;
  type: ProfileFieldType;
  id: ProfileFieldId;
  options?: readonly string[] | readonly PlaceEntry[];
}

export interface UserProfile {
  uid?: string;
  age: string;
  birthdate: string;
  createdAt: TimestampLike;
  gender: Gender;
  introduce: string;
  mbti: string;
  nickname: string;
  phone: string;
  place: string;
  profilePictureUrl: string;
  profileStatus: ProfileStatus;
  university: string;
}

export interface ChatMessageRecord {
  id: string;
  sender: string;
  sentAt: TimestampLike;
  text: string;
}

export interface NewChatMessage {
  sender: string;
  sentAt: FirestoreTimestampInput;
  text: string;
}

export interface ChatRoomRecord {
  id: string;
  createdAt: TimestampLike;
  lastMessage: {
    sentAt: TimestampLike;
    text: string;
  };
  users: string[];
}

export interface NewChatRoom {
  createdAt: FirestoreTimestampInput;
  lastMessage: {
    sentAt: FirestoreTimestampInput;
    text: string;
  };
  users: string[];
}

export interface EnhancedChatRoom extends ChatRoomRecord {
  nickname: string;
  profilePictureUrl: string;
}

export interface ProfileStats {
  hasProfileImage: boolean;
  introLength: number;
  hasSelso: boolean;
  requestsReceived: number;
  profileRating: string;
}

export interface AuthSessionValue {
  currentUser: import('firebase/auth').User | null;
  isLoading: boolean;
}

export interface CropperModalProps {
  selectedImage: string;
  setCroppedImage: StateSetter<string | null>;
  setOpenCropper: StateSetter<boolean>;
  handleCropComplete: () => void;
}
