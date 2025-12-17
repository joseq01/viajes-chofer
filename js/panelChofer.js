import { initializeApp } 
  from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

import { 
    initializeFirestore,
    persistentLocalCache,
    persistentSingleTabManager,
    collection, query, where, onSnapshot,
    doc, updateDoc, addDoc,
    getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";


// ===========================
// 🔥 FIREBASE
// ===========================
const firebaseConfig = {
  apiKey: "AIzaSyBuAsS0aqT8e6ECtMj-mmZsBemBoMTivoY",
  authDomain: "viajesautos.firebaseapp.com",
  projectId: "viajesautos",
  storageBucket: "viajesautos.firebasestorage.app",
  messagingSenderId: "593140621786",
  appId: "1:593140621786:web:bb5eba2477c5efda56a0e3"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: false,
  experimentalAutoDetectLongPolling: false,
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager()
  })
});


// ===========================
// 🔐 CHOFER LOGUEADO (PIN)
// ===========================
const choferPIN = sessionStorage.getItem("pin");

if (!choferPIN) {
  document.getElementById("listaViajes").innerHTML =
    "❌ No se detectó el PIN del usuario. Volvé a iniciar sesión.";
  throw new Error("No hay PIN en sessionStorage");
}


// ===========================
// VARIABLES GLOBALES
// ===========================
let trackingInterval = null;
let historialGPS = [];
let viajeEnCursoID = null;

const lista = document.getElementById("listaViajes");
const estado = document.getElementById("estado");

const cardFinal = document.getElementById("cardFinal");
const kmChoferInput = document.getElementById("kmChofer");
const kmsGps = document.getElementById("kmsGps");
const btnGuardarFinal = document.getElementById("btnGuardarFinal");


// ===========================
// 📡 ESCUCHAR VIAJES EN SEGUIMIENTO
// ===========================
const q = query(collection(db, "seguimiento"), where("pin", "==", choferPIN));

onSnapshot(q, (snap) => {
  lista.innerHTML = "";
  cardFinal.style.display = "none";

  if (snap.empty) {
    lista.innerHTML = "No tenés viajes asignados.";
    return;
  }

  snap.forEach(docu => {
    const d = docu.data();
    const id = docu.id;

    const origenTxt = d.origen || "Sin origen";
    const destinoTxt = d.destino || d.destinos || "Sin destino";
    const transportaTxt = d.transporta || "(sin datos)";

    const esperandoRespuesta = d.estado === "en espera" && d.aceptado === false;
    const enCamino = d.estado === "en camino";

    lista.innerHTML += `
      <div class="card">

        <p><b>🟦 Origen:</b> ${origenTxt}</p>
        <p><b>🟩 Destino:</b> ${destinoTxt}</p>
       <p><b>📦 Transporta:</b></p>

${
  typeof transportaTxt === "string" && transportaTxt.startsWith("https://")
    ? `
      <img 
        src="${transportaTxt}"
        class="img-transporta"
        onclick="verImagen('${transportaTxt}')"
      >
    `
    : `<p>${transportaTxt}</p>`
}


        ${
          esperandoRespuesta
            ? `
            <div class="acciones-viaje">
              <button class="btn-aceptar" onclick="aceptarViaje('${id}')">
                Aceptar
              </button>
              <button class="btn-rechazar" onclick="rechazarViaje('${id}')">
                Rechazar
              </button>
            </div>
            `
            : `
            <button class="btnIniciar" onclick="iniciarViaje('${id}')" 
              ${enCamino ? "disabled" : ""}>
              🚚 Iniciar viaje
            </button>

            <button class="btnFinalizar" id="fin_${id}" onclick="mostrarFinal('${id}')"
              ${enCamino ? "" : "disabled"}>
              🛑 Finalizar viaje
            </button>
            `
        }

      </div>
    `;
  });
});


// ===========================
// 🚚 INICIAR VIAJE
// ===========================
window.iniciarViaje = async (id) => {
  estado.innerHTML = "⏳ Comenzando seguimiento GPS...";

  const ref = doc(db, "seguimiento", id);
  viajeEnCursoID = id;
  historialGPS = [];

  document.getElementById(`fin_${id}`).disabled = false;

  await updateDoc(ref, { estado: "en camino" });

  trackingInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(async pos => {
      const punto = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        hora: new Date().toISOString()
      };

      historialGPS.push(punto);

      await updateDoc(ref, {
        ultimaPos: punto,
        estado: "en camino"
      });

      estado.innerHTML = `✔️ Posición enviada<br>
        Lat: ${punto.lat} – Lng: ${punto.lng}<br>
        ${new Date().toLocaleTimeString()}
      `;

    }, () => {
      estado.innerHTML = "⚠️ Error al obtener GPS";
    });

  }, 600000);
};


