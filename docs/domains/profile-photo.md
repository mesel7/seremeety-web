# 프로필 / 사진 — seremeety-web

> 프로필 작성(`Profile` 상태 머신)과 다중 사진 관리(별도 `profilePhotos` 1:N 컬렉션)를 담당하는 서브시스템. 클라이언트가 압축·크롭·Storage 직접 업로드를 하고, 신규 사진은 `pending`으로 시작해 admin 검수를 거친다.
>
> 관련 문서:
> - [`architecture.md`](../architecture.md) — 전체 구조 / RTK Query / 권한 경계
> - [`data-model.md`](../data-model.md) — 컬렉션·필드 정의
> - [`auth-onboarding.md`](./auth-onboarding.md) — 가입 흐름 / onboardingStatus 전이
> - [`admin.md`](./admin.md) — 통합 검수 큐 상세

---

## 1. 개요

프로필 도메인은 두 개의 신규 컬렉션을 중심으로 한다.

- **`profiles/{profileId}`** — 한 사용자당 1개. `nickname`, `birthYear/Month/Day`, `gender`, `location/locationDistrict`, `bio`, `mbti`, `university`, `mainPhotoId` 등 프로필 정보와 상태(`draft → pending → approved/rejected`)를 담는다.
- **`profilePhotos/{photoId}`** — 한 사용자당 최대 6장. 사진마다 `order`, `isMain`, `status`(`uploading | pending | approved | rejected | deleted`), `rejectionReason`을 개별 제어한다.

사진을 `profiles` 도큐먼트의 배열로 끼워넣지 않고 **별도 컬렉션으로 1:N 모델링**한 것이 핵심 결정이다. 사진마다 승인 상태·순서·메인 여부를 독립적으로 다뤄야 하기 때문이다.

기존 페이지(`MatchingPage`, 레거시 `ProfilePage` 등)는 아직 `users.profilePictureUrl`, `users.nickname`을 직접 참조한다. 그래서 신규 `Profile`/`ProfilePhoto`를 쓸 때마다 **`legacyBridge`로 `users.*`에 dual-write**해 호환성을 유지한다.

> 분석 시점 기준, `Profile`/`ProfilePhoto` 타입은 `ProfileStepPage`, `PhotoStepPage`, `ProfilePhotosManager`, `ProfilePage` 등 다수 컴포넌트에서 적극적으로 import해 사용 중이다. (DATA_MODEL의 "아직 어떤 컴포넌트도 import하지 않는다"는 서술은 stale.)

---

## 2. 핵심 흐름

### 2.1 프로필 작성 (온보딩 STEP 1)

[ProfileStepPage](../../src/features/onboarding/ProfileStepPage.tsx)에서 닉네임(2~12자, `onBlur` 중복 검사), 생년월일([DatePicker](../../src/shared/components/common/date-picker/DatePicker.tsx), 18~80세), 성별, 지역/세부지역, MBTI, 대학교, 자기소개를 입력한다. 저장 시 `createDraftProfile` 또는 `updateProfile`을 호출하고, 동시에 `writeProfileToLegacyUser`로 `users.*`를 갱신한다.

### 2.2 사진 업로드 / 관리

사진 1장 업로드의 공통 파이프라인:

```
파일 선택
  → compressImage()          # browser-image-compression, maxSizeMB:1 / maxWidthOrHeight:1024
  → CropperModal             # react-cropper, 1:1 비율 강제, jpeg 출력
  → dataURLToFile()          # canvas dataURL → File
  → compressImage()          # 크롭 결과 재압축
  → uploadImageToStorage()   # Firebase Storage 직접 업로드 (uploadBytesResumable)
  → createProfilePhoto()     # Firestore profilePhotos 도큐먼트, status='pending' 강제
  → (첫 사진이면) writePhotoToLegacyUser()  # users.profilePictureUrl 동기화
```

- **온보딩 STEP 2** [PhotoStepPage](../../src/features/onboarding/PhotoStepPage.tsx): 메인 사진 1장 **필수**. 첫 사진은 `isMain=true`로 생성.
- **마이페이지** [ProfilePhotosManager](../../src/features/profile/components/photos/ProfilePhotosManager.tsx): 최대 6장 그리드 관리. 첫 사진 자동 메인화(`isFirstPhoto`), 신규 사진은 `order = max(order)+1`.

### 2.3 메인 지정 / 삭제

