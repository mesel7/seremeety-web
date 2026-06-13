// 최초 admin seed 스크립트.
// Firebase Admin SDK 로 직접 user doc 의 role 을 'admin' 으로 부여한다.
// 한 번만 사용 — 그 후의 admin 추가는 /admin/users 콘솔에서 권한 부여.
//
// 사용법:
//   cd functions
//   node scripts/grant-admin.mjs --phone +821012345678
//   node scripts/grant-admin.mjs --uid <firebase-auth-uid>
//   node scripts/grant-admin.mjs --uid <uid> --revoke   # 권한 회수
//
// 인증: Firebase Admin SDK 는 Application Default Credentials 를 사용.
//   - `gcloud auth application-default login` 한 상태이거나
//   - GOOGLE_APPLICATION_CREDENTIALS 환경변수가 service account JSON 경로를 가리켜야 함.
// firebase deploy 가 가능한 환경이면 보통 이미 충족됨.

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const parseArgs = (argv) => {
  const args = { phone: null, uid: null, revoke: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--phone') args.phone = argv[++i];
    else if (a === '--uid') args.uid = argv[++i];
    else if (a === '--revoke') args.revoke = true;
  }
  return args;
};

const main = async () => {
  const { phone, uid: argUid, revoke } = parseArgs(process.argv.slice(2));
  if (!phone && !argUid) {
    console.error('사용법: node scripts/grant-admin.mjs --phone +82... | --uid <uid> [--revoke]');
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp();
  }

  const auth = getAuth();
  const db = getFirestore();

  let uid = argUid;
  if (!uid) {
    try {
      const userRecord = await auth.getUserByPhoneNumber(phone);
      uid = userRecord.uid;
      console.log(`[grant-admin] phone ${phone} → uid ${uid}`);
    } catch (err) {
      console.error(`[grant-admin] phone ${phone} 으로 사용자를 찾지 못했어요.`);
      console.error(err.message);
      process.exit(1);
    }
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error(`[grant-admin] users/${uid} 문서가 없어요. 해당 사용자가 한 번이라도 앱에 로그인했는지 확인하세요.`);
    process.exit(1);
  }

  const targetRole = revoke ? 'user' : 'admin';
  const update = {
    role: targetRole,
    updatedAt: FieldValue.serverTimestamp(),
  };
  // admin 부여 시 onboarding 우회: 곧바로 /admin 진입 가능 상태.
  if (!revoke) {
    update.onboardingStatus = 'approved';
    update.status = 'active';
  }

  await userRef.update(update);
  console.log(`[grant-admin] users/${uid} role -> '${targetRole}' 로 업데이트했습니다.`);
  if (!revoke) {
    console.log('[grant-admin] onboardingStatus 도 approved 로 설정. 사용자가 다시 로그인하면 /admin 으로 진입합니다.');
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
