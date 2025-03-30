// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// TODO: Replace with your actual Firebase config object
const firebaseConfig = {
    apiKey: "AIzaSyAQOogYuOAKJt4irq17qvuOadGTA5dr08o",
    authDomain: "rfid-com-esp32.firebaseapp.com",
    databaseURL: "https://rfid-com-esp32-default-rtdb.firebaseio.com",
    projectId: "rfid-com-esp32",
    storageBucket: "rfid-com-esp32.firebasestorage.app",
    messagingSenderId: "727661669807",
    appId: "1:727661669807:web:daeb96fcd2799e75fe935a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
const auth = getAuth(app);
const database = getDatabase(app);

// Export the instances to be used elsewhere
export { auth, database, app };