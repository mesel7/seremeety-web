# Frontend Convention for Agents

## Stack

- Next.js App Router
- React
- TypeScript
- SCSS Modules
- Next.js `Image`
- Component-first structure
- Semantic HTML first

This document is the main convention for frontend work.  
Follow it unless an existing codebase pattern clearly differs.

---

## 1. Core Principles

Frontend code must prioritize:

1. semantic HTML
2. accessibility
3. maintainable component structure
4. local scoped styling
5. type safety
6. predictable asset handling
7. minimal global side effects
8. production-readiness

Do not optimize only for visual output.  
Structure, meaning, interaction, accessibility, and maintainability matter equally.

---

## 2. Project Structure

Use this responsibility split:

```txt
src/
  app/          # routing, layouts, pages, metadata, server entry points
  features/     # page/domain-specific UI sections
  components/   # reusable UI and shared layout components
  styles/       # tokens, reset, base styles, themes
  lib/          # non-UI utilities
  hooks/        # reusable hooks
  types/        # shared types
```

Recommended shape:

```txt
src/
  app/
    layout.tsx
    page.tsx
    globals.scss

  components/
    ui/
      Button/
        Button.tsx
        Button.module.scss
    layout/
      PageContainer/
        PageContainer.tsx
        PageContainer.module.scss

  features/
    home/
      Hero/
        Hero.tsx
        Hero.module.scss

  styles/
    abstracts/
      _tokens.scss
      _breakpoints.scss
      _mixins.scss
    base/
      _reset.scss
      _root.scss
      _typography.scss
    themes/
```

Rules:

- `app/` handles route entry, layouts, metadata, and high-level composition.
- `features/` contains page/domain-specific sections.
- `components/` contains reusable UI and shared layout.
- `styles/` contains global foundations only.
- Do not place large page markup directly in `page.tsx`.

---

## 3. Page and Component Rules

### Page files

`page.tsx` should stay thin.

Allowed in `page.tsx`:

- metadata
- data loading
- route-level composition
- importing feature sections

Example:

```tsx
import { Hero } from '@/features/home/Hero/Hero';
import { BrandFeatures } from '@/features/home/BrandFeatures/BrandFeatures';

export default function HomePage() {
  return (
    <>
      <Hero />
      <BrandFeatures />
    </>
  );
}
```

Avoid:

- long nested markup in `page.tsx`
- page-specific CSS in global styles
- repeated UI blocks that should be features/components

### Component folders

Prefer:

```txt
ComponentName/
  ComponentName.tsx
  ComponentName.module.scss
  ComponentName.types.ts
  ComponentName.test.tsx
```

Small components may omit `types` and `test`.

Rules:

- file name and component name should match
- one folder should usually represent one component
- TSX owns structure and logic
- SCSS owns presentation

---

## 4. Server and Client Component Policy

Default to Server Components.

Use Client Components only when needed:

- event handlers
- React state/effects
- browser APIs
- refs that need browser behavior
- interactive widgets

Rules:

- keep `use client` boundaries narrow
- do not mark whole pages/client trees as client unnecessarily
- move only the interactive part into a client component

---

## 5. State Policy

Keep state as local as possible.

Rules:

- local UI state stays near the component that uses it
- do not promote state globally unless multiple distant areas truly need it
- if state should be shareable/restorable, consider URL state first

URL is preferred for:

- filters
- sorting
- pagination
- search keyword
- selected tab when relevant to navigation/history

---

## 6. Semantic HTML

Choose tags by meaning, not appearance.

Use:

- page content: `main`
- section: `section`
- independent item/card: `article`
- navigation: `nav`
- header/footer: `header`, `footer`
- side/supporting content: `aside`
- action: `button`
- navigation: `a` or Next.js `Link`
- list: `ul`, `ol`, `li`

Rules:

- use one `main` per page by default
- use headings for real headings
- keep heading hierarchy logical
- avoid clickable `div`
- avoid heading-looking `div`

Example:

```tsx
<main>
  <h1>상품 목록</h1>

  <section>
    <h2>추천 상품</h2>
  </section>

  <section>
    <h2>전체 상품</h2>
    <article>
      <h3>제품 A</h3>
    </article>
  </section>
</main>
```

---

## 7. Link vs Button

Use the element that matches the behavior.

- URL navigation: `Link` / `a`
- modal, toggle, tab, submit, delete, open/close: `button`

Good:

```tsx
<Link href="/products">상품 보기</Link>

<button type="button" onClick={openModal}>
  필터 열기
</button>
```

Bad:

```tsx
<div onClick={() => router.push('/products')}>상품 보기</div>
```

Button rules:

- always specify `type`
- use `type="button"` unless the button submits a form
- icon-only buttons need an accessible name

