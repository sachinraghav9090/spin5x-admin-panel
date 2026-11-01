import { create } from 'zustand';
import { auth, db } from '../firebase/config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const isLocalhost = Boolean(
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
);

const LOCAL_ADMIN = {
  uid: 'local-admin-dev',
  email: 'admin@spin5x.com',
  role: 'admin',
  name: 'Local Admin (Dev Mode)',
  photoURL: null,
};

const isRecognizedAdminEmail = (email) => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return (
    e === 'admin@spin5x.com' ||
    e === 'tarunvip934@gmail.com' ||
    e.endsWith('@spin5x.com')
  );
};

export const useAuthStore = create((set, get) => ({
  user: isLocalhost ? LOCAL_ADMIN : null,
  loading: false,
  initialized: isLocalhost,

  login: async (email, password) => {
    set({ loading: true });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const userEmail = (firebaseUser.email || email).toLowerCase();

      const userRef = doc(db, 'Users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      let userData = userDoc.data();

      const isConfigured = isRecognizedAdminEmail(userEmail);

      if (!userData?.isAdmin && !userData?.role?.includes('admin')) {
        if (isConfigured) {
          try {
            await setDoc(
              userRef,
              {
                uid: firebaseUser.uid,
                email: userEmail,
                name: firebaseUser.displayName || 'Spin5X Admin',
                isAdmin: true,
                role: 'admin',
                updatedAt: new Date(),
              },
              { merge: true }
            );
            userData = {
              isAdmin: true,
              role: 'admin',
              name: firebaseUser.displayName || 'Spin5X Admin',
            };
          } catch (e) {
            console.warn('Could not auto-grant admin doc:', e);
          }
        }
      }

      if (!userData?.isAdmin && userData?.role !== 'admin' && !isLocalhost && !isConfigured) {
        await signOut(auth);
        throw new Error('Access denied. Admin privileges required (isAdmin: true).');
      }

      const adminUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || email,
        role: 'admin',
        name: userData?.name || 'Admin',
        photoURL: firebaseUser.photoURL || null,
      };

      set({ user: adminUser, loading: false, initialized: true });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await signOut(auth);
      set({ user: isLocalhost ? LOCAL_ADMIN : null, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  initialize: async () => {
    if (get().initialized && isLocalhost) return;

    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          set({ user: isLocalhost ? LOCAL_ADMIN : null, initialized: true });
          resolve();
        }
      }, 3000);

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'Users', firebaseUser.uid));
            const userData = userDoc.data();
            const isConfigured = isRecognizedAdminEmail(firebaseUser.email);

            if (userData?.isAdmin || userData?.role === 'admin' || isLocalhost || isConfigured) {
              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  role: 'admin',
                  name: userData?.name || 'Admin',
                  photoURL: firebaseUser.photoURL || null,
                },
                initialized: true,
              });
            } else {
              await signOut(auth);
              set({ user: isLocalhost ? LOCAL_ADMIN : null, initialized: true });
            }
          } catch (error) {
            console.error('Auth init error:', error);
            set({ user: isLocalhost ? LOCAL_ADMIN : null, initialized: true });
          }
        } else {
          set({ user: isLocalhost ? LOCAL_ADMIN : null, initialized: true });
        }
        unsubscribe();
        resolve();
      });
    });
  },
}));
