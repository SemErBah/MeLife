import { firebaseEnabled } from '../../firebase';
import * as remote from './firestoreService';
import * as local from './localFinance';

/** Firebase varsa Firestore, demo modunda yerel depo — aynı arayüz */
export const api = (firebaseEnabled ? remote : local) as unknown as typeof remote;