// ===========================
// ✅ ACEPTAR VIAJE
// ===========================
window.aceptarViaje = async (id) => {
  const ref = doc(db, "seguimiento", id);

  // marcar como aceptado (igual que ahora)
  await updateDoc(ref, {
    aceptado: true,
    estado: "en camino",
    horaAceptado: new Date().toISOString()
  });

  estado.innerHTML = "📡 Iniciando GPS...";

  // limpiar intervalos previos por seguridad
  if (trackingInterval) clearInterval(trackingInterval);

  // primer envío inmediato
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const punto = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        hora: new Date().toISOString()
      };

      historialGPS = [punto];

      await updateDoc(ref, {
        ultimaPos: punto
      });

      estado.innerHTML = `✔️ GPS activo<br>
        Lat: ${punto.lat}<br>
        Lng: ${punto.lng}`;
    },
    () => {
      estado.innerHTML = "⚠️ No se pudo obtener ubicación";
    },
    { enableHighAccuracy: true }
  );

  // envíos periódicos (cada 5 min)
  trackingInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const punto = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          hora: new Date().toISOString()
        };

        historialGPS.push(punto);

        await updateDoc(ref, {
          ultimaPos: punto
        });
      },
      () => {},
      { enableHighAccuracy: true }
    );
  }, 300000); // 5 minutos
};


// ===========================
// ❌ RECHAZAR VIAJE
// ===========================
window.rechazarViaje = async (id) => {
  const ref = doc(db, "seguimiento", id);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const datos = snap.data();

  await setDoc(doc(db, "viajes", datos.viajeId), {
    ...datos,
    estado: "pendiente",
    chofer: "",
    pin: "",
    aceptado: false
  });

  await deleteDoc(ref);

  estado.innerHTML = "❌ Viaje rechazado";
};


// ===========================
// 📏 KM ENTRE PUNTOS
// ===========================
function calcularDistancia(p1, p2) {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;

  const a = Math.sin(dLat/2)**2 +
            Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function kmTotales() {
  let km = 0;
  for (let i = 1; i < historialGPS.length; i++) {
    km += calcularDistancia(historialGPS[i-1], historialGPS[i]);
  }
  return km.toFixed(2);
}


// ===========================
// 🛑 MOSTRAR TARJETA FINAL
// ===========================
window.mostrarFinal = (id) => {
  viajeEnCursoID = id;
  const kmGps = kmTotales();

  kmsGps.innerHTML = `📍 Km según GPS: <b>${kmGps} km</b>`;
  cardFinal.style.display = "block";
};


// ===========================
// ✔️ GUARDAR FINAL DEL VIAJE
// ===========================
btnGuardarFinal.onclick = async () => {
  if (!viajeEnCursoID) return;

  const ref = doc(db, "seguimiento", viajeEnCursoID);
  const kmGps = kmTotales();
  const kmChofer = kmChoferInput.value || null;

  clearInterval(trackingInterval);

  const snap = await getDoc(ref);
  const datos = snap.data();

  const datosFinales = {
    ...datos,
    estado: "finalizado",
    kmCalculado: kmGps,
    kmChofer: kmChofer,
    horaFin: new Date().toISOString()
  };

  await setDoc(doc(db, "viajesfinalizados", viajeEnCursoID), datosFinales);
  await deleteDoc(ref);

  await addDoc(collection(db, "histo_viajes"), {
    viajeId: viajeEnCursoID,
    pin: choferPIN,
    historialGPS,
    kmCalculado: kmGps,
    fecha: new Date().toISOString()
  });

  estado.innerHTML = `✔️ Viaje finalizado<br>GPS: ${kmGps} km<br>Chofer: ${kmChofer} km`;

  cardFinal.style.display = "none";
  kmChoferInput.value = "";
  viajeEnCursoID = null;
};

window.verImagen = (src) => {
  const modal = document.createElement("div");
  modal.style = `
    position:fixed;
    inset:0;
    background:rgba(0,0,0,0.85);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:9999;
  `;

  modal.innerHTML = `
    <img src="${src}" 
      style="
        max-width:90%;
        max-height:90%;
        border-radius:12px;
        box-shadow:0 0 30px #000;
        cursor:zoom-out;
      ">
  `;

  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
};
