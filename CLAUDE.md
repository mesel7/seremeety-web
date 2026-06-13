# CLAUDE.md — seremeety-web

대학생 대상 한국·일본어 소개팅 웹 앱. 전화번호 인증 → 프로필/사진 작성 → 관리자 심사 →
추천 피드 → 좋아요 → 매칭 → 1:1 채팅 → 프리미엄(mock) 결제로 일일 한도 상향.
**Next.js App Router + Firebase(Auth/Firestore/Storage/Functions) + Redux Toolkit/RTK Query** 기반 SPA.

이 파일은 **에이전트가 가장 먼저 읽는 단일 진입점**이다. 코딩 규칙의 권위 있는 요약 + 문서 지도 +
프로젝트 고유 규칙을 담는다. 상세 명세는 아래 문서 지도에서 해당 문서를 연다.

---

## 0. 문서 지도 (먼저 어디를 볼지)

| 무엇을 하려는가 | 읽을 문서 |
|---|---|
| 제품 방향 / 단계별 우선순위 / 범위(scope) | [docs/roadmap.md](docs/roadmap.md) |
| 시스템 구조 / 핵심 흐름 / 의사결정 개요 | [docs/architecture.md](docs/architecture.md) |
| Firestore 컬렉션·필드·타입 | [docs/data-model.md](docs/data-model.md) |
| 기술 선택 근거 / 트레이드오프 (읽기 쉬운 해설) | [docs/tech-notes.md](docs/tech-notes.md) |
| 현재 진행 상황 / 실운영 전 남은 작업 | [docs/status.md](docs/status.md) |
| 프론트엔드 상세 컨벤션 (이 파일의 원본 전체판) | [docs/frontend-convention.md](docs/frontend-convention.md) |
| 인증/온보딩 | [docs/domains/auth-onboarding.md](docs/domains/auth-onboarding.md) |
| 추천/매칭/좋아요 | [docs/domains/matching.md](docs/domains/matching.md) |
| 프로필/사진 | [docs/domains/profile-photo.md](docs/domains/profile-photo.md) |
| 채팅 | [docs/domains/chat.md](docs/domains/chat.md) |
| 관리자/백오피스/신고/차단/심사 | [docs/domains/admin.md](docs/domains/admin.md) |
| 결제(mock)/권한 | [docs/domains/payment-entitlement.md](docs/domains/payment-entitlement.md) |
| 상태관리(RTK Query) | [docs/domains/state-management.md](docs/domains/state-management.md) |
| Firebase Functions / 보안 경계 | [docs/domains/functions-security.md](docs/domains/functions-security.md) |
| 공용 UI / 스타일 / 토큰 | [docs/domains/frontend-ui.md](docs/domains/frontend-ui.md) |
| 배포 / Firebase 세팅 / 환경변수 / 운영 체크리스트 | [docs/operations/](docs/operations/) |

전체 문서 목차는 [docs/README.md](docs/README.md).

---

## 1. 작업 전 필수 규칙

1. **제품 레벨 변경 전 [docs/roadmap.md](docs/roadmap.md)를 먼저 읽는다.** 새 라이브러리 추가, 백엔드
   구조 변경, 매칭 로직 변경, 결제/본인확인 동작 변경, 광범위 리팩터는 로드맵 확인 없이 시작하지 않는다.
2. **프론트엔드 작업은 [docs/frontend-convention.md](docs/frontend-convention.md)를 따른다.** 아래 §3은
   그 요약이다. 기존 코드 패턴이 명확히 다르면 기존 패턴을 따른다.
3. **작업 완료 전 검증한다.**
   ```bash
   npm run lint
   npx tsc --noEmit
   ```
4. **사용자 노출 텍스트는 한국어, 코드 식별자는 영어.** `alt`/`aria-label`/에러 메시지/버튼 텍스트도 한국어.

---

## 2. 아키텍처 규칙 (이 프로젝트 고유)

폴더 책임:

```
src/
  app/                       # Next.js 라우트. (admin)/(authenticated) 라우트 그룹 = 권한 경계
  features/                  # 도메인별 페이지/섹션 UI (auth, onboarding, matching, chat, admin, ...)
  shared/
    components/common/       # 공용 UI (button, select, modal, ...)
    layouts/                 # app-shell, bottom-menu
    lib/api/                 # RTK Query slice (도메인별)
    lib/firebase/            # Firestore/Storage helper (slice가 wrapping)
    lib/onboarding/          # 가입 흐름 유틸 (resolveEntryRoute, transitions, ...)
    lib/store/               # Redux store + authSlice
    providers/               # AppProviders, AuthSync, RouteGate
    types/model/             # 도메인 타입
  styles/                    # SCSS 토큰 + base
functions/                   # Firebase Functions (서버 권위 로직)
```

핵심 경계 규칙:

- **서버 상태 = RTK Query 한 곳에서만.** Context/Redux slice에 서버 데이터를 중복 저장하지 않는다.
  전역 UI 상태(auth uid/role 등)만 `authSlice`. 폼/로컬 상태는 컴포넌트 local state.
