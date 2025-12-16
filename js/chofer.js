// ---------------- IMPORTS ----------------
import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

import { 
  getFirestore, collection, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// ---------------- CONFIG FIREBASE ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBuAsS0aqT8e6ECtMj-mmZsBemBoMTivoY",
  authDomain: "viajesautos.firebaseapp.com",
  projectId: "viajesautos",
  storageBucket: "viajesautos.firebasestorage.app",
  messagingSenderId: "593140621786",
  appId: "1:593140621786:web:bb5eba2477c5efda56a0e3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ---------------- LOGIN POR PIN ----------------
document.getElementById("loginBtn").addEventListener("click", async () => {

  const pinIngresado = document.getElementById("pin").value.trim();
  const msg = document.getElementById("msg");

  msg.style.color = "#ffbbbb";

  if (pinIngresado === "") {
      msg.innerHTML = "❌ Ingresá tu PIN";
      return;
  }

  // Buscar el PIN dentro de la colección usuarios
  const q = query(collection(db, "usuarios"), where("pin", "==", pinIngresado));
  const snap = await getDocs(q);

  if (snap.empty) {
      msg.innerHTML = "❌ PIN incorrecto";
      return;
  }

  // Usuario encontrado
  const data = snap.docs[0].data();

  // Guardar datos del chofer para el panel
  sessionStorage.setItem("pin", data.pin);
  sessionStorage.setItem("nombreChofer", data.nombre || "Chofer");

  msg.style.color = "#b7ffb7";
  msg.innerHTML = "✔️ Acceso correcto, entrando...";

  setTimeout(() => {
      window.location.href = "panelChofer.html";
  }, 800);
});