- **메인 변경**: `handleSetMain` → `setMainProfilePhoto(userId, photoId)`가 `writeBatch` 한 번으로 선택 사진은 `isMain=true`, 기존 메인은 `false`로 동시 갱신. 이어서 `writePhotoToLegacyUser`로 `profilePictureUrl` 갱신. (단, `rejected` 사진은 메인 지정 불가.)
- **삭제**: `softDeleteProfilePhoto` → `status='deleted'`, `isMain=false`로만 표시(물리 삭제 안 함). 메인을 삭제했고 남은 사진이 있으면 첫 비삭제 사진을 자동 메인 승격하고, 모두 삭제되면 레거시 `profilePictureUrl`을 공란으로 갱신.

### 2.4 Admin 검수 (승인 / 반려)

검수는 사용자 단위 통합 큐 [AdminProfilesPage](../../src/features/admin/AdminProfilesPage.tsx) (`/admin/profiles`)가 주 흐름이다. `getReviewQueue`가 pending 프로필과 사진 보유 사용자를 합쳐 한 카드에 프로필 정보 + 그 사용자의 모든 사진을 보여준다.

| 액션 | 처리 | 결과 |
|---|---|---|
| **승인** (`approveProfile`) | `profile.status='approved'` + `approvePendingPhotosForUser`(pending 사진 일괄 `approved`) + `writeProfileStatusToLegacyUser` | `onboardingStatus='approved'` → 추천 진입 |
| **반려** (`rejectProfile`) | 프로필이 pending이면 `status='rejected'`, 이미 approved면 status 유지하고 reason만 갱신 | `onboardingStatus='review_rejected'` → [RejectedPage](../../src/features/onboarding/RejectedPage.tsx) |

### 2.5 프로필 완성도 (UI 표시용)

[calculateProfileCompleteness](../../src/shared/lib/profileCompleteness.ts)가 `profile + photos`로 0~100점을 계산한다. 이 점수는 순수 표시용이며, 실제 추천 노출 권한은 `onboardingStatus='approved'`로만 판단한다.

| 항목 | 가중치 |
|---|---|
| `nickname` / `birthYear` / `location` / `bio`(30자 이상) | 각 10 |
| `mbti` / `university` | 각 5 |
| 메인 사진 | 30 |
| 추가 사진 | 1장당 5, 최대 20 |

부족한 항목은 `missing` 배열로 반환되어 [MyProfilePreview](../../src/features/profile/components/mypage/MyProfilePreview.tsx)에서 안내된다.

---

## 3. 주요 파일

| 파일 | 역할 |
|---|---|
| [model/photo.ts](../../src/shared/types/model/photo.ts) | `PhotoStatus`, `ProfilePhoto` 인터페이스(`storagePath`, `displayUrl`, `order`, `isMain`, `status`, `rejectionReason` 등) |
| [model/profile.ts](../../src/shared/types/model/profile.ts) | `Profile`, `ProfileStatus`, `Gender`, `SmokingHabit`, `DrinkingHabit`, `DatingIntent` |
| [firebase/profilePhotos.ts](../../src/shared/lib/firebase/profilePhotos.ts) | 사진 Firestore 헬퍼. `getProfilePhotosByUserId`(userId 필터 후 클라 정렬), `createProfilePhoto`, `setMainProfilePhoto`(writeBatch), `softDeleteProfilePhoto`, `approvePendingPhotosForUser`, `MAX_PROFILE_PHOTOS=6` |
| [firebase/profiles.ts](../../src/shared/lib/firebase/profiles.ts) | 프로필 Firestore 헬퍼. `getProfileByUserId`, `getProfilesByStatus`, `createDraftProfile`, `updateProfile` |
| [lib/media.ts](../../src/shared/lib/media.ts) | `compressImage`(1MB/1024px), `dataURLToFile`, `uploadImageToStorage`(Storage resumable 직접 업로드) |
| [api/photoApi.ts](../../src/shared/lib/api/photoApi.ts) | RTK Query. `getProfilePhotos`(read 전용, `Photo` 태그 캐싱). mutation은 매니저가 직접 firebase 호출 후 태그 invalidate |
| [api/profileApi.ts](../../src/shared/lib/api/profileApi.ts) | RTK Query. `getMe`, `getPublicProfile`, `updateMe`(`profilePictureUrl`이 `data:`면 압축/업로드) |
| [lib/profileCompleteness.ts](../../src/shared/lib/profileCompleteness.ts) | 완성도 0~100 계산, `missing` 반환 |
| [firebase/legacyBridge.ts](../../src/shared/lib/firebase/legacyBridge.ts) | dual-write 어댑터. `writeProfileToLegacyUser`, `writePhotoToLegacyUser`, `writeProfileStatusToLegacyUser` |
| [ProfilePhotosManager.tsx](../../src/features/profile/components/photos/ProfilePhotosManager.tsx) | 사진 관리 UI. 선택→크롭→업로드→메인/삭제, 자동 승격, dual-write 호출 |
| [CropperModal.tsx](../../src/shared/components/common/cropper/CropperModal.tsx) | react-cropper 1:1 강제, jpeg 0.85 품질 canvas→dataURL |
| [DatePicker.tsx](../../src/shared/components/common/date-picker/DatePicker.tsx) | YYYY-MM-DD, min/max 제약, 외부 라이브러리 없는 순수 구현 |
| [ProfileStepPage.tsx](../../src/features/onboarding/ProfileStepPage.tsx) | 온보딩 STEP 1 — 프로필 입력 / 닉네임 중복 검사 |
| [PhotoStepPage.tsx](../../src/features/onboarding/PhotoStepPage.tsx) | 온보딩 STEP 2 — 메인 사진 1장 필수 업로드 |
| [MyProfilePage.tsx](../../src/features/profile/MyProfilePage.tsx) | 마이페이지 편집. `ProfilePhotosManager` + 폼, 첫 저장 시 상태 0→1 안내, 추천 캐시 무효화 |
| [ProfilePage.tsx](../../src/features/profile/ProfilePage.tsx) | 타 사용자 열람. 메인 사진 + approved 추가 사진, `selectFromResult` 리렌더 최적화 |
| [MyProfilePreview.tsx](../../src/features/profile/components/mypage/MyProfilePreview.tsx) | 미리보기 + 완성도 표시 |
| [adminApi.ts](../../src/shared/lib/api/adminApi.ts) | `getReviewQueue`, `approveProfile`, `rejectProfile`, `approvePhoto`, `rejectPhoto` |
| [AdminProfilesPage.tsx](../../src/features/admin/AdminProfilesPage.tsx) | 사용자 단위 통합 검수 카드 |
| [data/universities.ts](../../src/shared/data/universities.ts) | 대학교 정적 목록(Select 검색 옵션) |

