import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyByftACikdRNJITUQ0vsn3a-ADWYrmel74",
  authDomain: "lumenlink-sveg1.firebaseapp.com",
  projectId: "lumenlink-sveg1",
  storageBucket: "lumenlink-sveg1.firebasestorage.app",
  messagingSenderId: "1040500489325",
  appId: "1:1040500489325:web:e5727f25d446c7025a9364",
}

// Inicializar Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

export { app, auth, db, storage }