```tsx
<button type="button" aria-label="메뉴 열기">
  <MenuIcon aria-hidden="true" />
</button>
```

---

## 8. Accessibility Rules

### ARIA

Prefer native HTML over ARIA.

Do not add redundant roles:

```tsx
<button role="button">저장</button>
<nav role="navigation">...</nav>
```

Use ARIA only when HTML alone is not enough:

- icon-only button labels
- distinguishing multiple landmarks
- connecting descriptions/errors
- custom widgets that need state

### Language

- code identifiers: English
- user-facing text: product language
- Korean UI means Korean `alt`, `aria-label`, error messages, button text
- set document language

```tsx
<html lang="ko">
```

### Forms

Every input needs a label.  
Placeholder is not a label.

Good:

```tsx
<label htmlFor="email">이메일</label>
<input id="email" name="email" type="email" />
```

Bad:

```tsx
<input placeholder="이메일" />
```

Connect help/error text when needed:

```tsx
<label htmlFor="password">비밀번호</label>
<input id="password" aria-describedby="password-help password-error" />
<p id="password-help">8자 이상 입력하세요.</p>
<p id="password-error">비밀번호가 너무 짧습니다.</p>
```

### Keyboard

Core flows must work without a mouse.

Check:

- Tab order
- Shift+Tab reverse order
- Enter/Space activation
- visible focus
- modal focus movement
- ESC close where expected

Do not remove focus outlines globally.

Bad:

```scss
*:focus {
  outline: none;
}
```

Good:

```scss
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

---

## 9. Interaction Patterns

For custom widgets, follow established accessibility patterns.

### Modal/Dialog

Must handle:

- focus moves into modal on open
- focus returns to trigger on close
- ESC closes when appropriate
- background content is not accidentally focusable
- title/description are connected when needed

### Dropdown/Menu

Must handle:

- opened by a button
- open state is conveyed
- keyboard behavior works
- do not fake menus with inaccessible divs

### Tabs

Must handle:

- tab list / tab / panel structure
- selected state
- keyboard navigation when implemented as real tabs

### Accordion

Must handle:

- header trigger is a button
- expanded state is conveyed
- panel relationship is clear

---

## 10. TypeScript Rules

Use strict TypeScript.

Rules:

- `strict: true`
- avoid `any`
- prefer `unknown` over `any` when shape is uncertain
- minimize `as`
- validate/parsing API responses at boundaries
- do not ignore type errors for production builds

Props:

```tsx
type Props = {
  title: string;
  isOpen?: boolean;
  onClose?: () => void;
};
```

Boolean prop names:

- `isOpen`
- `isLoading`
- `hasError`
- `canSubmit`
- `shouldRender`

Event handler names:

- internal: `handleClick`, `handleSubmit`, `handleChange`
- props: `onClick`, `onSubmit`, `onClose`

---

## 11. SCSS Modules Styling Rules

Use `.module.scss` by default for component styles.

Rules:

- component styles must be local
- global styles are only for reset, root variables, base typography, limited utilities
- do not style features/components from `globals.scss`
- use `@use`, not `@import`
- avoid `id` selectors
- avoid deep DOM-dependent selectors
- do not recreate old global SCSS nesting patterns

Import shared SCSS resources with `@use`:

```scss
@use '@/styles/abstracts/breakpoints' as *;
@use '@/styles/abstracts/mixins' as *;
```

### Class naming

Use short role-based names.

Common names:

- `.root`
- `.inner`
- `.heading`
- `.title`
- `.description`
- `.actions`
- `.list`
- `.item`
- `.media`
- `.image`
- `.meta`

Top-level component element should usually use `.root`.

```tsx
<section className={styles.root}>
  ...
</section>
```

Do not use long BEM by default.  
CSS Modules already scope class names.

### Nesting

Keep SCSS mostly flat.  
Maximum nesting depth: 2 levels.

Good:

```scss
.root {
  padding: 72px 0;
}

.heading {
  margin-bottom: 24px;
}

.title {
  font-size: 36px;
}
```

Allowed when useful:

```scss
.card {
  .title {
    margin-bottom: 8px;
  }
}
```

Bad:

```scss
.root {
  .inner {
    .contents {
      .heading {
        .title {
        }
      }
    }
  }
}
```

### Responsive styles

Place media queries near the bottom of the file and keep them flat.

```scss
.root {
  padding: 72px 0;
}

.title {
  font-size: 36px;
}

@media (max-width: $tablet) {
  .root {
    padding: 8vw 0;
  }
}