---

## 4. 데이터·상태

### 컬렉션 구조

| 위치 | 내용 |
|---|---|
| Firebase Storage | `/profile_pictures/{userId}` — 업로드 대상. `getDownloadURL`로 `displayUrl` 취득 |
| Firestore `profilePhotos/{photoId}` | 메타데이터(`storagePath`, `displayUrl`, `order`, `isMain`, `status` …) |
| Firestore `profiles/{profileId}` | 프로필 정보 + `mainPhotoId` 참조 |
| Legacy `users/{uid}.profilePictureUrl` | dual-write 동기화 대상 |

> **Storage 경로 주의**: 실제 코드의 Storage ref는 파일명 segment 없이 `/profile_pictures/{userId}` 한 경로다([media.ts](../../src/shared/lib/media.ts) L28). 즉 한 사용자의 모든 업로드가 동일 객체를 덮어쓰며, `profilePhotos` 도큐먼트의 `storagePath`도 같은 값으로 기록된다. 사진별 `displayUrl`은 각 업로드 시점의 `getDownloadURL` 결과라 도큐먼트 단위로는 구분되지만, Storage 객체 자체는 사용자당 1개로 수렴한다(아래 §6 위험 참고).

### 사진 상태 머신

```
uploading → pending → approved
                   ↘ rejected
(언제든) → deleted   (soft delete)
```

신규 사진은 `createProfilePhoto`에서 `status='pending'`이 **강제**된다(클라이언트가 임의로 approved를 넣을 수 없음). admin 검수 전까지 추천 대상에서 제외된다.

### 조회 전략

`getProfilePhotosByUserId`는 Firestore composite index를 피하려고 **`where('userId')`만 서버 필터**하고, `status !== 'deleted'` 필터와 `order` 정렬은 메모리에서 처리한다. 사진 수가 사용자당 최대 6장이라 비용 부담이 작다.

### RTK Query 캐싱

`photoApi`는 read 전용(`getProfilePhotos`, `Photo` 태그, `keepUnusedDataFor: 300`). 사진 mutation(생성/메인 변경/삭제)은 `ProfilePhotosManager`가 firebase 헬퍼를 직접 호출하고 매니저 로컬 state를 `refresh()`로 갱신하며, 다른 소비자(`MyProfilePreview` 완성도, `ProfilePage` 추가 사진)를 위해 `Photo` 태그를 invalidate한다.

---

## 5. 설계 결정과 트레이드오프

