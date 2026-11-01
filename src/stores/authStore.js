import { create } from 'zustand';
import { auth, db } from '../firebase/config.js';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

/**
 * Strictly verifies whether a Firebase user has the Admin role:
 * 1. Document in Firestore: Users/{uid} has role === 'admin' or isAdmin === true
 * 2. Document in Firestore: AppConfig/main has user's email in adminEmails array
 */
export const checkFirebaseAdminRole = async (firebaseUser) => {
  if (!firebaseUser) return { isAdmin: false, userData: null };

  try {
    // 1. Check user profile document in Firestore Users/{uid}
    const userDoc = await getDoc(doc(db, 'Users', firebaseUser.uid));
    const userData = userDoc.data();
    if (userData?.role === 'admin' || userData?.isAdmin === true) {
      return { isAdmin: true, userData };
    }

    // 2. Check AppConfig/main adminEmails list
    const configDoc = await getDoc(doc(db, 'AppConfig', 'main'));
    const configData = configDoc.data();
    const adminEmails = (configData?.adminEmails || []).map((e) =>
      typeof e === 'string' ? e.toLowerCase().trim() : ''
    );

    const userEmail = (firebaseUser.email || '').toLowerCase().trim();
    if (userEmail && adminEmails.includes(userEmail)) {
      return {
        isAdmin: true,
        userData: userData || { role: 'admin', isAdmin: true, name: 'Admin' },
      };
    }

    return { isAdmin: false, userData };
  } catch (err) {
    console.error('Error verifying Firebase admin role:', err);
    return { isAdmin: false, userData: null };
  }
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

      const { isAdmin, userData } = await checkFirebaseAdminRole(firebaseUser);

      if (!isAdmin && !isLocalhost) {
        await signOut(auth);
        throw new Error(
          'Access denied. Only accounts with the "admin" role in Firebase can access this panel.'
        );
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

  loginWithGoogle: async () => {
    set({ loading: true });
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;

      const { isAdmin, userData } = await checkFirebaseAdminRole(firebaseUser);

      if (!isAdmin && !isLocalhost) {
        await signOut(auth);
        throw new Error(
          'Access denied. Your Google account does not have the "admin" role in Firebase.'
        );
      }

      const adminUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        role: 'admin',
        name: userData?.name || firebaseUser.displayName || 'Admin',
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
            const { isAdmin, userData } = await checkFirebaseAdminRole(firebaseUser);

            if (isAdmin || isLocalhost) {
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
            await signOut(auth).catch(() => {});
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
