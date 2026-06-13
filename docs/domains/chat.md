# 채팅 — seremeety-web

> 매칭이 성립된 두 사용자 간 1:1 실시간 텍스트 채팅. **Firestore `onSnapshot` 구독을 RTK Query `onCacheEntryAdded`로 래핑**해 채팅방 목록과 메시지를 실시간 갱신하고, **양방향 차단 가드**로 차단된 페어의 메시지 송신을 막는다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / RTK Query·Functions 경계
> - [`matching.md`](./matching.md) — 채팅방이 생성되는 매칭 성립 흐름
> - [`../data-model.md`](../data-model.md) — `chatRooms` / `matches` 컬렉션 정의

---

## 1. 개요

채팅은 매칭의 다음 단계다. 상호 좋아요로 매칭이 성립되면 서버(Functions `react` onCall)가 `matches/{id}`와 `chatRooms/{id}`를 **하나의 batch로 동시 생성**하고, 그 시점부터 두 사용자는 채팅방에서 텍스트 메시지를 주고받을 수 있다.

핵심 특징:

- **실시간 구독**: 채팅방 목록과 메시지 모두 Firestore `onSnapshot`으로 구독한다. RTK Query 쿼리는 빈 배열을 즉시 반환하고, `onCacheEntryAdded` 훅이 구독을 등록해 데이터를 캐시에 push한다. 별도 cache invalidation 없이 Firestore 변경이 곧바로 화면에 반영된다.
- **결정적 채팅방 ID**: `chatRoom` ID는 매칭 ID와 동일하다. `sortedPairId(userA, userB)` (= 정렬된 두 uid를 `_`로 join)로 페어마다 문서가 정확히 1개만 존재하므로, 매핑 테이블 없이 idempotent하게 관리된다.
- **차단 가드**: 채팅방 진입 시 양방향 차단 여부를 조회해, 차단 상태면 입력창을 숨기고 안내 문구를 표시한다.
- **범위 한정**: 텍스트 메시지 송수신·페이지네이션·날짜 구분선까지만 구현되어 있다. 읽음 상태, 타이핑 표시, 미디어 공유, 메시지 검색/삭제는 미구현이다(§6).

---

## 2. 핵심 흐름

### 채팅방 생성 (매칭 성립 시점, 서버)

```
상호 좋아요 감지 (Functions react onCall)
  → batch.set(matches/{matchDocId}, { users, reactions, active, createdAt })
  → batch.set(chatRooms/{matchDocId}, { users, createdAt, lastMessage: { text: '', sentAt } })
  → batch.commit()  // match + chatRoom 원자적 동시 생성
```

`chatRooms` 문서는 생성 즉시 `lastMessage = { text: '', sentAt: serverTimestamp() }`로 초기화된다. 이는 단순 placeholder가 아니라 **목록 쿼리에 필수**다 — 채팅방 목록은 `orderBy('lastMessage.sentAt', 'desc')`로 정렬하는데, Firestore의 `orderBy`는 해당 필드가 없는 문서를 결과에서 제외하기 때문에 빈 텍스트 + 생성 시각으로라도 채워 두어야 새 채팅방이 목록에 노출된다.

### 채팅 목록 (`ChatListPage`)

```
useGetChatRoomsQuery(undefined, { skip: !uid })
  → queryFn: { data: [] } 즉시 반환
  → onCacheEntryAdded: subscribeToChatRooms(...) 등록 (cacheEntryRemoved 시 unsubscribe)
  → Firestore 쿼리: chatRooms where users array-contains uid, orderBy lastMessage.sentAt desc
  → ChatListContent: Promise.all로 각 방의 상대 uid → getUserDataByUid 병렬 페치
  → EnhancedChatRoom (nickname / profilePictureUrl 추가) → ChatRoomItem 렌더
```

### 채팅방 (`ChatRoomPage`)

```
[chatRoomId] 추출
  → useGetChatRoomQuery(roomId)          // 채팅방 메타 1회 (users 배열)
  → useGetChatRoomMessagesQuery(roomId)  // 메시지 스트림 (onSnapshot)
  → effect: chatRoom.users에서 현재 uid 제외 → otherUid 결정 → getUserDataByUid 1회 (cancelled flag로 race 방지)
  → useIsChatBlockedQuery(otherUid)      // 양방향 차단 여부
  → isBlocked === true  → 입력창 숨김 + "차단된 사용자와는 메시지를 주고받을 수 없어요" 안내
  → chatRoom === null   → Modal "존재하지 않는 채팅방입니다" 후 router.back()
```

