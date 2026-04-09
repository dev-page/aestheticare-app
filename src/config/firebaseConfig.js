// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB3u8YsBjlfXxAk9eZunZOS3g9ZqnNbpl0",
  authDomain: "aesthetic-db.firebaseapp.com",
  projectId: "aesthetic-db",
  storageBucket: "aesthetic-db.firebasestorage.app",
  messagingSenderId: "112088599784",
  appId: "1:112088599784:web:96324b52401b87ea36cd5d",
  measurementId: "G-H1P2JNWDDJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let analytics
if (typeof window !== 'undefined' && location.hostname !== 'localhost') {
  analytics = getAnalytics(app)
}

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
