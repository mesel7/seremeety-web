# 현재 진행 상황 — seremeety-web

이 문서는 **"지금 구현된 실제 상태"와 "실운영 전 남은 작업"**을 한곳에 정리한다.
단계별 계획의 원문은 [roadmap.md](./roadmap.md), 사업/법무/인프라 항목은
[operations/production-checklist.md](./operations/production-checklist.md), 각 영역 상세는
[domains/](./domains/) 문서를 참고한다.

> 요약: **Phase 1–9의 기능 골격은 대부분 동작한다.** 남은 핵심은 (1) 서버 신뢰 경계(Functions/Rules)
> 강화, (2) legacy bridge 제거, (3) 추천 점수화, (4) 배포 정합성, 그리고 (5) 사업/법무/본인확인/실결제다.

---

## 1. Phase 진행도

| Phase | 영역 | 상태 | 비고 |
|---|---|---|---|
| 1 | 현재 앱 안정화 | ✅ 완료 | 라우팅/인증/이미지 fallback 정리 |
| 2 | 데이터 모델·온보딩 재설계 | ✅ 완료 | 15+ 컬렉션, 8단계 onboardingStatus 상태머신 |
| 3 | Functions / API 경계 | 🟡 부분 | **3-A 완료**(`reactions`/`matches`만 서버). 3-B(Rules 좁히기)·3-C(admin 서버검증) 미완 |
| 4 | 프로필 / 이미지 | ✅ 완료 | 다중 사진(최대 6장), 크롭, 승인 상태, 완성도 계산 |
| 5 | 추천 / 매칭 재구축 | 🟡 대부분 | 추천 피드·일일 한도·매칭 생성 동작. **점수화 미구현(단순 셔플)** |
| 6 | RTK Query 상태관리 | 🟡 대부분 | 서버 상태 일원화 완료. 일부 화면이 legacy `users`/`chat_rooms` reader에 의존 |
| 7 | 패키지 의존성 정리 | ✅ 완료 | 불필요 패키지 제거(react-select/spring 등) |
| 8 | 관리자 / 신고 / 차단 / 심사 | 🟡 대부분 | 통합 검수 큐·승인/반려·정지/복구·신고·차단 동작. **권한 검증이 클라이언트 의존** |
| 9 | 결제 mock / 권한 | ✅ 완료(mock) | mock checkout → entitlement 전환, 한도 게이팅. 실 PG 미연동 |
| 10 | 디자인 / 브랜딩 | 🟡 진행 | 공용 컴포넌트·토큰·모바일 셸 완비. 모션/브랜딩 폴리싱 여지 |
| 11 | 배포 / 운영 문서화 | 🟡 진행 | 본 docs 세트가 그 산출물. 배포 정합성 항목 미결 |

---

## 2. 도메인별 현재 상태

| 도메인 | 핵심 구현(동작) | 가장 중요한 남은 작업 | 문서 |
|---|---|---|---|
| 인증/온보딩 | Phone Auth, 8단계 상태머신, RouteGate, 가입 취소 batch delete, optimistic 전이 | 온보딩 write를 Functions로, Rules 좁히기 | [auth-onboarding](./domains/auth-onboarding.md) |
| 추천/매칭 | 일일 한도 추천, 좋아요/패스/슈퍼, 상호 좋아요→매칭(서버 atomic) | 추천 산출 서버 이전, 점수화, 후보 쿼리 최적화 | [matching](./domains/matching.md) |
| 프로필/사진 | 다중 사진·크롭·압축·메인 지정, 완성도, 검수 연동 | Storage 경로 버그 수정, 업로드 검증 서버화 | [profile-photo](./domains/profile-photo.md) |
| 채팅 | 실시간 1:1(onSnapshot), 차단 가드, 페이지네이션, 날짜 구분선 | 읽음/검색/멀티미디어, `messages` 신규 컬렉션 전환 | [chat](./domains/chat.md) |
| 관리자/백오피스 | 통합 검수 큐, 승인/반려, 정지/복구, 신고/차단, 권한·플랜 | **권한 서버 검증**, 감사 로그, mutation Functions화 | [admin](./domains/admin.md) |
| 결제/권한 | free/premium 정의, mock checkout, 한도 denormalize, UI 게이팅 | 실 PG webhook, Rules 강제, 환불/만료 | [payment-entitlement](./domains/payment-entitlement.md) |
| 상태관리 | 단일 store, RTK Query 13 slice, optimistic patch, 구독 일원화 | 신뢰 로직 Functions 이전(현재 callable은 `react` 1개) | [state-management](./domains/state-management.md) |
| Functions/보안 | `react` onCall(한도·차단·매칭), 비용 가드, server-only write | **14개 컬렉션 Rules 좁히기**, admin/신고/추천 서버화 | [functions-security](./domains/functions-security.md) |
| 공용 UI | 토큰 시스템, 접근성 자작 위젯, 모바일 셸/하단 네비 | focus trap, PageTransition 정리, 점수화 무관 폴리싱 | [frontend-ui](./domains/frontend-ui.md) |

---

## 3. 실운영 전 핵심 남은 작업 (우선순위)

코드로 해결 가능한 항목을 영향도 순으로 정렬했다. 사업/법무/인프라 항목은
[production-checklist.md](./operations/production-checklist.md)에 별도로 있다.

