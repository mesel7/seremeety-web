# 기술 노트 — seremeety-web

이 문서는 seremeety-web을 만들면서 내린 핵심 기술 선택과 그 배경, 좋은 점과 트레이드오프를 비교적 쉽게
정리한다. 구조 개요는 [architecture.md](./architecture.md), 영역별 구현 세부는 [domains/](./domains/),
현재 진행 상황은 [status.md](./status.md)를 참고한다.

> 한 줄 정체성: **"동작하는 데모"가 아니라 "운영 가능한 구조"를 의도한 소개팅 웹 앱.** 화려한 화면보다
> 데이터 모델·권한 경계·검수 흐름을 먼저 세우고, 그 위에 매칭·결제·디자인을 얹는 순서를 지켰다.

---

## 1. 스택을 이렇게 고른 이유

| 영역 | 선택 | 왜 |
|---|---|---|
| 프레임워크 | **Next.js App Router** | 라우트 그룹(`(admin)`, `(authenticated)`)으로 **권한 경계를 폴더 구조 자체로 표현**. 인증·역할별 접근을 디렉토리로 한눈에 본다. |
| 백엔드 | **Firebase 풀스택**(Auth/Firestore/Storage/Functions) | 서버 인프라를 직접 운영하지 않고 인증·실시간 구독·이벤트 처리를 한 베이스에서. 소개팅 도메인은 정형 RDB가 꼭 필요하진 않아 NoSQL 단점이 덜하다. |
| UI | **React + TypeScript + SCSS Modules** | MUI·Tailwind 없이 디자인 토큰과 공용 컴포넌트를 직접 구축. 외부 의존성과 번들을 최소화하고 접근성을 끝까지 통제. |
| 상태관리 | **Redux Toolkit + RTK Query** | 서버 상태를 한 곳(RTK Query 캐시)에 모아 중복 fetch·stale·무한 리다이렉트를 제거(§3.2, §3.6). |
| 서버 로직 | **Firebase Functions v2(onCall)** | 일일 한도·차단·매칭 생성처럼 **클라이언트를 믿으면 위험한 로직만** 서버로 격리(§3.4). |
| 결제 | **mock 결제** | 실 PG 계약 전에 수익화 구조(권한·한도 게이팅)를 검증(§3.10). |

### 의도적으로 *쓰지 않은* 것
- **UI 라이브러리 / Tailwind** — 토큰·접근성·hit-target을 직접 다루기 위해.
- **별도 백엔드(Express/Nest) / 다른 BaaS** — 규모 대비 운영 부담만 늘어남.
- **유틸 패키지 다수** — native HTML/직접 구현으로 대체해 번들 축소(Phase 7에서 정리).

> Next의 SSR 이점은 이 앱에서 작다(Firebase SDK가 클라이언트 의존이라 대부분 클라이언트 렌더). 그럼에도
> Next를 쓴 이유는 **라우트 그룹 기반 권한 경계 표현 + App Router 구조**가 주는 명료함 때문이다.

---

## 2. 가장 중요한 한 가지 — "가입 = 전화 인증"이 아니다

전화번호 SMS 인증 성공은 "이 번호로 로그인한 Firebase 계정"일 뿐, 실명 본인확인도 가입 완료도 아니다.
그래서 가입을 **상태 머신**으로 모델링했다.

```
auth_only → profile_required → photo_required → preference_required
          → consent_required → review_pending → approved
                                     └→ review_rejected → (해당 단계로 복귀)
```

- `User.onboardingStatus` 하나가 **진입 라우트의 단일 진실원**이다. `resolveEntryRoute(state)`가 이 값을
  보고 어느 화면으로 보낼지 결정한다 — 분기 로직이 한 함수에 모인다.
- **좋은 점:** "전화 인증만으로 추천/매칭에 진입" 같은 사고를 구조적으로 막는다. 관리자 승인을 거친
  사용자만 추천 대상이 된다.
