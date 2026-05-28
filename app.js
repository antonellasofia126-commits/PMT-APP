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

// --- ADMIN LOGIN ---
window.entrarAdmin = () => {
    const c = document.getElementById('adminUsuario').value;
    const p = document.getElementById('adminClave').value;
    db.ref('usuarios/' + c).once('value').then(s => {
        // Solo usuarios con rol admin pueden acceder al panel de administrador.
        if (s.exists() && s.val().pass === p && s.val().rol === 'admin') {
            window.location.href = 'panel.administrador.html?id=' + c;
        } else {
            alert('Credenciales de administrador incorrectas');
        }
    });
};

// --- GESTIÓN DE SOLICITUDES Y TALONES ---
window.enviarSolicitud = async (tipo) => {
    const id = new URLSearchParams(window.location.search).get('id');
    const fechaInput = document.getElementById('fecha').value;
    const fecha = fechaInput || new Date().toISOString().slice(0, 10);
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    let urlImagen = "";

    if (!id) {
        alert('No se encontró el usuario. Vuelve a iniciar sesión.');
        return;
    }

    if (tipo === 'vacaciones') {
        if (!fechaInicio || !fechaFin) {
            alert('Completa las fechas de inicio y fin para la solicitud de vacaciones.');
            return;
        }
        if (fechaFin < fechaInicio) {
            alert('La fecha de fin debe ser igual o posterior a la fecha de inicio.');
            return;
        }
    }

    if (tipo === 'reposo') {
        const file = document.getElementById('archivo').files[0];
        if (!file) {
            alert('Adjunta el documento de reposo antes de enviar.');
            return;
        }
        const ref = storage.ref('reposos/' + Date.now());
        const snap = await ref.put(file);
        urlImagen = await snap.ref.getDownloadURL();
    }

    db.ref('solicitudes').push({
        idUsuario: id,
        tipo,
        fecha,
        fechaInicio: tipo === 'vacaciones' ? fechaInicio : '',
        fechaFin: tipo === 'vacaciones' ? fechaFin : '',
        urlImagen,
        estado: 'pendiente',
        creado: new Date().toISOString()
    }).then(() => {
        let mensaje = 'Solicitud enviada.';
        if (tipo === 'constancia') mensaje = 'Solicitud de constancia enviada.';
        if (tipo === 'vacaciones') mensaje = 'Solicitud de vacaciones enviada.';
        if (tipo === 'reposo') mensaje = 'Solicitud de reposo enviada.';
        if (tipo === 'disciplinario') mensaje = 'Solicitud de récord disciplinario enviada.';
        alert(mensaje);
        if (tipo === 'constancia' || tipo === 'reposo') {
            document.getElementById('archivo').value = '';
        }
        if (tipo === 'vacaciones') {
            document.getElementById('fechaInicio').value = '';
            document.getElementById('fechaFin').value = '';
        }
    }).catch(error => {
        alert('Error al enviar solicitud: ' + error.message);
    });
};

window.enviarTalonPago = (usuarioId) => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        alert('No se encontró el administrador. Inicia sesión de nuevo.');
        return;
    }
    const fecha = new Date().toISOString().slice(0, 10);
    const usuario = window.usuariosMap && window.usuariosMap[usuarioId] ? window.usuariosMap[usuarioId] : null;
    const nombre = usuario ? usuario.nombre : usuarioId;
    if (!confirm(`Enviar talón de pago al funcionario ${nombre}?`)) return;
    db.ref('talones').push({
        idUsuario: usuarioId,
        nombre,
        fecha,
        estado: 'enviado',
        adminId: id,
        creado: new Date().toISOString()
    }).then(() => {
        alert('Talón de pago enviado.');
        generarPDF(nombre, 'talon', fecha, '', '', false);
    }).catch(error => {
        alert('Error al enviar talón de pago: ' + error.message);
    });
};

// --- PDF PARA ADMINISTRADOR ---
window.generarPDF = (n, t, f, inicio = '', fin = '', autoPrint = false) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let title = 'SOLICITUD';
    let bodyText = `La solicitud ha sido generada para el funcionario ${n}.`;

    if (t === 'constancia') {
        title = 'CONSTANCIA DE TRABAJO';
        bodyText = `Por la presente se certifica que el funcionario ${n} está vinculado al Comando Policial en calidad de personal activo.`;
    } else if (t === 'reposo') {
        title = 'SOLICITUD DE REPOSO MÉDICO';
        bodyText = `Se ha recibido la solicitud de reposo médico del funcionario ${n}.`;
    } else if (t === 'vacaciones') {
        title = 'SOLICITUD DE VACACIONES';
        bodyText = `Se ha recibido la solicitud de vacaciones del funcionario ${n}.`;
    } else if (t === 'disciplinario') {
        title = 'SOLICITUD DE RÉCORD DISCIPLINARIO';
        bodyText = `Se ha recibido la solicitud de récord disciplinario del funcionario ${n}.`;
    } else if (t === 'talon') {
        title = 'TALÓN DE PAGO';
        bodyText = `Talón de pago emitido para el funcionario ${n}.`;
    }

    doc.setFontSize(18);
    doc.text(title, 20, 25);
    doc.setFontSize(12);
    doc.text(`Funcionario: ${n}`, 20, 40);
    doc.text(`Tipo de trámite: ${t}`, 20, 50);
    doc.text(`Fecha de solicitud: ${f}`, 20, 60);
    if (t === 'vacaciones' && inicio && fin) {
        doc.text(`Periodo de vacaciones: ${inicio} a ${fin}`, 20, 70);
    }
    doc.text(bodyText, 20, t === 'vacaciones' && inicio && fin ? 90 : 80);
    if (t === 'constancia') {
        doc.text('Se expide la presente constancia a solicitud del interesado.', 20, 110);
    }
    doc.text('__________________________', 20, 130);
    doc.text('Sello y Firma RRHH', 20, 140);
    window.open(doc.output('bloburl'), '_blank');
    if (autoPrint) {
        doc.autoPrint();
    }
};
