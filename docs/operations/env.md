# 환경변수 — seremeety-web

로컬 실행과 배포에 필요한 환경변수를 정리한다. 모든 클라이언트 노출 값은 `NEXT_PUBLIC_` 접두사를
가지며 번들에 포함된다(= 비밀이 아님). 실제 비밀(서버 키, service account)은 클라이언트 env에 두지 않는다.

## 1. 클라이언트 env (`.env.local`)

`.env.local`은 git에 커밋하지 않는다(`.gitignore`). 새 개발자는 아래 키를 Firebase 콘솔의
프로젝트 설정 → 일반 → "내 앱"(웹 앱)에서 복사해 채운다.

| 키 | 용도 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web SDK 초기화 | 공개 값(앱 식별용, 비밀 아님) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth 도메인 | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore/Storage 프로젝트 식별 | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 사진 업로드 버킷 | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender id | 현재 푸시 미사용 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 앱 식별자 | |
| `NEXT_PUBLIC_SITE_URL` | 절대 URL 생성 기준 | 배포 도메인(Vercel 프로덕션/커스텀 도메인) |

이 값들은 `src/firebase.ts`의 `initializeApp`에 주입된다.

## 2. 서버 / Functions 인증

Functions는 런타임에서 service account를 자동 주입받으므로 별도 env가 필요 없다. 로컬에서 admin
스크립트(`functions/scripts/grant-admin.mjs`)나 배포를 실행할 때만 ADC(Application Default Credentials)가
필요하다.

```bash
gcloud auth application-default login
# 또는 service account JSON 경로 지정
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

`firebase deploy`가 동작하는 환경이면 위 조건은 이미 충족된 상태다.

## 3. 실운영 전 추가될 env (현재 미사용)

| 키(예시) | 추가 시점 | 비고 |
|---|---|---|
| PG사 API 키/시크릿 | 결제 실연동(Phase 9 이후) | **서버 전용** — 클라이언트 env 금지 |
| 본인확인 API(NICE/KMC/PASS) 키 | 본인확인 실연동 | **서버 전용**, CI/DI 저장 정책 확정 후 |
| 모니터링/Sentry DSN | 운영 모니터링 도입 | |

> 비밀은 절대 `NEXT_PUBLIC_`으로 노출하지 않는다. PG/본인확인 시크릿은 Functions config(또는
> Secret Manager)에 둔다.
