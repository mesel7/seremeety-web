# 공용 UI / 스타일 / 토큰 — seremeety-web

> 모든 feature가 공유하는 디자인 토큰(SCSS 변수), 공용 컴포넌트 라이브러리(`shared/components/common/*`), 앱 레이아웃 셸(`AppShell` / `BottomMenu` / `Header`)을 담당하는 인프라 도메인. CSS-in-JS 없이 **strict SCSS Modules + 중앙 토큰** 패턴으로 일관성을 유지하고, 공용 컴포넌트는 접근성(ARIA / focus-visible / 스크롤 락)을 기본 탑재한다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / 레이어 경계
> - [`frontend-convention.md`](../frontend-convention.md) — 코딩·SCSS·접근성 컨벤션 (이 도메인이 실제로 구현한 규칙)
> - [`profile-photo.md`](./profile-photo.md) — `CropperModal` / `DatePicker`를 실제로 소비하는 도메인

---

## 1. 개요

frontend-ui는 화면 기능이 아니라 **공용 인프라**다. 세 축으로 나뉜다.

1. **디자인 토큰 시스템** — [`styles/base/variables.scss`](../../src/styles/base/variables.scss)에 색상·폰트·크기·그림자·z-index·간격을 SCSS 변수로 중앙 정의한다. 런타임 테마 전환이 없으므로 CSS custom property가 아닌 정적 SCSS 변수를 쓴다.
2. **공용 컴포넌트 라이브러리** — `shared/components/common/*` 아래 Button, Select, CustomRadio, DatePicker, Modal, Loading, EmptyState, ReportModal, CropperModal, Header, PageTransition 및 overlay/portal 보조 컴포넌트.
3. **레이아웃 셸** — [`AppShell`](../../src/shared/layouts/app-shell/AppShell.tsx)(480px 폭 모바일 셸) + [`BottomMenu`](../../src/shared/layouts/bottom-menu/BottomMenu.tsx)(하단 고정 4탭) + [`Header`](../../src/shared/components/common/Header.tsx)(sticky 상단).

SCSS 모듈은 모두 `@use '@/styles/base' as *;`로 토큰과 mixin을 가져온다. 이 배럴([`styles/base/index.scss`](../../src/styles/base/index.scss))은 `variables`와 `mixins`만 `@forward`하므로, 컴포넌트는 `$color-brand` 같은 변수와 `hover-capable` 같은 mixin을 namespace 없이 직접 참조한다.

전역 부트스트랩은 [`styles/main.scss`](../../src/styles/main.scss)가 담당한다. `global`(reset) → `typography`(폰트) → `layout`(html/body, `sr-only`) → `components`(폼 reset / focus ring / 스크롤 락) → `vendors` 순으로 `@use`해, **전역 reset 후 컴포넌트별 reset**이 차례로 적용된다.

---

## 2. 핵심 흐름

### 2.1 토큰 → 컴포넌트 스타일

```scss
// 각 *.module.scss 상단
@use '@/styles/base' as *;

.root {
  background: $gradient-brand;     // variables.scss의 변수
  @include hover-opacity(0.85);    // mixins.scss의 mixin (hover 가능 장치에서만)
}
```

변수/색상/크기를 새로 쓰려면 먼저 `variables.scss`에 정의해야 한다. 임의 px·hex 값을 모듈에 직접 박지 않는 것이 규칙이다.

### 2.2 레이아웃 셸

로그인 후 페이지는 `AppShell`로 감싼다. `showBottomMenu`가 true면 하단 4탭(`menuItems`: discover `/` · likes `/likes` · chats `/chats` · mypage `/mypage`)을 렌더링하고, `main`에 `bottom-menu-offset` 패딩을 줘 콘텐츠가 메뉴에 가리지 않게 한다.

- [`BottomMenu`](../../src/shared/layouts/bottom-menu/BottomMenu.tsx)는 `usePathname()`으로 현재 경로를 읽어 `isSelected`를 계산한다. `/`만 정확 일치(`pathname === '/'`)로 판정하고, 나머지는 `pathname.startsWith(route)`로 하위 경로까지 활성 처리한다.
- 컨테이너는 시맨틱 `<nav aria-label="주요 메뉴">`이고, 각 [`MenuItem`](../../src/shared/layouts/bottom-menu/MenuItem.tsx)은 선택 시 `aria-current="page"` + `color-brand` 하이라이트를 가진 `Link`다.
- 위치는 `position: fixed` (`bottom: 0`, `left: 50%`, `translateX(-50%)`, `max-width: 480px`)에 `env(safe-area-inset-bottom)`를 더해 노치 단말 하단 영역을 보정한다.

