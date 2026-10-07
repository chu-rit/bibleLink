// 방향 잠금·해제는 비동기라 연속 호출 시 적용 순서가 뒤섞일 수 있어 큐로 직렬화한다
let orientationQueue = Promise.resolve();
let orientationSeq = 0;

// 화면 전환용: 아직 실행 전인 이전 요청은 건너뛰고 마지막 요청만 적용한다
export const enqueueOrientation = (task) => {
  const seq = ++orientationSeq;
  orientationQueue = orientationQueue.then(() => (seq === orientationSeq ? Promise.resolve().then(task).catch(() => false) : false));
  return orientationQueue;
};

// 버튼 등 사용자 조작용: 요청 순서대로 모두 적용한다
export const runOrientation = (task) => {
  orientationQueue = orientationQueue.then(task).catch(() => {});
  return orientationQueue;
};

export const lockOrientation = (orientation) => {
  try {
    const { OrientationLock, lockAsync, getOrientationLockAsync } = require('expo-screen-orientation');
    const target = orientation === 'LANDSCAPE' ? OrientationLock.LANDSCAPE : OrientationLock.PORTRAIT_UP;
    return enqueueOrientation(async () => {
      await lockAsync(target);
      return (await getOrientationLockAsync()) === target;
    });
  } catch {
    return Promise.resolve(false);
  }
};