- **트레이드오프:** 기존(old-shape) 사용자를 위한 grandfather 처리가 필요하고, 마이그레이션 기간 동안
  신규 `profiles`/구 `users` 두 문서 구조를 함께 유지해야 한다(§3.11).

자세히는 [domains/auth-onboarding.md](./domains/auth-onboarding.md).

---

## 3. 핵심 설계 결정과 트레이드오프

각 항목을 **문제 → 선택 → 좋은 점 → 트레이드오프** 흐름으로 읽으면 된다.

### 3.1 공개 / 비공개 / 운영 데이터를 컬렉션으로 분리
- **문제:** 한 문서에 프로필·선호·결제·운영 상태가 섞이면, 잘못된 read 규칙 하나로 민감정보가 샌다.
- **선택:** `profiles`(상대에게 보이는 공개) ↔ `users`/`preferences`(비공개) ↔ `reports`/`payments`/
  `entitlements`(운영·결제)로 컬렉션을 쪼갰다.
- **좋은 점:** 가시성 경계가 데이터 구조에 박혀 있어, 규칙을 컬렉션 단위로 명확히 걸 수 있다.
- **트레이드오프:** 조회 시 여러 컬렉션을 합쳐 읽어야 한다(예: 진입 판단용 통합 fetch, §3.6).

### 3.2 깜빡임 없는 단계 전환 — Optimistic Patch
- **문제:** 가입 단계 전환마다 캐시를 invalidate하면, refetch가 끝나기 전 가드가 **이전(stale) 상태**를
  보고 엉뚱한 단계로 보내며 화면이 깜빡이거나 리다이렉트가 튄다.
- **선택:** `transitionOnboardingStatus`가 Firestore commit 직후 `updateQueryData`로 캐시의
  `onboardingStatus`만 **즉시 patch**한다(refetch를 기다리지 않음).
- **좋은 점:** 단계 전환이 매끄럽다. 무한 redirect 사이클도 사라진다.
- **트레이드오프:** 캐시와 Firestore가 잠깐 어긋날 수 있고, 실패 경로에서 `patch.undo()`를 빠뜨리면
  캐시가 잘못된 상태로 굳을 수 있다.

### 3.3 신뢰가 필요한 곳만 서버로 — Functions 경계
- **문제:** 좋아요/매칭을 클라이언트가 직접 Firestore에 쓰면 일일 한도 우회, 차단 무시, 자기 자신과의
  매칭, 매칭 누락이 가능하다.
- **선택:** `react` onCall 하나에 **인증 → 양방향 차단 검증 → 일일 한도 검증 → reaction 작성 → 상호
  좋아요면 match+chatRoom을 batch로 atomic 생성**을 모았다. `reactions`/`matches`는 Security Rules에서
  `allow write: if false`로 잠가 **서버만 쓸 수 있다.**
- **좋은 점:** 매칭의 무결성이 서버에서 보장된다. client trust를 제거했다.
- **트레이드오프(정직하게):** 아직 **부분 적용**이다. 추천 후보 산출과 노출 로그는 여전히 클라이언트에서
  돈다. 나머지 컬렉션의 Rules도 광범위하게 열려 있다(→ [status.md](./status.md) 최우선 과제).

### 3.4 Deterministic ID로 idempotency 확보
- **문제:** 같은 좋아요를 두 번 보내거나 네트워크 재시도가 일어나면 중복 문서가 생긴다.
- **선택:** 문서 ID를 내용에서 결정한다 — `reactions/{from}_{to}`, `matches/{정렬된 pair}`,
  `recommendationLogs/{user}_{recommended}`.
- **좋은 점:** 재호출해도 같은 문서를 덮어쓰니 **idempotent**하고, 별도 조회 인덱스도 필요 없으며,
  `match_id === chatRoom_id`라 매핑 테이블도 불필요하다.
- **트레이드오프:** ID 순서/방향 규칙이 코드에 "함정"으로 남는다(방향을 헷갈리면 다른 문서가 생성됨).
  생성 시간이 ID에 없어 ID만으로 정렬할 수 없다.

