# 실운영 전 체크리스트 — seremeety-web

이 프로젝트의 목표는 "지금 내가 즉시 운영하는 것"이 아니라, **외부 운영 주체가 아래 항목을 처리하면 곧장
실서비스 전환을 검토할 수 있는 수준의 제품 기반**을 만드는 것이다(자세한 배경은
[roadmap.md §1·§11](../roadmap.md)).

코드/기술 측면의 진행 상황과 남은 작업은 [status.md](../status.md)에 있다. 이 문서는 **코드만으로는 끝낼 수
없는, 운영 주체가 처리해야 하는 사업/법무/인프라 항목**을 모은다.

## 1. 사업 / 법무

- [ ] 사업자 등록 / 통신판매업 신고
- [ ] PG사·결제대행사 계약 (실결제 연동 — 현재는 mock)
- [ ] 이용약관 법무 검토 및 버전 관리(`consents.termsVersion`와 연결)
- [ ] 개인정보처리방침 법무 검토 (`consents.privacyVersion`와 연결)
- [ ] 한국 본인확인 API(NICE/KMC/PASS) 계약 및 CI/DI 저장 정책 확정
- [ ] 환불 정책 / 청약철회 규정

## 2. 운영 / CS

- [ ] 고객센터 채널(이메일/채팅) 및 응답 SLA
- [ ] 신고 대응 정책(처리 시한, 제재 기준, 재심 절차)
- [ ] 탈퇴 / 개인정보 삭제 요청 처리 절차
- [ ] 부적절 콘텐츠(프로필/사진) 검수 운영 인력 및 기준
- [ ] 미성년자 차단 / 연령 확인 정책(본인확인 연동과 연계)

## 3. 보안 / 인프라

- [ ] Firestore 규칙 collection별 lock 완료(현재 광범위 authenticated write — [functions-security](../domains/functions-security.md))
- [ ] admin 권한 검증을 서버(Custom Claims/Functions)로 이전(현재 클라이언트 가드 중심)
- [ ] PII read 규칙 self-only 제한(`preferences`/`consents`/`identityVerifications`)
- [ ] 결제/본인확인 시크릿을 Secret Manager로 관리(클라이언트 노출 금지)
- [ ] 모니터링 / 에러 추적(Sentry 등) / 알림
- [ ] 백업 정책(Firestore export 스케줄) 및 복구 절차
- [ ] 장애 대응 / 온콜 정책
- [ ] Hosting 빌드 산출물 정합성 확정([deployment.md §2](./deployment.md))

## 4. 표현 주의 (정직성 원칙)

- Firebase Phone Auth를 "실명 본인확인 완료"로 표현하지 않는다.
- mock 결제를 "실제 결제 준비 완료"로 표현하지 않는다.
- 법적으로 "운영 준비 완료"라고 단정하지 않는다.

> 이 체크리스트의 항목이 끝나야 비로소 실사용자 공개 운영을 검토할 수 있다. 현재 코드 기반은 그 전제 위에서
> 동작 검증이 가능한 수준이다.
