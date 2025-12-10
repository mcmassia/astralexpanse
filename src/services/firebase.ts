// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase config - will be loaded from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

export const initializeFirebase = () => {
    if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        googleProvider = new GoogleAuthProvider();
        // Request Drive API scope for file access
        googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
    }
    return { app, auth, db };
};

export const signInWithGoogle = async () => {
    const { auth } = initializeFirebase();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // Get the Google Access Token for Drive API
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        // Store access token for Drive API calls
        if (accessToken) {
            sessionStorage.setItem('googleAccessToken', accessToken);
        }

        return result.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }
};

export const signOutUser = async () => {
    const { auth } = initializeFirebase();
    await signOut(auth);
    sessionStorage.removeItem('googleAccessToken');
};

export const onAuthChange = (callback: (user: User | null) => void) => {
    const { auth } = initializeFirebase();
    return onAuthStateChanged(auth, callback);
};

export const getFirebaseAuth = () => {
    initializeFirebase();
    return auth;
};

export const getFirestoreDb = () => {
    initializeFirebase();
    return db;
};

export const getGoogleAccessToken = () => {
    return sessionStorage.getItem('googleAccessToken');
};