### 3.5 Firestore에 REST가 없는데 RTK Query를 쓰는 법 — fakeBaseQuery + queryFn
- **문제:** RTK Query는 보통 HTTP endpoint를 전제하는데, 여기는 Firebase SDK 호출뿐이다.
- **선택:** `fakeBaseQuery()` 위에서 각 endpoint의 `queryFn`이 `shared/lib/firebase/*` 헬퍼를 직접
  호출한다. 캐시·디듀프·태그 무효화·낙관적 업데이트는 RTK Query가 그대로 제공한다.
- **좋은 점:** 나중에 로직을 Functions로 옮길 때 **`queryFn` 본체만 교체하면 컴포넌트는 그대로**다.
  마이그레이션 비용을 한 레이어에 가둔다.
- **트레이드오프:** 에러를 직렬화 가능한 객체로 수동 변환해야 하고(`serializeError`/`errorWithCode`),
  HTTP 기반 자동 재시도 같은 기능은 못 쓴다.

### 3.6 진입 판단을 한 번에 — 통합 fetch + stale 가드
- **선택:** `entryStateApi`가 user/profile/preference/photos/consent를 **한 번에** 읽어 라우팅을 결정하고,
  `useEntryState`가 캐시의 `user.id`와 현재 `uid`를 비교해 **계정 전환 직후의 stale 캐시**를 걸러낸다.
- **좋은 점:** 라우트 결정이 일관되고, 다른 계정으로 재로그인했을 때 이전 사용자 데이터가 잠깐 새어
  무한 redirect가 발생하는 문제를 막는다.
- **트레이드오프:** 필드 하나가 느리면 전체가 같이 지연되고, 신규 사용자의 `data.user = null` 상태를
  "정상"으로 다뤄야 한다.

### 3.7 실시간 채팅 구독을 캐시 생명주기에 묶기 — onCacheEntryAdded
- **문제:** Firestore `onSnapshot` 구독을 컴포넌트마다 직접 걸고 풀면 구독 누수가 생긴다.
- **선택:** `chatApi`가 `onCacheEntryAdded`에서 구독을 등록하고 `cacheEntryRemoved`에서 정리한다.
  `queryFn`은 빈 배열을 즉시 반환하고, 이후 구독이 데이터를 push한다.
- **좋은 점:** 구독 생명주기가 캐시에 묶여 한 곳에서 관리된다. 메시지/마지막 메시지 변경이 별도
  무효화 없이 자동 반영된다.
- **트레이드오프:** 초기엔 빈 배열이라 데이터 도착 전 "비어 있음"이 잠깐 보일 수 있어 명시적 로딩 체크가
  필요하다.

### 3.8 사진은 배열이 아니라 1:N 컬렉션
- **선택:** 사진을 `profiles` 문서의 배열이 아니라 별도 `profilePhotos` 컬렉션으로 뒀다(사용자당 최대 6장).
- **좋은 점:** 사진마다 **승인 상태·순서·대표 여부**를 독립적으로 다루고, 대표 사진 변경/삭제를
  `writeBatch`로 원자 처리한다. 배열에 끼워 넣을 때의 트랜잭션 복잡성을 피한다.
- **트레이드오프:** 프로필+사진을 합쳐 읽는 2쿼리가 필요하나, 데이터가 작아 영향이 미미하다.

### 3.9 한국 사용자를 위한 KST 자정 일일 한도
- **선택:** "오늘/어제" 경계를 사용자 기기 타임존이 아니라 **KST 자정**으로 고정해 한도를 센다.
- **좋은 점:** 어디서 접속하든 같은 경계가 적용된다. 한국은 서머타임이 없어 고정 offset이 안정적이다.
- **트레이드오프:** offset(9시간)이 하드코딩되어 있고, 같은 계산이 클라이언트(`dailyLimits.ts`)와
  서버(`react.ts`) 양쪽에 중복된다.

