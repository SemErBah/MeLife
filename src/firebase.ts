import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore,
} from 'firebase/firestore';

/* MeLife, MeDebit'in Firebase projesini (medebit) kullanır: aynı hesap, aynı para verileri.
   Web config gizli değildir; erişimi Firestore kuralları korur. */
const firebaseConfig = {
  apiKey: 'AIzaSyAnMwKijzxP64hq7aik12DEQ6AeGim0bsI',
  authDomain: 'medebit.firebaseapp.com',
  projectId: 'medebit',
  storageBucket: 'medebit.firebasestorage.app',
  messagingSenderId: '291992185690',
  appId: '1:291992185690:web:9c3d5cbbca8aae09b4a163',
};

/** Geliştirme için: VITE_LOCAL_MODE=1 ile Firebase'e hiç bağlanmadan, veriler tarayıcıda tutularak çalışır. */
export const firebaseEnabled = import.meta.env.VITE_LOCAL_MODE !== '1';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Çevrimdışı önbellek: bağlantı yokken de tik atılır, gelince senkronlanır
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export { auth, db };
