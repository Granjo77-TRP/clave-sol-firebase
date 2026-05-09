import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 1) Cria um projeto em https://console.firebase.google.com/
// 2) Adiciona uma Web App
// 3) Copia aqui o firebaseConfig do teu projeto
const firebaseConfig = {
  apiKey: "AIzaSyCC1CTdPrqNeEa1MbCahbzy6dXlR_Lwb_8",
  authDomain: "jogo-das-notas.firebaseapp.com",
  projectId: "jogo-das-notas",
  storageBucket: "jogo-das-notas.firebasestorage.app",
  messagingSenderId: "638130850588",
  appId: "1:638130850588:web:9c233f14e7600278a3c8d9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