@media (max-width: $mobile) {
  .title {
    font-size: 28px;
  }
}
```

Do not repeat deep DOM paths inside media queries.

---

## 12. Tokens

Use SCSS variables for static design constants.

Good for SCSS variables:

- breakpoints
- spacing scale
- radius scale
- typography scale
- z-index
- mixin values

Use CSS custom properties for runtime/theme values.

Good for CSS variables:

- colors
- themes
- runtime layout values
- light/dark switching

Example:

```scss
:root {
  --color-text: #111111;
  --color-bg: #ffffff;
  --color-primary: #0f766e;
  --page-max-width: 1200px;
}
```

Rule:

- static design constants: SCSS variables
- runtime/theme values: CSS custom properties

---

## 13. Layout Components

Use shared layout components instead of repeating wrapper styles.

Example:

```tsx
import styles from './PageContainer.module.scss';

type Props = {
  children: React.ReactNode;
};

export function PageContainer({ children }: Props) {
  return <div className={styles.root}>{children}</div>;
}
```

```scss
.root {
  width: min(100% - 40px, var(--page-max-width));
  margin: 0 auto;
}
```

Rules:

- put shared layout in `components/layout`
- do not make each feature redefine `.inner` / `.contents`
- features should focus on their own section structure

---

## 14. Asset Structure

Use `public/assets` for common static assets.

```txt
public/
  assets/
    images/
      common/
      home/
      product/
      brand/
      og/
    icons/
      common/
      brands/
      payment/
    logos/
      brand/
      partners/
    illustrations/
      empty/
      onboarding/
    lottie/
    favicons/
```

Rules:

- images, icons, logos, illustrations must not be mixed randomly
- organize by type and domain/purpose
- keep only web-delivery assets in the repo
- keep PSD/AI/Figma/source originals outside the code repo

---

## 15. Asset Naming

Use English lowercase kebab-case.

Good:

```txt
hero-main-desktop.webp
hero-main-mobile.webp
product-card-placeholder.avif
icon-arrow-right.svg
logo-partner-stripe.svg
```

Bad:

```txt
img1.png
banner_final_final_v2.jpg
2026-new-main-copy-3.png
```

Recommended patterns:

```txt
[domain]-[purpose]-[variant].[ext]
[type]-[name]-[state].[ext]
```

Examples:

```txt
home-hero-desktop.webp
home-hero-mobile.webp
product-thumbnail-default.webp
product-thumbnail-hover.webp
icon-chevron-down.svg
icon-close-circle.svg
```

Do not use:

- `final`
- `final-final`
- `last`
- `new`
- `real-final`

Git handles version history. File names should describe purpose.

---

## 16. Image Format Rules

Choose format by asset type.

### SVG

Use for:

- icons
- logos
- simple illustrations
- vector UI graphics

Clean external SVGs:

- remove unnecessary metadata
- review inline fill/stroke
- check fixed width/height
- check id collisions
- prefer `currentColor` when styling is needed

### WebP

Default for:

- web photos
- banners
- thumbnails
- product images

### AVIF

Use when:

- stronger compression is useful
- workflow supports it
- encoding cost is acceptable

Do not blindly force AVIF everywhere.

### PNG

Use only when:

- bitmap transparency is required
- alpha channel matters
- raster sticker/badge style is unavoidable

Avoid PNG for normal photos and large banners.

### JPG

Use mainly for:

- legacy assets
- original/source compatibility
- external system inputs

Prefer WebP/AVIF for new web-delivery assets.

### GIF

Avoid for most animation.  
Consider MP4, WebM, Lottie, APNG, or animated WebP.

---

## 17. Next.js Image Rules

Use `next/image` by default for meaningful web images.

### Known dimensions

```tsx
<Image
  src="/assets/images/product/product-cover.webp"
  alt="검은색 백팩 정면 이미지"
  width={1200}
  height={900}
/>
```

Rules:

- provide `width`/`height` when known
- CSS may control rendered size
- dimensions help preserve aspect ratio and layout stability

### Fill image

Use `fill` with a positioned parent and `sizes`.

```tsx
<div className={styles.media}>
  <Image
    src="/assets/images/home/hero-main-desktop.webp"
    alt="서비스 메인 화면 예시"
    fill
    sizes="(max-width: 767px) 100vw, (max-width: 1200px) 50vw, 600px"
    className={styles.image}
  />
</div>
```

```scss
.media {
  position: relative;
  aspect-ratio: 4 / 3;
}

.image {
  object-fit: cover;
}
```

Rules:

- `fill` requires parent sizing
- `fill` should usually include `sizes`
- do not let browsers download unnecessarily large images

### Priority

Use `priority` only for real LCP candidates:

- first-view hero image
- critical above-the-fold visual

Do not add priority to many images.

---

## 18. Image Meaning and Alt

Classify every image.

### Meaningful image

Use descriptive alt.

```tsx
<Image
  src="/assets/images/product/product-cover.webp"
  alt="검은색 가죽 백팩의 정면 모습"
  width={1200}
  height={900}
