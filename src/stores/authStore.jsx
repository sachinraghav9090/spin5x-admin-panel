import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '../firebase/config.jsx';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.jsx';

/** @typedef {Object} AdminUser
 * @property {string} uid
 * @property {string} email
 * @property {'admin'|'super_admin'} role
 * @property {string} [name]
 * @property {string} [photoURL]
 */

/** @typedef {Object} AuthState
 * @property {AdminUser|null} user
 * @property {boolean} loading
 * @property {boolean} initialized
 * @property {(email:string, password:string)=>Promise} login
 * @property {()=>Promise} logout
 * @property {()=>Promise} initialize
 * @property {()=>void} clearError
 */

export const useAuthStore = create()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      initialized: false,

      login: async (email, password) => {
        set({ loading: true });
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          // Check if user is admin in Firestore
          const userDoc = await getDoc(doc(db, 'Users', firebaseUser.uid));
          const userData = userDoc.data();
          
          if (!userData?.isAdmin) {
            await signOut(auth);
            throw new Error('Access denied. Admin privileges required.');
          }
          
          const adminUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || email,
            role: userData.isAdmin ? 'admin' : 'super_admin',
            name: userData.name,
            photoURL: firebaseUser.photoURL || undefined,
          };
          
          set({ user: adminUser, loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ loading: true });
        try {
          await signOut(auth);
          set({ user: null, loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      initialize: async () => {
        if (get().initialized) return;
        
        // If auth is not available (Firebase init failed), mark initialized so login page shows
        if (!auth) {
          console.error('Firebase auth not available, skipping auth initialization');
          set({ user: null, initialized: true });
          return;
        }
        
        return new Promise((resolve) => {
          let resolved = false;
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              console.warn('Auth initialization timeout, proceeding without auth');
              resolved = true;
              set({ user: null, initialized: true });
              resolve();
            }
          }, 5000);
          
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            
            if (firebaseUser) {
              try {
                const userDoc = await getDoc(doc(db, 'Users', firebaseUser.uid));
                const userData = userDoc.data();
                
                if (userData?.isAdmin) {
                  const adminUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    role: userData.isAdmin ? 'admin' : 'super_admin',
                    name: userData.name,
                    photoURL: firebaseUser.photoURL || undefined,
                  };
                  set({ user: adminUser, initialized: true });
                } else {
                  await signOut(auth);
                  set({ user: null, initialized: true });
                }
              } catch (error) {
                console.error('Auth initialization error:', error);
                set({ user: null, initialized: true });
              }
            } else {
              set({ user: null, initialized: true });
            }
            unsubscribe();
            resolve();
          });
        });
      },

      clearError: () => {
        // No error state to clear in this version
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({ 
        // Don't persist user - always re-verify with Firebase
      }),
    }
  )
);
