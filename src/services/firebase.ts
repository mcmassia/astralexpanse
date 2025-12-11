// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup } from 'firebase/auth';
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

// Google access tokens last ~1 hour (3600 seconds)
const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes to be safe

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
        // Request Calendar API scope for calendar sync (readonly)
        googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    }
    return { app, auth, db };
};

// Store token with expiration time
const storeAccessToken = (accessToken: string) => {
    const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
    sessionStorage.setItem('googleAccessToken', accessToken);
    sessionStorage.setItem('googleAccessTokenExpiresAt', expiresAt.toString());
    return expiresAt;
};

export const signInWithGoogle = async () => {
    const { auth } = initializeFirebase();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // Get the Google Access Token for Drive API
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        // Store access token with expiration for Drive API calls
        if (accessToken) {
            storeAccessToken(accessToken);
        }

        return result.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }
};

// Refresh Google Access Token by re-authenticating
export const refreshGoogleAccessToken = async (): Promise<{ success: boolean; expiresAt?: number }> => {
    const { auth } = initializeFirebase();
    const user = auth.currentUser;

    if (!user) {
        console.warn('[Auth] No user logged in, cannot refresh token');
        return { success: false };
    }

    try {
        console.log('[Auth] Attempting to refresh Google access token...');
        const result = await reauthenticateWithPopup(user, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (accessToken) {
            const expiresAt = storeAccessToken(accessToken);
            console.log('[Auth] Token refreshed successfully, expires at:', new Date(expiresAt).toLocaleTimeString());
            return { success: true, expiresAt };
        }

        return { success: false };
    } catch (error) {
        console.error('[Auth] Error refreshing Google access token:', error);
        return { success: false };
    }
};

export const signOutUser = async () => {
    const { auth } = initializeFirebase();
    await signOut(auth);
    sessionStorage.removeItem('googleAccessToken');
    sessionStorage.removeItem('googleAccessTokenExpiresAt');
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

export const getGoogleAccessTokenExpiration = (): number | null => {
    const expiresAt = sessionStorage.getItem('googleAccessTokenExpiresAt');
    return expiresAt ? parseInt(expiresAt, 10) : null;
};

export const isGoogleAccessTokenExpired = (): boolean => {
    const expiresAt = getGoogleAccessTokenExpiration();
    if (!expiresAt) return true;
    // Consider expired 5 minutes before actual expiration
    return Date.now() > (expiresAt - 5 * 60 * 1000);
};

// Add a secondary Google account for calendar sync
// Note: This temporarily switches the Firebase user, then restores the original
export const addSecondaryGoogleAccount = async (): Promise<{
    accessToken: string;
    email: string;
    name: string;
    photoUrl?: string;
    expiresAt: number;
} | null> => {
    const { auth } = initializeFirebase();

    // Save current primary user info before switching
    const primaryUser = auth.currentUser;
    const primaryToken = getGoogleAccessToken();
    const primaryTokenExpiration = getGoogleAccessTokenExpiration();

    if (!primaryUser) {
        console.error('[Auth] No primary user to restore after secondary account');
        return null;
    }

    // Create a new provider for the secondary account popup
    const secondaryProvider = new GoogleAuthProvider();
    secondaryProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    // Force account selection - allow user to pick a DIFFERENT account
    secondaryProvider.setCustomParameters({
        prompt: 'select_account'
    });

    try {
        // This will temporarily switch the Firebase user
        const result = await signInWithPopup(auth, secondaryProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const secondaryAccessToken = credential?.accessToken;
        const secondaryEmail = result.user.email;
        const secondaryName = result.user.displayName || result.user.email || 'Secondary Account';
        const secondaryPhoto = result.user.photoURL || undefined;

        if (!secondaryAccessToken || !secondaryEmail) {
            // Try to restore primary user
            await reauthenticateWithPopup(primaryUser, googleProvider);
            return null;
        }

        // Check if user selected the same account as primary
        if (secondaryEmail === primaryUser.email) {
            console.log('[Auth] User selected primary account again');
            // Restore primary token
            if (primaryToken) {
                sessionStorage.setItem('googleAccessToken', primaryToken);
                sessionStorage.setItem('googleAccessTokenExpiresAt', primaryTokenExpiration?.toString() || '');
            }
            return null;
        }

        const secondaryExpiresAt = Date.now() + TOKEN_LIFETIME_MS;

        // Now we need to restore the primary user
        // The secondary user is now signed in, we need to sign back in as primary
        console.log('[Auth] Restoring primary user after secondary account capture...');
        console.log('[Auth] Please select your primary account:', primaryUser.email);

        // Create a provider specifically for restoring the primary user
        // Use login_hint to suggest the primary account and prompt to force selection
        const restoreProvider = new GoogleAuthProvider();
        restoreProvider.addScope('https://www.googleapis.com/auth/drive.file');
        restoreProvider.addScope('https://www.googleapis.com/auth/calendar.readonly');
        restoreProvider.setCustomParameters({
            prompt: 'select_account',
            login_hint: primaryUser.email || ''
        });

        // Re-authenticate primary user (will show popup again)
        try {
            const primaryResult = await signInWithPopup(auth, restoreProvider);
            const primaryCredential = GoogleAuthProvider.credentialFromResult(primaryResult);

            // Verify user selected the correct account
            if (primaryResult.user.email !== primaryUser.email) {
                console.warn('[Auth] User selected different account than primary. Session may be inconsistent.');
            }

            if (primaryCredential?.accessToken) {
                storeAccessToken(primaryCredential.accessToken);
                console.log('[Auth] Primary user restored successfully:', primaryResult.user.email);
            }
        } catch (restoreError) {
            console.error('[Auth] Failed to restore primary user:', restoreError);
            // Try to at least restore the token from session storage
            if (primaryToken) {
                sessionStorage.setItem('googleAccessToken', primaryToken);
                sessionStorage.setItem('googleAccessTokenExpiresAt', primaryTokenExpiration?.toString() || '');
            }
        }

        return {
            accessToken: secondaryAccessToken,
            email: secondaryEmail,
            name: secondaryName,
            photoUrl: secondaryPhoto,
            expiresAt: secondaryExpiresAt
        };
    } catch (error) {
        console.error('[Auth] Error adding secondary Google account:', error);

        // Try to restore primary user if something went wrong
        if (primaryToken) {
            sessionStorage.setItem('googleAccessToken', primaryToken);
            sessionStorage.setItem('googleAccessTokenExpiresAt', primaryTokenExpiration?.toString() || '');
        }

        return null;
    }
};