### 2.3 오버레이 / 모달

[`Modal`](../../src/shared/components/common/modal/Modal.tsx)이 열리면:

1. [`ModalPortal`](../../src/shared/components/common/modal/ModalPortal.tsx) → [`OverlayPortal`](../../src/shared/components/common/overlay/OverlayPortal.tsx)이 `createPortal(children, document.body)`로 **`document.body` 직속**에 렌더링한다(별도 portal-root div는 두지 않는다). `useEffect`로 마운트 후에만 portal 타깃을 잡으므로 SSR-safe하다.
2. [`OverlayLayer`](../../src/shared/components/common/overlay/OverlayLayer.tsx)가 뒤 배경을 `overlay-layer` mixin(blur + 반투명, `z-index: 200`)으로 깐다.
3. [`useLockViewportScroll`](../../src/shared/components/common/modal/useLockViewportScroll.ts)이 `html`/`body`에 `common-modal-open` 클래스를 토글해 `overflow: hidden`으로 배경 스크롤을 막는다.
4. `role="dialog"` + `aria-modal` + `aria-labelledby`(title) + `aria-describedby`(description/children)를 연결한다.
5. 액션이 없으면 닫기 버튼과 backdrop 클릭 닫기가 기본 켜지고(`showCloseButton`/`closeOnBackdrop`의 기본값이 `actions.length === 0`), 액션이 있으면 끈다.

### 2.4 폼 입력 위젯

- [`Select`](../../src/shared/components/common/select/Select.tsx) — 버튼 클릭으로 드롭다운을 열고, `searchable`이면 검색 input으로 label을 필터링한다. 키보드는 Arrow/Home/End/Enter/Escape/Tab과 type-ahead를 지원한다.
- [`DatePicker`](../../src/shared/components/common/date-picker/DatePicker.tsx) — 7열 달력 grid와 연도 선택 모드(3열)를 전환하고, `min`/`max`(YYYY-MM-DD 문자열) 경계를 검사한다. 생년월일 입력에서 18~80세 범위로 쓰인다.
- [`CustomRadio`](../../src/shared/components/common/custom-radio/CustomRadio.tsx) — 네이티브 `input[type=radio]`를 `label`로 감싸고 CSS로 원형 마커를 그린다(접근성은 네이티브에 위임).

### 2.5 상태/피드백 컴포넌트

- [`Loading`](../../src/shared/components/common/loading/Loading.tsx) — 3점 bounce 애니메이션. `role="status"` `aria-live="polite"` `aria-busy="true"` + `sr-only` "로딩 중" 텍스트로 스크린리더에 알린다. `prefers-reduced-motion`에서는 애니메이션을 끈다.
- [`EmptyState`](../../src/shared/components/common/empty-state/EmptyState.tsx) — `CircleX` 기본 아이콘 + 선택 메시지로 빈 목록을 표시한다.
- [`ReportModal`](../../src/shared/components/common/report-modal/ReportModal.tsx) — 신고 사유 radio + 상세 textarea(500자) + `isSubmitting` 동안 버튼 비활성화. async 제출 완료 후 명시적으로 닫는 패턴이다.
- [`CropperModal`](../../src/shared/components/common/cropper/CropperModal.tsx) — `react-cropper`로 1:1 정방형 크롭. 프로필 사진 업로드에서 쓰인다.

---

## 3. 주요 파일

### 스타일 기반

