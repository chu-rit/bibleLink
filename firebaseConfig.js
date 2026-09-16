import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 콘솔 > 프로젝트 설정 > 웹 앱에서 발급받은 값
const firebaseConfig = {
  apiKey: 'AIzaSyDqydTW5LRf1N7aTA57bf2T7eyJSWyQGaw',
  authDomain: 'biblelink-1e146.firebaseapp.com',
  projectId: 'biblelink-1e146',
  storageBucket: 'biblelink-1e146.firebasestorage.app',
  messagingSenderId: '637813667068',
  appId: '1:637813667068:web:c161e6c916df6a48015379',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app = null;
if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
