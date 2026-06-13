import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, RecaptchaVerifier } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'demo.appspot.com',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '1:000000000000:web:demo',
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => value.startsWith('demo') || value === '000000000000')
  .map(([key]) => key);

if (missingConfig.length > 0 && typeof window !== 'undefined') {
  console.warn(
    `[firebase] Missing NEXT_PUBLIC Firebase env vars: ${missingConfig.join(', ')}. ` +
      'Add them to your environment before using auth, Firestore, or Storage.'
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Phase 3-A: Cloud Functions client. region은 functions/src/index.ts의
// setGlobalOptions와 일치해야 callable이 동일 endpoint를 가리킨다.
export const functions = getFunctions(app, 'asia-northeast3');

// LoginPage 가 mount 될 때마다 호출. 이전에 만들어진 RecaptchaVerifier 는
// container DOM이 사라진 상태이므로 (로그아웃 + 재진입 사이에 unmount 됨)
// 그대로 재사용하면 "reCAPTCHA client element has been removed" 에러를 낸다.
// 안전하게 항상 clear() 후 새 인스턴스 생성.
export const setupRecaptchaVerifier = (container: HTMLElement) => {
  if (typeof window === 'undefined' || !container) {
    return null;
  }

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch {
      // 이미 무효화된 verifier — 무시.
    }
    window.recaptchaVerifier = undefined;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, container, {
    size: 'invisible',
  });

  return window.recaptchaVerifier;
};

export const teardownRecaptchaVerifier = () => {
  if (typeof window === 'undefined') return;
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch {
      // pass
    }
    window.recaptchaVerifier = undefined;
  }
};