| 파일 | 역할 |
|---|---|
| [`styles/base/variables.scss`](../../src/styles/base/variables.scss) | 디자인 토큰(색상·폰트·크기·그림자·z-index·간격) 중앙 정의 |
| [`styles/base/index.scss`](../../src/styles/base/index.scss) | `variables`·`mixins`를 `@forward`하는 배럴 (모듈이 `@use '@/styles/base'`로 소비) |
| [`styles/base/mixins.scss`](../../src/styles/base/mixins.scss) | `hover-capable`·`hover-opacity`·`hover-color`·`overlay-layer`·`image-skeleton` mixin |
| [`styles/base/global.scss`](../../src/styles/base/global.scss) | 전역 reset (box-sizing, margin/padding, 링크/이미지, 선택 색상) |
| [`styles/base/typography.scss`](../../src/styles/base/typography.scss) | 폰트 import(Noto Sans KR/JP, Outfit, Dancing Script) + 본문 렌더링 최적화 |
| [`styles/base/components.scss`](../../src/styles/base/components.scss) | 폼 reset(`-webkit-appearance` 제거), `:focus-visible` 링, `common-modal-open` 스크롤 락, autofill 보정 |
| [`styles/base/layout.scss`](../../src/styles/base/layout.scss) | html/body 레이아웃, `sr-only` 접근성 유틸 |
| [`styles/main.scss`](../../src/styles/main.scss) | 전역 진입점 (base → vendors 순 `@use`) |

### 공용 컴포넌트

| 파일 | 역할 |
|---|---|
| [`button/Button.tsx`](../../src/shared/components/common/button/Button.tsx) | text + 선택 Lucide 아이콘. `href`면 `Link`, 아니면 `type="button"`. 시각 변형은 `type` prop(`root--${type}`) |
| [`select/Select.tsx`](../../src/shared/components/common/select/Select.tsx) | ARIA combobox. searchable 필터링 + type-ahead + 키보드 nav |
| [`custom-radio/CustomRadio.tsx`](../../src/shared/components/common/custom-radio/CustomRadio.tsx) | 네이티브 radio + CSS 원형 마커, `label` wrap |
| [`date-picker/DatePicker.tsx`](../../src/shared/components/common/date-picker/DatePicker.tsx) | 달력 grid + 연도 모드, `min`/`max`(YYYY-MM-DD) 경계 |
| [`modal/Modal.tsx`](../../src/shared/components/common/modal/Modal.tsx) | dialog. title/description/children/actions, backdrop·closeButton 조건부 |
| [`modal/ModalPortal.tsx`](../../src/shared/components/common/modal/ModalPortal.tsx) | `OverlayPortal`로 위임하는 얇은 래퍼 |
| [`modal/useLockViewportScroll.ts`](../../src/shared/components/common/modal/useLockViewportScroll.ts) | `common-modal-open` 토글로 배경 스크롤 락 |
| [`overlay/OverlayLayer.tsx`](../../src/shared/components/common/overlay/OverlayLayer.tsx) | blur 배경 오버레이(`z-index: 200`) |
| [`overlay/OverlayPortal.tsx`](../../src/shared/components/common/overlay/OverlayPortal.tsx) | `createPortal(children, document.body)` (SSR-safe) |
| [`loading/Loading.tsx`](../../src/shared/components/common/loading/Loading.tsx) | 3점 bounce + `role="status"` aria-live + sr-only |
| [`empty-state/EmptyState.tsx`](../../src/shared/components/common/empty-state/EmptyState.tsx) | 빈 상태(아이콘 + 메시지) |
| [`report-modal/ReportModal.tsx`](../../src/shared/components/common/report-modal/ReportModal.tsx) | 신고 사유 radio + textarea(500자) + `isSubmitting` |
| [`cropper/CropperModal.tsx`](../../src/shared/components/common/cropper/CropperModal.tsx) | `react-cropper` 1:1 크롭 모달 |
| [`Header.tsx`](../../src/shared/components/common/Header.tsx) | sticky 헤더. logo/title/back/menu 슬롯, `headingLevel`(h1/h2) 선택 |
| [`PageTransition.tsx`](../../src/shared/components/common/PageTransition.tsx) | 페이지 전환 래퍼 (현재 애니메이션 제거, `direction` prop 무시) |

### 레이아웃 / 유틸

