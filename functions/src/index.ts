import { setGlobalOptions } from 'firebase-functions/v2';

// Phase 3-A 비용 폭주 가드 — 모든 함수가 본 default를 받는다.
// 각 함수가 추가 override할 수 있지만, 출발선에서 안전한 값으로 잠근다.
// region: 한국 사용자 baseline → 서울. minInstances: 0 (idle 청구 차단).
// maxInstances: 무한루프/retry 폭주 시 동시 실행 cap. timeout/memory 최소화.
setGlobalOptions({
  region: 'asia-northeast3',
  minInstances: 0,
  maxInstances: 5,
  timeoutSeconds: 30,
  memory: '256MiB',
});

export { react } from './reactions/react';
export {
  createMockPayment,
  completeMockPayment,
  cancelMockSubscription,
} from './payments/checkout';
