import { serverTimestamp } from 'firebase/firestore';
import { auth } from '@/firebase';
import { baseApi } from '@/shared/lib/api/baseApi';
import { errorWithCode, serializeError } from '@/shared/lib/api/serializeError';
import {
  createMessage,
  getChatRoomById,
  subscribeToChatRoomMessages,
  subscribeToChatRooms,
} from '@/shared/lib/firebase/chat';
import type {
  ChatMessageRecord,
  ChatRoomRecord,
} from '@/shared/types/domain';

interface SendMessageArgs {
  chatRoomId: string;
  text: string;
}

// chat_rooms / messages는 Firestore onSnapshot 구독을 사용한다. RTK Query에서는
// onCacheEntryAdded 훅으로 구독을 등록하고, cacheEntryRemoved 시 정리한다.
// queryFn은 빈 배열을 즉시 반환하고 이후 구독이 데이터를 push한다.
export const chatApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getChatRooms: builder.query<ChatRoomRecord[], void>({
      queryFn: () => ({ data: [] }),
      async onCacheEntryAdded(
        _arg,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        await cacheDataLoaded;
        const unsubscribe = subscribeToChatRooms((rooms) => {
          updateCachedData(() => rooms);
        });
        await cacheEntryRemoved;
        unsubscribe();
      },
      providesTags: ['Message'],
    }),

    getChatRoom: builder.query<ChatRoomRecord | null, string>({
      async queryFn(chatRoomId) {
        try {
          const data = await getChatRoomById(chatRoomId);
          return { data };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
    }),

    getChatRoomMessages: builder.query<ChatMessageRecord[], string>({
      queryFn: () => ({ data: [] }),
      async onCacheEntryAdded(
        chatRoomId,
        { updateCachedData, cacheDataLoaded, cacheEntryRemoved }
      ) {
        await cacheDataLoaded;
        const unsubscribe = subscribeToChatRoomMessages(chatRoomId, (msgs) => {
          updateCachedData(() => msgs);
        });
        await cacheEntryRemoved;
        unsubscribe();
      },
    }),

    // createMessage가 chat_rooms/{id}.lastMessage도 함께 갱신하므로
    // 별도 cache invalidation 없이 onSnapshot이 새 값을 push한다.
    sendMessage: builder.mutation<null, SendMessageArgs>({
      async queryFn({ chatRoomId, text }) {
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            return { error: errorWithCode('not_authenticated') };
          }
          await createMessage(chatRoomId, {
            sender: uid,
            sentAt: serverTimestamp(),
            text,
          });
          return { data: null };
        } catch (error) {
          return { error: serializeError(error) };
        }
      },
    }),
  }),
});

export const {
  useGetChatRoomsQuery,
  useGetChatRoomQuery,
  useGetChatRoomMessagesQuery,
  useSendMessageMutation,
} = chatApi;