| 파일 | 역할 |
|---|---|
| [`layouts/app-shell/AppShell.tsx`](../../src/shared/layouts/app-shell/AppShell.tsx) | `main` + 조건부 `BottomMenu` 셸(480px, 100svh) |
| [`layouts/bottom-menu/BottomMenu.tsx`](../../src/shared/layouts/bottom-menu/BottomMenu.tsx) | 하단 고정 4탭 nav, pathname 기반 활성 판정 |
| [`layouts/bottom-menu/MenuItem.tsx`](../../src/shared/layouts/bottom-menu/MenuItem.tsx) | 탭 항목 `Link`, 선택 시 `aria-current="page"` |
| [`lib/classNames.ts`](../../src/shared/lib/classNames.ts) | `cx()` — falsy 필터 후 공백 조인 |
| [`lib/constants.ts`](../../src/shared/lib/constants.ts) | `menuItems`, 프로필 폼 설정, `DEFAULT_PROFILE_PICTURE_URL` 등 공용 상수 |
| [`lib/format.ts`](../../src/shared/lib/format.ts) | phone/age/date/timestamp 포매팅 |
| [`lib/validation.ts`](../../src/shared/lib/validation.ts) | 프로필 필드 검증(nickname 중복은 async) |
| [`app/layout.tsx`](../../src/app/layout.tsx) | Next.js 루트 레이아웃. metadata/viewport + `AppProviders` |

---

## 4. 데이터·상태

frontend-ui는 도메인 데이터를 소유하지 않는다. 상태는 두 종류뿐이다.

- **컴포넌트 로컬 state** — Select 열림/검색어, DatePicker 표시 월/모드, Modal open 등은 각 컴포넌트(또는 호출부)의 `useState`로만 관리한다. 전역 store에 올리지 않는다.
- **전역 DOM 사이드이펙트** — 모달이 열려 있는 동안 `html`/`body`에 `common-modal-open` 클래스를 붙여 스크롤을 잠그는 것이 유일한 전역 side effect다. 마운트 해제 시 해제한다.

**토큰 상수**는 SCSS 변수로만 존재한다(런타임 JS에서 접근 불가). 색상·z-index를 JS에서 읽어야 하는 코드는 없으며, 테마 전환이 없으므로 CSS custom property로 승격하지 않았다.

`cx()`는 `clsx`/`classnames` 대신 쓰는 5줄짜리 자체 유틸로, `false | null | string | undefined`만 받아 조건부 클래스를 합친다. 모든 공용 컴포넌트가 `cx(styles.root, cond && styles['root--variant'])` 형태로 변형 클래스를 붙인다.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| **strict SCSS Modules + 중앙 토큰** (모든 컴포넌트 `*.module.scss`, `@use '@/styles/base'`, 변수 1곳 정의) | 디자인 일관성, namespace 충돌 방지, CSS-in-JS 없는 작은 번들 | 변수명이 길어지고, 신규 크기/색상마다 `variables.scss` 수정 필요. 런타임 동적 스타일 불가 |
| **Select 자체 구현** (headless 라이브러리 미사용) | 번들 절감 + ARIA(`aria-expanded`/`aria-activedescendant`/`role="listbox"`)와 키보드 type-ahead를 완전 제어 | virtualizing 미지원 → 옵션 수천 개면 성능 저하 |
| **portal은 `document.body` 직속 렌더** (`OverlayPortal`) | 상위 `overflow:hidden` 클리핑·z-index 충돌 회피, 별도 portal-root div 불필요 | 글로벌 z-index 계층에 의존(현재 overlay 200 / sticky 100 / bottom-menu 90 고정값) |
| **Modal 스크롤 락 = 클래스 토글** (`common-modal-open`) | `position:fixed` 스크롤 잠금보다 단순, 스크롤 위치 보존 | 중첩 모달 시 토글 카운팅이 없어 깊은 stacking은 미검증 |
| **Modal actions `autoClose`(기본 true)** | confirm/alert에서 클릭 후 자동 닫힘 편의 | async submit 결과를 기다려야 하면 `autoClose: false` + 명시적 `onClose` 필요(ReportModal 패턴) |
| **Header `headingLevel`(기본 h2)** | 같은 헤더를 여러 페이지에서 재사용해도 heading outline 위반 방지 | 페이지마다 레벨을 명시해야 함 |
| **CropperModal 1:1 고정 + `react-cropper`** | 프로필 사진은 정방형 기준이라 고정 비율이 합리적, 터치 지원 안정적 | 다른 비율 필요 시 param 추가, `react-cropper` 번들 증가(lazy load 여지) |
| **focus 표시 = `:focus-visible` 링** ([components.scss](../../src/styles/base/components.scss)) | 키보드 사용자에게만 2px brand outline + glow, 마우스 클릭 시 ring 숨김 | `:focus-visible` 미지원 구형 브라우저는 fallback 없음 |

