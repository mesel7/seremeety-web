import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { normalizeChatMessage, normalizeChatRoom } from '@/shared/lib/firebase/normalizers';
import type { ChatMessageRecord, ChatRoomRecord, NewChatMessage, NewChatRoom } from '@/shared/types/domain';

export const subscribeToChatRooms = (
  onChatRoomsChange: (chatRooms: ChatRoomRecord[]) => void,
  onSubscribed?: () => void
): (() => void) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    onSubscribed?.();
    return () => undefined;
  }

  const chatRoomRef = collection(db, 'chatRooms');
  const q = query(
    chatRoomRef,
    where('users', 'array-contains', currentUid),
    orderBy('lastMessage.sentAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const chatRooms = snapshot.docs.map((chatRoomDoc) =>
      normalizeChatRoom(chatRoomDoc.data(), chatRoomDoc.id)
    );

    onChatRoomsChange(chatRooms);
    onSubscribed?.();
  });
};

export const createChatRoom = async (newChatRoom: NewChatRoom): Promise<string> => {
  const chatRoomsRef = collection(db, 'chatRooms');
  const docRef = await addDoc(chatRoomsRef, newChatRoom);
  return docRef.id;
};

export const getChatRoomById = async (chatRoomId: string): Promise<ChatRoomRecord | null> => {
  const docRef = doc(db, 'chatRooms', chatRoomId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return normalizeChatRoom(docSnap.data(), docSnap.id);
};

export const subscribeToChatRoomMessages = (
  chatRoomId: string,
  onMessagesChange: (messages: ChatMessageRecord[]) => void
): (() => void) => {
  const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');

  return onSnapshot(query(messagesRef, orderBy('sentAt', 'asc')), (snapshot) => {
    const messages = snapshot.docs.map((messageDoc) =>
      normalizeChatMessage(messageDoc.data(), messageDoc.id)
    );

    onMessagesChange(messages);
  });
};

export const createMessage = async (
  chatRoomId: string,
  newMessageData: NewChatMessage
): Promise<void> => {
  await addDoc(collection(db, 'chatRooms', chatRoomId, 'messages'), newMessageData);

  const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
  await updateDoc(chatRoomRef, {
    lastMessage: { text: newMessageData.text, sentAt: newMessageData.sentAt },
  });
};
