const firebaseConfig = {
    apiKey: "AIzaSyB8eUk3CEfppvo2bTlQodvKlDUBIqIUSSs",
    authDomain: "mpt-app-fc231.firebaseapp.com",
    databaseURL: "https://mpt-app-fc231-default-rtdb.firebaseio.com",
    projectId: "mpt-app-fc231",
    storageBucket: "mpt-app-fc231.firebasestorage.app",
    messagingSenderId: "1025705479989",
    appId: "1:1025705479989:web:27f08ffa8434398e7f067c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage ? firebase.storage() : null;

// --- LOGIN ---
window.entrar = () => {
    const c = document.getElementById('usuario').value;
    const p = document.getElementById('clave').value;
    db.ref('usuarios/' + c).once('value').then(s => {
        if(s.exists() && s.val().pass === p) {
            window.location.href = (s.val().rol === 'admin' ? "panel.administrador.html" : "panel.funcionario.html") + "?id=" + c;
        } else { alert("Datos incorrectos"); }
    });
};

window.registrar = () => {
    const cedula = document.getElementById('cedula').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const cargo = document.getElementById('cargo').value.trim();
    const unidad = document.getElementById('unidad').value.trim();
    const pass = document.getElementById('pass').value;
    const pass2 = document.getElementById('pass2').value;

    if (!cedula || !nombre || !email || !pass) {
        alert("Completa los campos obligatorios");
        return;
    }
    if (pass !== pass2) {
        alert("Las contraseñas deben coincidir");
        return;
    }

    db.ref('usuarios/' + cedula).once('value').then(snapshot => {
        if (snapshot.exists()) {
            alert("Ya existe un usuario con esa cédula");
            return;
        }

        db.ref('usuarios/' + cedula).set({
            nombre,
            email,
            telefono,
            cargo,
            unidad,
            pass,
            rol: 'funcionario',
            fechaRegistro: new Date().toISOString()
        }).then(() => {
            alert("Registro exitoso. Ya puedes iniciar sesión.");
            window.location.href = 'index.html';
        }).catch(error => {
            alert("Error al registrar: " + error.message);
        });
    });
};

// --- GESTIÓN DE SOLICITUDES Y TALONES ---
window.enviarSolicitud = async (tipo) => {
    const id = new URLSearchParams(window.location.search).get('id');
    const fecha = document.getElementById('fecha').value;
    let urlImagen = "";

    if (tipo === 'reposo') {
        const file = document.getElementById('archivo').files[0];
        const ref = storage.ref('reposos/' + Date.now());
        const snap = await ref.put(file);
        urlImagen = await snap.ref.getDownloadURL();
    }

    db.ref('solicitudes').push({ idUsuario: id, tipo, fecha, urlImagen }).then(() => alert("Enviado"));
};

// --- PDF PARA ADMINISTRADOR ---
window.generarPDF = (n, t, f) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("SOLICITUD: " + t, 20, 20);
    doc.text("Funcionario: " + n, 20, 30);
    doc.text("Fecha: " + f, 20, 40);
    doc.text("___________________", 20, 80);
    doc.text("Sello y Firma RRHH", 20, 90);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
};