- **API slice는 `baseApi.injectEndpoints`로 확장.** `queryFn`은 현재 `shared/lib/firebase/*` 헬퍼를
  직접 호출하고, 추후 Functions 이전 시 `queryFn` 본체만 교체한다(컴포넌트 불변). 에러는 항상
  serializable object로 변환(`serializeError` / `errorWithCode`).
- **신뢰가 필요한 로직은 Firebase Functions(onCall)로.** 일일 한도, 차단 검증, 매칭 atomic write,
  권한 변경 등. `reactions`/`matches`는 client write 금지(Rules `allow write: if false`).
- **권한 경계는 라우트 그룹 + RouteGate로.** `(admin)/**`는 `AdminRouteGate`(role==='admin'),
  `(authenticated)/**`는 `AuthenticatedRouteGate`(onboardingStatus 기반 강제 redirect).
- **승인 상태(`profile.status`, `photo.status`, `onboardingStatus`)는 클라이언트에서만 관리하지 않는다.**

제품 안티패턴(절대 금지)은 [docs/roadmap.md](docs/roadmap.md) "Product-Level Anti-Patterns" 참조.
요약: Phone Auth를 실명 본인확인으로 취급 금지 · 모든 이성 프로필 무제한 노출 금지 · private preference
상대 노출 금지 · mock 결제를 실결제로 취급 금지 · premium 제한을 UI에서만 적용 금지 · match를 클라이언트에서
생성 금지.

---

## 3. 프론트엔드 컨벤션 요약

> 전체 규칙·예시는 [docs/frontend-convention.md](docs/frontend-convention.md). 아래는 항상 지킬 핵심.

**구조 / 컴포넌트**
- `page.tsx`는 얇게: metadata, 데이터 로딩, 라우트 조합, feature 섹션 import만. 긴 마크업 금지.
- 도메인 UI는 `features/`, 재사용 UI는 `components/`. 파일명 = 컴포넌트명. 한 폴더 ≈ 한 컴포넌트.
- Server Component 기본, `use client`는 인터랙션 경계만 좁게.

**시맨틱 / 접근성**
- 의미로 태그 선택: `main`/`section`/`article`/`nav`/`header`/`footer`/`ul·li`. 클릭 가능한 `div` 금지,
  heading처럼 보이는 `div` 금지.
- URL 이동 = `Link`/`a`, 액션(모달/토글/제출/삭제) = `button`(항상 `type` 명시).
- 아이콘 단독 버튼은 `aria-label`, 텍스트 동반 아이콘은 `aria-hidden="true"`.
- 모든 input은 `<label>`(placeholder는 label 아님). focus outline 전역 제거 금지(`:focus-visible` 사용).

**TypeScript**
- `strict: true`. `any` 지양(`unknown` 우선), `as` 최소화. API 응답은 경계에서 검증. 타입 에러 무시 금지.
- boolean prop: `isOpen`/`isLoading`/`hasError`/`canSubmit`. 핸들러: 내부 `handleX`, prop `onX`.

**SCSS Modules**
- 컴포넌트 스타일은 `.module.scss` 로컬. 전역은 reset/토큰/기본 타이포만. 최상위 요소 클래스는 `.root`.
- `@use`만(`@import` 금지). 중첩 최대 2단계. 미디어쿼리는 파일 하단에 평평하게. `id` 셀렉터·깊은 DOM 셀렉터 금지.

**이미지 / 아이콘**
- 의미 있는 이미지는 `next/image` + 의미 있는 `alt`, 장식 이미지는 `alt=""`/CSS 배경.
- `fill` 사용 시 부모 sizing + `sizes`. `priority`는 실제 LCP만. `aspect-ratio` 사용(padding 핵 금지).
- 아이콘 크기는 4의 배수(16/20/24/...). 아이콘 우선순위: React 아이콘 컴포넌트 > inline SVG > static SVG > PNG.

**토큰 / 자산**
- 정적 디자인 상수 = SCSS 변수, 런타임/테마 값 = CSS custom property.
- 자산명은 영어 kebab-case. `final`/`new`/`real-final` 금지.

---

## 4. 검증 / 완료 체크리스트

- [ ] 시맨틱 태그 · heading 계층 · `Link`/`button` 구분 · 모든 input에 label
- [ ] 아이콘 단독 버튼 `aria-label` · 이미지 `alt` · `fill` 이미지에 `sizes`
- [ ] 불필요한 `use client` 없음 · 서버 상태를 Context/Redux에 중복 저장하지 않음
- [ ] `.module.scss` 사용 · SCSS 중첩 ≤ 2 · `@use` · 미디어쿼리 하단
- [ ] `any` 없음(불가피하면 사유) · 승인 상태를 클라이언트에서만 관리하지 않음
- [ ] `npm run lint` · `npx tsc --noEmit` 통과