/>
```

Rules:

- describe the meaning, not the file name
- avoid redundant words like “image” or “photo”
- avoid repeating adjacent text unnecessarily

### Decorative image

Prefer CSS background or pseudo element.

```scss
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: url('/assets/illustrations/onboarding/bg-glow.svg') no-repeat center / cover;
  pointer-events: none;
}
```

If rendered as image:

```tsx
<Image src="/assets/images/common/decor-wave.webp" alt="" width={800} height={200} />
```

---

## 19. Aspect Ratio and Object Fit

Use `aspect-ratio` by default.  
Do not use `padding-bottom` ratio hacks unless maintaining legacy code.

```scss
.media {
  position: relative;
  aspect-ratio: 4 / 3;
}

.image {
  object-fit: cover;
}
```

Choose `object-fit` by intent:

- `cover`: fill box, crop allowed
- `contain`: show full image
- `fill`: distortion allowed; rare

Common choices:

- card thumbnails: `cover`
- hero images: `cover`
- logos/product cutouts: `contain`

---

## 20. Icons

Prefer icon libraries or React SVG components.

Priority:

1. React icon component
2. inline SVG component
3. static SVG file
4. PNG icon only as exception

Use icon libraries for common UI icons when possible.

Rules:

- icon-only buttons need accessible name
- icon with visible text should usually be `aria-hidden`
- use consistent sizes: 12, 16, 20, 24, 32
- do not mix logos with UI icons

Examples:

```tsx
<button type="button" aria-label="닫기">
  <XIcon aria-hidden="true" />
</button>
```

```tsx
<button type="button">
  <DownloadIcon aria-hidden="true" />
  다운로드
</button>
```

Logos belong in `public/assets/logos`, not icons.

---

## 21. Naming Rules

### Code identifiers

Use English.

- files
- folders
- components
- variables
- functions
- types
- CSS classes

### Component files

Prefer:

```txt
Button.tsx
Button.module.scss
ProductGallery.tsx
ProductGallery.module.scss
```

### Avoid vague names

Avoid:

- `Box`
- `Wrapper`
- `Thing`
- `Common`
- `UtilComponent`

Use names that reveal role or domain.

---

## 22. Lint, Typecheck, and Validation

Before considering work complete, prefer:

```bash
npm run lint
npm run typecheck
```

or:

```bash
npx tsc --noEmit
```

Rules:

- do not ignore TypeScript errors
- do not bypass ESLint casually
- add or preserve accessibility lint rules when configured
- do not rely on production build as the only validation step

Use narrower validation for changed files/tests when full validation is expensive.

---

## 23. Production Checks

Before finalizing UI work, check:

- semantic tags
- heading order
- link/button distinction
- form labels
- alt text
- icon button labels
- keyboard navigation
- visible focus
- responsive layout
- image sizing and `sizes`
- no unnecessary `use client`
- no global style leakage
- no deep SCSS nesting
- no `any` unless justified

---

## 24. Anti-Patterns

Do not do these:

```tsx
<div onClick={openModal}>열기</div>
```

```tsx
<input placeholder="이메일" />
```

```tsx
<button>
  <CloseIcon />
</button>
```

```tsx
<div className={styles.title}>상품 목록</div>
```

```scss
*:focus {
  outline: none;
}
```

```scss
#brand_features {
  .inner {
    .contents {
      .heading {
        .title {
        }
      }
    }
  }
}
```

```tsx
<Image src="/product.webp" alt="" width={1200} height={900} />
```

```txt
banner_final_final_v2.jpg
```

---

## 25. Final Rule Summary

Follow these rules by default:

1. Use semantic HTML before styling or ARIA.
2. Use `Link/a` for navigation and `button` for actions.
3. Keep `page.tsx` thin.
4. Put domain UI in `features`, reusable UI in `components`.
5. Use Server Components by default and minimize `use client`.
6. Keep state local unless URL/global state is justified.
7. Use TypeScript strict patterns and avoid `any`.
8. Use `.module.scss` for component styles.
9. Keep global styles minimal.
10. Use `.root` as the top-level component class.
11. Keep SCSS flat; max nesting depth is 2.
12. Use `@use`, not `@import`.
13. Put responsive rules at the bottom of SCSS files.
14. Use `PageContainer` or layout components for shared layout width.
15. Use `next/image` for meaningful images.
16. Use `aspect-ratio`, not padding hacks.
17. Use meaningful alt for content images and `alt=""` for decorative images.
18. Use SVG/icon components for icons.
19. Use English kebab-case for asset file names.
20. Validate with lint/typecheck before finalizing.
