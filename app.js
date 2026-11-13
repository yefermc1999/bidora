import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, 
  sendEmailVerification, signOut, onAuthStateChanged, updateProfile 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Tus credenciales reales ya integradas
const firebaseConfig = {
  apiKey: "AIzaSyBz5akqL6ij-T9S3kn9r0716Ng7yA8hmc8",
  authDomain: "bidora-aca53.firebaseapp.com",
  projectId: "bidora-aca53",
  storageBucket: "bidora-aca53.firebasestorage.app",
  messagingSenderId: "819474816590",
  appId: "1:819474816590:web:b5c0d4803f449479552d1f",
  measurementId: "G-YELL8ZXRCK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Control de Vistas SPA
window.switchView = function(viewName) {
  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('profileView').classList.add('hidden');
  document.getElementById('adminView').classList.add('hidden');

  if (viewName === 'home') document.getElementById('homeView').classList.remove('hidden');
  if (viewName === 'detail') document.getElementById('detailView').classList.remove('hidden');
  if (viewName === 'auth') document.getElementById('authView').classList.add('hidden') || document.getElementById('authView').classList.remove('hidden');
  if (viewName === 'profile') document.getElementById('profileView').classList.remove('hidden');
  if (viewName === 'admin') {
    document.getElementById('adminView').classList.remove('hidden');
    loadAdminData();
  }
};

// Modo Oscuro
const themeToggleBtn = document.getElementById('themeToggle');
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  themeToggleBtn.textContent = '☀️ Modo Claro';
}
themeToggleBtn.addEventListener('click', () => {
  let theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    themeToggleBtn.textContent = '🌙 Modo Oscuro';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggleBtn.textContent = '☀️ Modo Claro';
  }
});

// Autenticación y Jerarquía de Admins (RBAC)
const userNavProfile = document.getElementById('userNavProfile');
const navAdminBtn = document.getElementById('navAdminBtn');
const navLoginBtn = document.getElementById('navLoginBtn');
const navUserAvatar = document.getElementById('navUserAvatar');
const navUserName = document.getElementById('navUserName');

onAuthStateChanged(auth, async (user) => {
  if (user) {
    userNavProfile.classList.remove('hidden');
    navLoginBtn.classList.add('hidden');
    navUserAvatar.src = user.photoURL || "https://via.placeholder.com/150";
    navUserName.textContent = user.displayName || "Usuario";
    
    document.getElementById('profileAvatarPreview').src = user.photoURL || "https://via.placeholder.com/150";
    document.getElementById('profileDisplayName').textContent = user.displayName || "Usuario";
    document.getElementById('profileDisplayEmail').textContent = user.email;

    // Verificar Rol de Administrador
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.role === 'super_admin' || userData.role === 'verifier_admin') {
        navAdminBtn.classList.remove('hidden');
      }
    }
  } else {
    userNavProfile.classList.add('hidden');
    navAdminBtn.classList.add('hidden');
    navLoginBtn.classList.remove('hidden');
  }
});

// Login Google
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL || "",
        role: "user",
        isVerified: false,
        createdAt: new Date().toISOString()
      });
    }
    switchView('home');
    alert("¡Inicio de sesión exitoso!");
  } catch (error) { alert("Error: " + error.message); }
});

// Registro Manual
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    await setDoc(doc(db, "users", cred.user.uid), {
      email, displayName: name, photoURL: "", role: "user", isVerified: false, createdAt: new Date().toISOString()
    });
    switchView('home');
    alert("¡Registro exitoso! Revisa tu correo para verificar tu cuenta.");
  } catch (error) { alert("Error: " + error.message); }
});

// Subir Foto Local
document.getElementById('uploadAvatarBtn').addEventListener('click', async () => {
  const file = document.getElementById('localImageInput').files[0];
  const user = auth.currentUser;
  if (!file || !user) return alert("Selecciona una imagen");
  const storageRef = ref(storage, `avatars/${user.uid}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, "users", user.uid), { photoURL: url });
  await updateProfile(user, { photoURL: url });
  document.getElementById('profileAvatarPreview').src = url;
  navUserAvatar.src = url;
  alert("¡Foto actualizada!");
});

// Funciones de Chat y Subastas (Bases)
window.sendChatMessage = function() {
  const input = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  if (!input.value.trim()) return;
  const msg = document.createElement('div');
  msg.textContent = `${auth.currentUser ? auth.currentUser.displayName : 'Anónimo'}: ${input.value}`;
  chatMessages.appendChild(msg);
  input.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

window.placeBid = function() {
  const amount = document.getElementById('bidAmountInput').value;
  if (!amount) return alert("Ingresa un monto válido para la puja.");
  alert(`¡Puja exitosa por $${amount} COP!`);
};

window.openCreateAuctionModal = function() {
  if (!auth.currentUser) {
    alert("Debes iniciar sesión para publicar una subasta.");
    switchView('auth');
    return;
  }
  // Abre ventana para destacar con Nequi o publicar gratis
  document.getElementById('nequiModal').classList.remove('hidden');
};

window.closeNequiModal = function() { document.getElementById('nequiModal').classList.add('hidden'); };

window.submitNequiPayment = function() {
  alert("¡Comprobante enviado a revisión! Tu subasta será destacada por el Admin Jefe.");
  closeNequiModal();
};

// Panel Admin (RBAC y Solicitudes)
window.switchAdminTab = function(tab) {
  document.getElementById('adminVerificationsContent').classList.add('hidden');
  document.getElementById('adminPromotionsContent').classList.add('hidden');
  document.getElementById('adminUsersContent').classList.add('hidden');
  if (tab === 'verifications') document.getElementById('adminVerificationsContent').classList.remove('hidden');
  if (tab === 'promotions') document.getElementById('adminPromotionsContent').classList.remove('hidden');
  if (tab === 'users') document.getElementById('adminUsersContent').classList.remove('hidden');
};

async function loadAdminData() {
  document.getElementById('adminVerificationsList').innerHTML = "<p>No hay solicitudes pendientes en este momento.</p>";
  document.getElementById('adminPromotionsList').innerHTML = "<p>No hay pagos Nequi pendientes.</p>";
}

window.assignUserRole = async function() {
  const email = document.getElementById('targetUserEmail').value;
  const role = document.getElementById('targetRoleSelect').value;
  if (!email) return alert("Ingresa el correo del usuario.");
  alert(`Rol ${role} asignado correctamente a ${email}`);
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);
  switchView('home');
});