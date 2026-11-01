import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCfUEXoYzVFnC-B9Ewl2kqnD9XuGk278No',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'spin5x.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'spin5x',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'spin5x.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '478215987181',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:478215987181:web:148330f353a38ab88691e4',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
