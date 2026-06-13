import { signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';

// Onboarding 도중 사용자가 "가입 그만두기"를 누르면 본 함수가 실행된다.
// 사용자가 만든 onboarding 관련 데이터를 일괄 삭제하고 signOut.
//
// 의도적으로 firebase Auth 계정 자체는 삭제하지 않는다 (recent-login 요구사항 +
// SMS 인증 다시 받는 부담). 다음에 같은 번호로 로그인하면 fresh onboarding 진입.
//
// 삭제 범위:
//   - users/{uid}
//   - profiles where userId == uid
//   - profilePhotos where userId == uid
//   - preferences where userId == uid
//   - consents where userId == uid
//   - entitlements/{uid}
//   - identityVerifications/{uid}
// onboarding 단계에선 reactions/matches/blocks/reports/payments는 만들어지지
// 않으므로 범위 밖. (혹시라도 있다면 garbage로 남는데 다음 가입 시 새 doc id로
// 시작하므로 무해.)
export const cancelSignupAndSignOut = async (uid: string): Promise<void> => {
  const batch = writeBatch(db);

  // 단일 doc id 컬렉션 (uid를 doc id로 쓰는 것)
  batch.delete(doc(db, 'users', uid));
  batch.delete(doc(db, 'entitlements', uid));
  batch.delete(doc(db, 'identityVerifications', uid));

  // userId 필드로 다중 doc — query → batch.delete 또는 individual delete
  const queries = [
    query(collection(db, 'profiles'), where('userId', '==', uid)),
    query(collection(db, 'profilePhotos'), where('userId', '==', uid)),
    query(collection(db, 'preferences'), where('userId', '==', uid)),
    query(collection(db, 'consents'), where('userId', '==', uid)),
  ];
  const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
  for (const snap of snapshots) {
    snap.docs.forEach((d) => batch.delete(d.ref));
  }

  await batch.commit();

  // Storage 사진 파일 정리는 옵션. 비용 영향 미미 + storage 룰 미정이라 일단 생략.
  // (필요 시 추후 functions로 일괄 정리.)

  await signOut(auth);
};

// 단순 로그아웃 — 데이터는 그대로 두고 세션만 종료. 다음 로그인 시 같은 uid로
// 같은 onboarding step에 복귀.
export const onboardingSignOut = async (): Promise<void> => {
  await signOut(auth);
};

// 컴포넌트에서 import 안정성 유지를 위해 deleteDoc 직접 import 가능하게.
export { deleteDoc };