### 메시지 송수신

```
수신: subscribeToChatRoomMessages(roomId) → chatRooms/{id}/messages, orderBy sentAt asc → updateCachedData
전송: handleSendMessage → isBlocked면 early return
       → useSendMessageMutation → createMessage
         → addDoc(chatRooms/{id}/messages, { sender, sentAt: serverTimestamp(), text })
         → updateDoc(chatRooms/{id}, { lastMessage: { text, sentAt } })
       → onSnapshot이 새 메시지·lastMessage 변경을 자동으로 캐시에 반영
```

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [`ChatListPage.tsx`](../../src/features/chat/ChatListPage.tsx) | 채팅 목록 진입점. `useGetChatRoomsQuery`로 실시간 구독 |
| [`ChatRoomPage.tsx`](../../src/features/chat/ChatRoomPage.tsx) | 채팅방 진입점. 메시지 구독 + 차단 가드 + 메시지 전송 + 존재하지 않는 방 처리 |
| [`ChatListContent.tsx`](../../src/features/chat/components/chat-list/ChatListContent.tsx) | 채팅방 목록 렌더. `Promise.all`로 상대 프로필 강화(enhance) |
| [`ChatRoomItem.tsx`](../../src/features/chat/components/chat-list/ChatRoomItem.tsx) | 채팅방 항목. 마지막 메시지 + 타임스탬프 |
| [`ChatRoomContent.tsx`](../../src/features/chat/components/chat-room/ChatRoomContent.tsx) | 메시지 목록 렌더. 페이지네이션(`visibleCount`) + 날짜 구분선 + 자동 스크롤 |
| [`ChatMessage.tsx`](../../src/features/chat/components/chat-room/ChatMessage.tsx) | 개별 메시지. `isMyMsg`로 좌/우 배치 + 상대 프로필 링크(`viewOnly`) |
| [`ChatRoomInput.tsx`](../../src/features/chat/components/chat-room/ChatRoomInput.tsx) | 메시지 입력 UI. 공백만 입력 시 송신 차단 |
| [`chat.ts`](../../src/shared/lib/firebase/chat.ts) | Firestore 채팅 헬퍼. `subscribeToChatRooms` / `subscribeToChatRoomMessages` / `createMessage` / `getChatRoomById` |
| [`chatApi.ts`](../../src/shared/lib/api/chatApi.ts) | RTK Query 채팅 슬라이스. `onCacheEntryAdded` 구독 래핑 + `sendMessage` 뮤테이션 |
| [`blockApi.ts`](../../src/shared/lib/api/blockApi.ts) | 차단 API. `isChatBlocked` 쿼리로 송신 가드 |
| [`blocks.ts`](../../src/shared/lib/firebase/blocks.ts) | 차단 Firestore 헬퍼. `isBlockedBetween` 양방향 검증 |
| [`normalizers.ts`](../../src/shared/lib/firebase/normalizers.ts) | `normalizeChatRoom` / `normalizeChatMessage` — Firestore doc → 타입 안전 변환 |
| [`domain.ts`](../../src/shared/types/domain.ts) | `ChatRoomRecord` / `ChatMessageRecord` / `EnhancedChatRoom` / `NewChatRoom` / `NewChatMessage` |
| [`react.ts`](../../functions/src/reactions/react.ts) | 서버 매칭 함수. `matches` + `chatRooms` batch 동시 생성 |
| [`chat-list/page.tsx`](<../../src/app/(authenticated)/(bottom-nav)/chat-list/page.tsx>) | 채팅 목록 라우트 (라우트 그룹 `(bottom-nav)`) |
| [`chat-room/[chatRoomId]/page.tsx`](<../../src/app/(authenticated)/(detail)/chat-room/[chatRoomId]/page.tsx>) | 채팅방 동적 라우트 |

---

## 4. 데이터·상태

### Firestore 구조

```
chatRooms/{matchDocId}                      ← ID = sortedPairId(uidA, uidB)
  users: [uidA, uidB]
  createdAt: Timestamp
  lastMessage: { text: string, sentAt: Timestamp }   ← 목록 정렬 키 (denormalize)
  messages/{messageId}                       ← subcollection
    sender: uid
    sentAt: Timestamp
    text: string
```

- **메시지는 subcollection**: `chatRooms/{id}/messages`. 설계 초안(`DATA_MODEL.md`)에 등장하는 top-level `messages` 컬렉션은 채택되지 않았다.
- **`lastMessage` denormalize**: 목록을 `lastMessage.sentAt`으로 정렬하기 위해 마지막 메시지를 방 문서에 복제한다. `createMessage`가 `addDoc`과 `updateDoc(lastMessage)`를 함께 수행한다.

