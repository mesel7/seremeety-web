# seremeety-web 문서

대학생 대상 한국·일본어 소개팅 웹 앱의 기술 문서 모음. 코딩 컨벤션과 작업 진입점은 레포 루트의
[CLAUDE.md](../CLAUDE.md)에 있다.

## 한눈에 보기

| 무엇 | 문서 |
|---|---|
| 제품 방향 · 단계별 로드맵(Phase 1–11) · 범위 | [roadmap.md](./roadmap.md) |
| 시스템 구조 · 핵심 흐름 · 의사결정 개요 | [architecture.md](./architecture.md) |
| Firestore 컬렉션 · 필드 · 타입 (현재 기준) | [data-model.md](./data-model.md) |
| 기술 선택 근거 · 트레이드오프 (읽기 쉬운 해설) | [tech-notes.md](./tech-notes.md) |
| 현재 진행 상황 · 실운영 전 남은 작업 | [status.md](./status.md) |
| 프론트엔드 상세 컨벤션 | [frontend-convention.md](./frontend-convention.md) |

## 도메인별 문서 (`domains/`)

| 도메인 | 문서 |
|---|---|
| 인증 / 온보딩 | [domains/auth-onboarding.md](./domains/auth-onboarding.md) |
| 추천 / 매칭 / 좋아요 | [domains/matching.md](./domains/matching.md) |
| 프로필 / 사진 | [domains/profile-photo.md](./domains/profile-photo.md) |
| 채팅 | [domains/chat.md](./domains/chat.md) |
| 관리자 / 백오피스 / 신고 / 차단 / 심사 | [domains/admin.md](./domains/admin.md) |
| 결제(mock) / 권한 | [domains/payment-entitlement.md](./domains/payment-entitlement.md) |
| 상태관리 (RTK Query) | [domains/state-management.md](./domains/state-management.md) |
| Firebase Functions / 보안 경계 | [domains/functions-security.md](./domains/functions-security.md) |
| 공용 UI / 스타일 / 토큰 | [domains/frontend-ui.md](./domains/frontend-ui.md) |

## 운영 문서 (`operations/`)

| 주제 | 문서 |
|---|---|
| Firebase 프로젝트 세팅 | [operations/firebase-setup.md](./operations/firebase-setup.md) |
| 환경변수 | [operations/env.md](./operations/env.md) |
| 배포 | [operations/deployment.md](./operations/deployment.md) |
| 실운영 전 체크리스트(사업/법무/인프라) | [operations/production-checklist.md](./operations/production-checklist.md) |

## 문서 유지 원칙

- 코드가 바뀌면 관련 문서도 같이 갱신한다. 변경 이력은 git log로 추적하고 문서에는 현재 상태만 담는다.
- "로드맵의 할 일"과 "지금 구현된 실제 상태"를 섞지 않는다. 도메인 문서는 실제 구현을 기술하고, 앞으로의
  계획은 [roadmap.md](./roadmap.md) / [status.md](./status.md)에 둔다.