| 결정 | 이유 | 트레이드오프 |
|---|---|---|
| **별도 `profilePhotos` 컬렉션**(1:N) | 사진마다 승인 상태·순서·메인 여부를 개별 제어해야 함. 배열 끼워넣기는 트랜잭션 복잡화 | 조회 시 2쿼리 필요. 단 사진 수가 작아 영향 미미 |
| **클라이언트 → Storage 직접 업로드**(Functions 미사용) | 단순 이미지 저장이라 검증 로직이 적고 네트워크 홉 절감 | 악의적 업로드 방어를 Storage Rules + admin 검수에만 의존. Phase 3에서 Functions 이관 예정 |
| **신규 사진 `pending` 시작** | 악용 방지, 검수 전 추천 비노출 | 첫 업로드 후 추천 진입까지 검수 대기 발생(초기 UX 답답) |
| **메인 지정 `writeBatch` 원자 처리** | 기존 메인 `false` + 선택 `true`를 동시 반영해 부분 반영 방지 | writeBatch 500 작업 한계 있으나 최대 6장이라 무관 |
| **크롭 1:1 비율 고정** | 프로필 사진 UI 일관성, 정사각형 표준화 | 사용자가 원하는 비율로 자를 수 없음(매칭 앱 관례상 일반적) |
| **사진 soft delete** | 과거 검수 기록/거부 사유 추적, 물리 삭제 방지 | Storage 용량 낭비 → Phase 11 cleanup job으로 해결 |
| **legacy `users.*` dual-write** | 기존 페이지가 `users.profilePictureUrl/nickname`을 직접 참조 | dual-write 일관성 위험(두 도큐먼트 사이 실패 가능). Phase 6 마이그레이션 후 폐기 |
| **완성도 계산 클라이언트 전용** | 표시용일 뿐, 권한은 `onboardingStatus`로만 판단. 계산식 변경 유연성 | 로직 이원화 — `MyProfilePreview`와 `profileCompleteness.ts` 동기화 필요 |
| **composite index 없이 클라 필터** | 사진 수가 작아 `userId` only 필터 후 메모리 정렬 | 대규모 사용자에게는 부담, MVP 기준 비용 효율적 |

---

## 6. 현재 상태

### 구현됨

- 프로필 기본 정보 입력(`nickname`, 생년월일, `gender`, `location`, `bio`, `mbti`, `university`)
- 닉네임 중복 검사(`onBlur`), 생년월일 `DatePicker`(18~80세)
- 이미지 압축(1MB/1024px) + Storage 직접 업로드
- 사진 크롭(1:1 강제, react-cropper)
- 다중 사진 최대 6장 관리(`order` / `isMain` / `status`)
- 메인 사진 지정(`writeBatch` 원자성), 메인 삭제 시 자동 승격
- 사진 soft delete(`status='deleted'`)
- 프로필 완성도 계산(0~100)
- Admin 통합 검수 큐(프로필 + 사진 합친 카드), 승인/반려 일괄 처리
- Legacy `users.*` dual-write(`profilePictureUrl` 동기화)
- RTK Query `photoApi`(read 전용 + 캐시 invalidation)
- 타 사용자 프로필 열람(메인 + approved 추가 사진)

### 남은 작업

- 클라이언트 write 검증을 Functions로 이관(Phase 3)
- 악의적 업로드 필터(이미지 스캔 / NSFW detection)
- Storage cleanup job(`deleted` 사진 물리 삭제, Phase 11)
- 사진별 부분 반려 사유 저장(`rejectionReason` per-photo UI)
- 업로드 진행률 표시(`uploadBytesResumable` progress 콜백 — 현재 콜백 미연결)
- 이미지 최적화(WebP / srcset)
- 완성도 서버 계산(client/server 싱크)
- 사진 순서 드래그&드롭 변경 UI

### 알려진 위험

- **dual-write 불일치**: `Profile` 저장과 `users` 업데이트 사이 실패 가능(Phase 6 제거 전까지).
- **Storage 경로 충돌**: `/profile_pictures/{userId}`가 파일명 없이 사용자당 단일 객체라, 신규 업로드가 이전 객체를 덮어쓴다. 여러 사진의 `storagePath`가 모두 같은 값이며, soft delete 후에도 객체가 1개로 수렴해 cleanup·식별이 어렵다. 실서비스에선 `randomId`/`timestamp` segment 추가 권장.
- **완성도 계산 이원화**: `MyProfilePreview`와 `profileCompleteness.ts` 로직 분산 → 동기화 필요.
- **업로드 timeout**: 느린 네트워크에서 resumable upload 타임아웃 처리 미흡.
- **검수 큐 확장성**: 대규모 pending 시 `getReviewQueue`의 `Promise.all`이 병목(페이징 미구현).
- **자동 승격 엣지**: 메인 삭제 직후 다른 클라이언트가 동시에 순서를 바꾸면 상태 불일치 가능.
- **composite index 부담**: 현재 `userId` 필터만 서버, `status`/`order`는 메모리 정렬. 규모 확대 시 revisit 필요.