### 타입

| 타입 | 필드 |
|---|---|
| `ChatRoomRecord` | `id`, `users[]`, `createdAt`, `lastMessage { sentAt, text }` |
| `ChatMessageRecord` | `id`, `sender`(uid), `sentAt`, `text` |
| `EnhancedChatRoom` | `ChatRoomRecord` + `nickname`, `profilePictureUrl` (클라이언트 강화) |

### RTK Query 엔드포인트 (`chatApi`)

| 엔드포인트 | 방식 | 비고 |
|---|---|---|
| `getChatRooms` | `onCacheEntryAdded` 구독 | `providesTags: ['Message']`, 빈 배열 즉시 반환 후 push |
| `getChatRoom` | 일반 `queryFn` | 방 메타 1회 조회, `null`이면 존재하지 않는 방 |
| `getChatRoomMessages` | `onCacheEntryAdded` 구독 | `orderBy sentAt asc` 메시지 스트림 |
| `sendMessage` | 뮤테이션 | `auth.currentUser` 검증 → `createMessage` |

`blockApi`의 `isChatBlocked` 쿼리는 `otherUserId`를 받아 `isBlockedBetween(uid, otherUserId)`를 호출한다. `isBlockedBetween`은 `(uid→otherUserId)`와 `(otherUserId→uid)` 두 방향을 각각 조회(`blocks/{blocker}_{blocked}` 결정적 doc ID)해 한쪽이라도 차단했으면 `true`를 반환한다. 캐시는 태그(`Block`, `between_{otherUserId}`)로 무효화된다.

### 클라이언트 상태 (`ChatRoomContent`)

- `visibleCount` (초기 20): `slice(-visibleCount)`로 최근 N개만 렌더.
- `isFirstLoad`: 최초 로드 시 `setTimeout(window.scrollTo bottom, 100ms)`로 맨 아래 정렬.
- `inView`(`useInView`) 감지 시 맨 위 도달 → `visibleCount += 20`, 직전 `scrollHeight`를 기록해 `requestAnimationFrame`에서 `scrollBy`로 스크롤 위치 보존.

---

## 5. 설계 결정과 트레이드오프

**Firestore `onSnapshot`을 RTK Query `onCacheEntryAdded`로 래핑**
구독 라이프사이클(mount→subscribe, unmount→unsubscribe)을 RTK Query 캐시에 묶어 중앙에서 관리한다. 컴포넌트마다 `useEffect`로 구독을 관리할 때 생기는 중복 fetch·메모리 누수를 줄인다. 대가로, 초기 `queryFn`이 빈 배열을 즉시 반환하므로 `isLoading`이 곧바로 끝난다 — 구독 데이터가 도착하기 전 "비어 있음"이 잠깐 보일 수 있어, 스켈레톤보다는 명시적 `isLoading`/`isSuccess` 체크가 필요하다.

**채팅방 ID = 매칭 ID (결정적 키)**
`chatRoom` ID와 `match` ID가 모두 `sortedPairId(uidA, uidB)`로 동일해, 매핑 테이블 없이 페어를 유일하게 식별한다. 생성이 idempotent하므로 중복 방이 생기지 않는다. 다만 현재는 `matches`와 `chatRooms`가 별도 컬렉션으로 dual-write되어 동기화 책임이 남는다 — 향후 `matches` 단일 소스로 정리되면 `chatRooms`는 폐기 대상이다.

**`match` + `chatRoom`을 서버에서 batch로 동시 생성**
양쪽이 모두 좋아요해 매칭이 성립하는 순간에만, Functions `react.ts`가 `batch.set` 2건 + `commit`으로 두 문서를 원자적으로 쓴다. 한쪽만 생성되어 "매칭은 있는데 채팅방이 없는" 불일치를 방지한다. 클라이언트 `legacyBridge.writeMatchToLegacyChatRoom`은 동일 목적의 헬퍼지만 현재 호출처가 없어 실질적으로 서버 batch가 단일 경로다.

**채팅 목록 상대 프로필 강화는 클라이언트 `Promise.all` 병렬 페치**
Firestore는 join을 지원하지 않으므로, 각 방의 상대 uid를 뽑아 `getUserDataByUid`를 병렬 호출해 `nickname`/`profilePictureUrl`을 붙인다. 방이 N개면 read가 N회 늘지만 `users/{uid}` 문서가 작아 비용 부담은 낮다. denormalize 대신 매번 페치를 택한 이유는 `users`의 변경 빈도가 높아 복제 시 일관성 비용이 더 크기 때문이다.