### 3.10 실 결제 없이 수익화 구조 검증 — mock 결제
- **선택:** 플랜 정의(`plans.ts`)를 단일 소스로 두고, mock checkout이 `entitlements` 문서의 **일일 한도를
  denormalize 저장**한다. 추천/좋아요/받은 좋아요 노출이 이 한도를 보고 게이팅된다.
- **좋은 점:** PG 계약 전에 free↔premium 전환과 권한 게이팅을 끝까지 검증할 수 있다. 실 PG 도입 시
  `queryFn`을 webhook 흐름으로 바꾸면 된다(§3.5와 같은 전략).
- **트레이드오프:** mock(클라이언트 mutation)과 real(webhook)의 흐름이 달라 전환 시 리팩터가 필요하고,
  현재 게이트는 UI 레벨이라 Rules 강제가 추가로 필요하다.

### 3.11 점진적 마이그레이션 — Legacy Bridge dual-write
- **문제:** 데이터 모델을 대개편하면서 기존 화면(매칭/채팅/마이페이지)이 한순간에 깨지면 안 된다.
- **선택:** 신규 컬렉션에 쓰면서 동시에 구 `users.*`/`chat_rooms`에도 쓰는 dual-write 어댑터
  (`legacyBridge.ts`)를 뒀다.
- **좋은 점:** 리더를 천천히 옮기는 동안에도 앱이 계속 동작한다. "한 번에 다 갈아엎기"의 위험을 분산한다.
- **트레이드오프:** 두 곳 쓰기가 비원자적이라 불일치 가능성이 있고, 마이그레이션이 끝나면 반드시
  제거해야 하는 기술 부채다.

### 3.12 UI 라이브러리 없이 접근성을 직접 구현
- **선택:** Select·DatePicker·Modal 등을 headless 라이브러리 없이 자작하고, `aria-expanded`/
  `aria-activedescendant`/role/키보드 내비게이션을 직접 제어한다. 포커스 링은 `:focus-visible`로 통일.
- **좋은 점:** 번들이 가볍고 접근성을 완전히 통제한다. 디자인 토큰과도 자연스럽게 맞물린다.
- **트레이드오프:** 위젯 동작을 직접 유지보수해야 하고, 옵션 수천 개 가상화나 모달 focus trap 등은 아직
  보완 대상이다.

### 3.13 비용 폭주 가드 — Functions 전역 옵션
- **선택:** 모든 Function이 `region: asia-northeast3`(서울), `minInstances: 0`, `maxInstances: 5`,
  `timeoutSeconds: 30`, `memory: 256MiB` 기본값을 받는다.
- **왜:** 한국 지연 최소화 + idle 청구 차단 + 무한루프/retry 폭주 시 동시 실행 cap. 출발선에서 안전값으로
  잠갔다.

---

## 4. 정직한 현재 한계

이 프로젝트는 의도적으로 "운영 가능한 구조"를 지향하지만, 아직 실서비스 라이브 노출 단계는 아니다.

- **보안 과도기:** `reactions`/`matches`만 서버로 잠겼고, 나머지 컬렉션의 Security Rules는 넓게 열려 있다.
- **추천 점수화 없음:** 현재는 단순 셔플(`score=0`). 나이/지역/태그 가중치는 후속.
- **legacy reader 잔존:** 일부 화면이 구 `users`/`chat_rooms`를 읽는다.
- **배포 정합성:** hosting 산출물(`dist`) ↔ Next 빌드(`.next`) 불일치([deployment.md](./operations/deployment.md)).

전체 목록과 우선순위는 [status.md](./status.md), 사업/법무/인프라 항목은
[operations/production-checklist.md](./operations/production-checklist.md)에 있다.

---

## 5. 한 줄 회고

**데이터 모델과 신뢰 경계를 먼저 세우고, 그 위에 UI·매칭·결제·디자인을 순서대로 얹었다.** 덕분에 각
결정이 "왜 이렇게 했는가"로 설명되고, 남은 작업도 "무엇을 어디까지 옮기면 되는가"로 명확하게 떨어진다.
