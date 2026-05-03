import type { SerializedError } from '@reduxjs/toolkit';

// RTK Query store에 들어가는 error 값은 plain serializable object여야 한다.
// FirebaseError 같은 Error 인스턴스를 그대로 넣으면 직렬화 검사 경고
// (`A non-serializable value was detected in the state ...`)가 발생하므로
// queryFn의 catch에서는 본 헬퍼로 정규화한 뒤 반환한다.
export const serializeError = (error: unknown): SerializedError => {
  if (error instanceof Error) {
    const candidateCode = (error as { code?: unknown }).code;
    const code = typeof candidateCode === 'string' ? candidateCode : undefined;
    return {
      name: error.name,
      message: error.message,
      ...(code ? { code } : {}),
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'Unknown error' };
};

// 사전 검증 실패(uid 없음, 한도 초과 등)를 SerializedError로 표현할 때 사용.
// `code` 문자열 하나만으로 호출부에서 분기할 수 있도록 한다.
export const errorWithCode = (code: string, message?: string): SerializedError => ({
  name: 'AppError',
  code,
  message: message ?? code,
});