**양방향 차단을 `Promise.all` 단순 쿼리 2건으로 확인**
복합 인덱스(AND) 대신 `(a→b)`/`(b→a)` 두 단순 쿼리를 병렬 실행한다. read는 2회지만 성능은 사실상 동일하고 인덱스 관리가 단순하다. 규모가 커지면 차단 문서에 양방향 sync 필드를 두는 방식을 고려할 수 있다.

**메시지 페이지네이션: `visibleCount` + `slice(-visibleCount)` + `inView`**
위로 스크롤해 맨 위 요소가 보이면 20개씩 더 렌더하고, 직전 높이를 기록해 스크롤 위치를 보존한다. 구현이 단순한 대신 초기 fetch는 방의 **전체 메시지**를 받아 온다 — 메시지가 수천 개면 초기 로드가 무거워진다. 향후 cursor 기반 또는 Firestore `limit(N)`으로 전환 여지가 있다.

---

## 6. 현재 상태

### 구현됨

- Firestore `onSnapshot` 실시간 구독 (RTK Query `onCacheEntryAdded` 래핑) — 채팅방 목록 / 메시지
- 텍스트 메시지 양방향 송수신 (`createMessage` + `lastMessage` 동시 갱신)
- 채팅방 목록 정렬 (`lastMessage.sentAt` desc) / 메시지 정렬 (`sentAt` asc)
- 상대 프로필 강화 (`nickname` / `profilePictureUrl` 병렬 페치)
- 양방향 차단 가드 (`isChatBlocked` → 차단 시 입력창 숨김 + 안내)
- 메시지 페이지네이션 (`visibleCount` + `slice`) + 스크롤 위치 보존
- 날짜 구분선 렌더링, 초기/추가 시 자동 스크롤
- 공백만 입력 시 송신 차단, 존재하지 않는 채팅방 모달 처리
- 타입 정규화 (`normalizeChatRoom` / `normalizeChatMessage`)

### 남은 작업 (미구현)

- 메시지 검색 — `ChatRoomHeader`의 Search 버튼은 UI만 존재
- 채팅 메뉴 — `ChatRoomHeader`의 Menu 버튼은 UI만 존재
- 메시지 삭제/수정, 채팅방 삭제 UI
- 읽음 상태(read receipts), 타이핑 중 표시
- 멀티미디어(이미지/파일) 공유 — 현재 텍스트만
- 메시지 신고/차단 옵션 (채팅방 내)
- cursor 기반 pagination (현재 offset 방식) 및 검색 인덱스
- 그룹 채팅 (현재 1:1 전용)

### 알려진 위험

- **`createMessage`가 비원자적**: `addDoc`(메시지) + `updateDoc`(`lastMessage`)이 분리되어 있어, message는 들어갔지만 `lastMessage` 갱신이 실패하면 목록에 빈/오래된 메시지가 표시될 수 있다. 메시지 삭제 시 `lastMessage` 복구 로직도 없다 (Functions 이전 검토 대상).
- **초기 메시지 일괄 fetch**: 방의 모든 메시지를 받아 오므로 메시지가 수천 개면 메모리·렌더링 부담이 커진다.
- **차단 상태 반영 지연 가능**: `isChatBlocked`는 태그 무효화에 의존하므로, 상대가 막 차단한 직후 캐시가 갱신되기 전 짧은 창이 있을 수 있다. 차단 직전 작성 중이던 메시지는 버튼 비활성화로만 막혀 손실될 수 있다.
- **상대 프로필 페치 실패 처리 미흡**: `ChatRoomPage`는 `otherUserData`가 `null`이면 `isContentLoading`이 계속 `true`라 영구 로딩에 빠질 수 있고, `ChatListContent`는 프로필 페치에 실패한 방을 강화 목록에서 제외해 일부 방이 목록에서 사라질 수 있다(빈 상태 판정은 원본 `chatRooms.length` 기준이라 불일치 가능).
- **전송 실패 무알림**: `sendMessage` 실패 시 `console.error`만 하고 사용자에게 토스트/알림이 없다.
- **dual-write 동기화 부담**: `matches`/`chatRooms`가 별도 컬렉션이라, 한쪽 정리/마이그레이션 시 일관성 유지에 주의가 필요하다.