> **명명 불일치(주의):** Button의 시각 변형은 자유 문자열 `type` prop(`root--${type}`)이고, Modal 액션의 변형은 타입 제한된 `tone: 'primary' | 'secondary'`다. 동일 개념(버튼 톤)을 두 컴포넌트가 다른 prop 이름으로 노출하므로, 신규 컴포넌트 추가 시 한쪽으로 통일하는 것이 좋다.

---

## 6. 현재 상태

### 구현됨

- 디자인 토큰 시스템(색상·폰트·크기·그림자·z-index·간격)과 `@use` 기반 전역 reference 파이프라인.
- 공용 컴포넌트: Button, Select, CustomRadio, DatePicker, Modal(+ModalPortal/useLockViewportScroll), OverlayLayer/OverlayPortal, Loading, EmptyState, ReportModal, CropperModal, Header, PageTransition.
- Select 접근성(ARIA combobox + 키보드 nav + type-ahead + searchable 모드).
- DatePicker 접근성(`role="dialog"`/`grid`/`listbox`, `aria-selected`, `aria-current="date"`, 키보드 nav).
- Modal 접근성(`role="dialog"` `aria-modal` `aria-labelledby` `aria-describedby`, backdrop/close 조건부) + `common-modal-open` 스크롤 락.
- AppShell + BottomMenu(4탭 grid, pathname 기반 활성, `safe-area-inset-bottom` 보정), Header sticky(logo/title/back/menu, `headingLevel`).
- Loading(3점 bounce + `role="status"` aria-live + sr-only, `prefers-reduced-motion` 대응).
- `:focus-visible` 2px outline + glow, `hover-capable` mixin으로 hover 불가 장치 분기.
- `cx()` 클래스 유틸, `format.ts`/`validation.ts` 공용 헬퍼.

### 남은 작업

- **PageTransition** — `direction` prop을 받지만 무시하고 애니메이션이 제거된 상태. 사실상 패스스루 래퍼이므로, 재도입하거나 컴포넌트를 정리할지 결정 필요.
- **DatePicker** — 키보드 자동 채움(예: 월 부분 type-ahead) 미구현, 수동 선택만.
- **Select virtualizing** — 옵션 1000+개 대비 `react-window` 등 가상 리스트 도입은 미적용(현재 사용처는 옵션 수가 적어 보류).
- **CropperModal 비율 유연화** — 1:1 고정, 다른 aspect ratio param 미지원. 사용 빈도가 낮아 lazy load 최적화 여지도 있음.
- **중첩 모달(modal stacking)** — 스크롤 락이 카운팅 없이 클래스 토글이라, 동시 다중 모달 시나리오 미검증.
- **`image-skeleton` mixin** — 정의는 있으나(mixins.scss) 실사용처 확인 필요(스켈레톤 로더 미연결).

### 알려진 위험

- **portal-root 가정 없음 / focus trap 없음** — portal은 `document.body`에 직접 렌더링하고, 코드상 **focus trap은 구현되어 있지 않다**. 모달이 열려도 Tab 포커스가 배경으로 빠질 수 있고, 키보드 사용자는 닫기 버튼/Escape에 의존한다(키보드 닫힘 처리는 호출부 책임). *(분석 초안에 있던 "ModalPortal focus trap" 서술은 실제 코드와 다름.)*
- **z-index 하드코딩** — overlay 200 / sticky 100 / bottom-menu 90이 변수 고정값이다. 새 fixed/sticky 레이어를 추가하면 계층 충돌 가능. 레이어가 늘면 z-index 체계 정리 필요.
- **DatePicker `min`/`max` 문자열 검증** — YYYY-MM-DD 문자열 비교만 하므로 `'2024-13-01'` 같은 잘못된 형식은 런타임에서 깨질 수 있다. 호출부 검증 권장.
- **Select type-ahead 버퍼** — 연속 타이핑 버퍼가 누적돼 빠른 연타 시 의도와 다른 옵션이 선택될 수 있다.
- **Loading `prefers-reduced-motion`** — 모션 축소 설정에서 애니메이션을 완전히 끄면 시각 피드백이 사라지고 `sr-only` 텍스트에만 의존한다(정적 점 표시 검토 여지).
- **`react-cropper` 번들** — 약 50KB(gzip) 추가. 사용처가 프로필 사진 편집뿐이라 lazy loading 최적화 기회가 있다.