1. **🟡 보안 — Firestore Rules collection별 잠금 (Phase 3-B, 대부분 적용됨).**
   `firestore.rules`를 컬렉션별로 좁혔다 — 권한 상승 필드(`users.role`/`status`/`onboardingStatus`,
   `profiles`/`profilePhotos`의 승인 status)의 self write 차단, 사적 컬렉션
   (`preferences`/`consents`/`entitlements`/`payments`/`recommendationLogs`/`identityVerifications`) read를
   self/admin으로, `blocks`/`reports`/`chatRooms`/`messages`를 관계 기반으로 제한(admin 작업은 `isAdmin()` 통과).
   **결제/권한 write도 server-only로 잠금 완료** — mock 결제 생성/완료/취소를 Functions callable
   (`createMockPayment`/`completeMockPayment`/`cancelMockSubscription`)로 이전하고 `payments` write를 server-only,
   `entitlements` update를 admin-only로 좁혔다(bootstrap의 free 생성만 self 허용). 이제 클라이언트가 임의 한도를
   직접 쓸 수 없다. **단 mock의 "결제 성공"은 본질적으로 클라이언트 트리거라 mock self-upgrade 자체는 막지 못한다**
   — 실 PG 결제 검증이 들어와야 닫힌다(그 슬롯은 Function에 마련됨).
   **남은 것:** `profiles`/`photos` read를 approved-only로 강화하려면 클라이언트 공개 조회에 `where(status=='approved')`
   추가 필요. **배포 전 emulator/staging 검증 권장**(레포에 emulator 설정 없음). 상세는 [functions-security §4.1](./domains/functions-security.md).
2. **🔴 admin 권한 서버 검증.** 현재 `AdminRouteGate`(클라이언트) + `role==='admin'` 체크만 존재 →
   우회 가능. Custom Claims 또는 Functions로 이전. (Phase 3-C)
3. **🟠 신뢰 필요 로직 Functions 이전.** 결제 완료/취소는 이전 완료(`completeMockPayment` 등).
   남은 것: 신고(`reports`: reporter 검증/자기신고 차단/rate limit), 차단(`blocks`: 양방향 검증),
   추천 산출(`recommendations`/`dailyLimits`)을 서버로. (Phase 3)
4. **🟠 legacy bridge 제거 + reader 마이그레이션.** matching/chat/mypage가 아직 `users`/`chat_rooms`
   legacy 필드를 읽음. 신규 `profiles`/`profilePhotos`/`matches`/`messages` 기반으로 전환 후 dual-write
   폐기. (Phase 6)
5. **🟡 추천 점수화.** `RecommendationLog.score`는 항상 `0`, `reasonCodes`는 `[]`. 나이/지역/태그 가중치
   도입. (Phase 5 후속)
6. **🟡 실 PG / 본인확인 연동.** 사업/법무 선행 필요 — [production-checklist](./operations/production-checklist.md).

> 배포: 웹은 **Vercel**(GitHub `main` 자동 배포), 백엔드는 **Firebase Functions**(nodejs22) + Firestore.
> 과거 Firebase Hosting(`dist` 정적 SPA) 설정은 제거됨 — [deployment.md](./operations/deployment.md).

---

## 4. 알려진 코드 이슈 / 정합성 메모

구현은 동작하지만 정리/수정이 필요한 지점. 작업 시 참고.

- **`matches` 타입 ↔ 실제 필드 불일치.** [match.ts](../src/shared/types/model/match.ts)는
  `userIds`/`createdByReactionIds`/`status`를 선언하지만, [functions/.../react.ts](../functions/src/reactions/react.ts)는
  실제로 `users`/`reactions`/`active`로 쓴다. 현재 reader(`getActiveMatchExists`)가 `active` 기준이라
  동작은 하지만, 타입만 믿고 `userIds`/`status`에 접근하면 `undefined`. 둘 중 하나로 정합화 필요.
- **Storage 사진 경로 덮어쓰기.** 업로드 경로가 파일명 segment 없이 사용자당 단일 객체
  (`/profile_pictures/{userId}`) 형태라, 신규 업로드가 이전 객체를 덮어쓰고 모든 사진의 `storagePath`가
  같은 값이 될 수 있다. `randomId`/`timestamp` segment 추가 권장.
- **outdated 주석 / dead code.** `reactions.ts`·`matches.ts`의 "client에서 직접 write" TODO 주석은
  Phase 3-A로 무효(이미 onCall 처리). `createReaction`/`createMatch`는 호출되지 않는 dead code.
- **비원자적 쓰기.** mock 결제(`completeMockPayment`→`setEntitlementPlan`)와 메시지 전송
  (`addDoc`+`lastMessage` `updateDoc`)이 비원자적 → 중간 실패 시 부분 상태 가능. 실 PG는 webhook으로 원자화.
- **루트 `DATA_MODEL.md`는 stale.** "아직 어떤 컴포넌트도 신규 타입을 import하지 않음"은 사실과 다르다
  (Phase 4–9에서 광범위 사용 중). 최신판은 [data-model.md](./data-model.md). 루트 파일은 제거됨.
- **`README.ko.md`/`README.ja.md`는 legacy SPA를 설명.** 코인 상점/요청 수락·거절 등 재구축 이전 앱 기준.
  공개 README라 본 작업에서 손대지 않았으나 갱신 후보.

---

## 5. 정직성 경계 (문서/표현 시 주의)

- Firebase Phone Auth는 **SMS 로그인**이지 한국식 실명 본인확인이 아니다.
- mock 결제는 실제 거래가 없다 — "결제 준비 완료"로 표현하지 않는다.
- 위 §3의 보안 항목이 끝나기 전에는 **실사용자 공개 운영을 "준비 완료"로 단정하지 않는다.**
