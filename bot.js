const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;
let clienteContador = 0;
let contadorFlujoA = 0;
let contadorFlujoB = 0;

const BASE = 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/';
const FIREBASE_URLS = {
    audio:             'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    imagenPlataformas: BASE + 'plataformas_11zon_11zon%20(1).webp?alt=media&token=ba0c3864-e844-4339-9486-efabeb5528a2',
    imagenSobres:      BASE + 'JAlove.webp?alt=media&token=8ac373fa-f9a6-496e-aa96-7bfd20db85a1',
    imagenBoda2:       BASE + 'negro.webp?alt=media&token=89dd36ae-6e03-45d9-ae4a-8bba71a02315',
    imagenLia:         BASE + 'lia.webp?alt=media',
    imagenCatalogo:    BASE + 'catalogue_11zon.webp?alt=media&token=e8760350-1beb-4687-ae76-4f57fd40ac4f',
    imagenLucy:        BASE + '16c-scaled_11zon_11zon.webp?alt=media&token=12a0f8e3-6d5b-416c-b70d-7b1ee98d4d0a',
    imagenRafaela:     BASE + '15-scaled_11zon_11zon.webp?alt=media&token=e8ac5e53-6282-4ba8-8735-02d57ffc8622',
    imagenSheyla:      BASE + '11c-scaled_11zon_11zon.webp?alt=media&token=3c729c2e-aaae-41cb-9c7d-d22e70389dc3',
    imagenRemarketingBoda:   BASE + 're_boda.webp?alt=media&token=fc94abde-5f00-40cf-bc18-549484f3b00b',
    imagenRemarketingQuince: BASE + 're_quince.webp?alt=media&token=8e10bc2f-3f2b-4506-aaba-352e3a9e2ac7',
    imagenAbono15:     BASE + 'abono15.webp?alt=media&token=8bb13a3b-3d8f-417f-bf28-797dec10bace',
    imagenAbonoBoda:   BASE + 'abonoboda.webp?alt=media&token=50b28afb-0a96-42ee-b74a-91f68691e113',
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://invitartes.com/plataforma-administracion-eventos/';
const GUIA = 'https://drive.google.com/file/d/1HREPiYR6zb-eAIJqGZvLp-EJ3wM-AHgx/view?usp=sharing';
const PAYPAL = 'https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC';

function esMexico(phone) {
    return phone && phone.startsWith('52') && phone.length >= 12 && phone.length <= 13;
}

function esAngloparlante(phone) {
    const prefijos = [
        { code: '1', len: 11 },
        { code: '44', len: 12 },
        { code: '61', len: 11 },
        { code: '64', len: 11 },
        { code: '353', len: 12 },
        { code: '27', len: 11 },
    ];
    if (!phone) return false;
    return prefijos.some(p => phone.startsWith(p.code) && phone.length === p.len);
}

function esKeywordGuia(text) {
    const t = text.toLowerCase().trim();
    return t.includes('guía') || t.includes('guia') || t.includes('guide') ||
           t.includes('quiero la guía') || t.includes('quiero la guia') ||
           t.includes('guia gratuita') || t.includes('guía gratuita');
}

function esKeywordAsesor(text) {
    const t = text.toLowerCase().trim();
    return t.includes('asesor') || t.includes('hablar con') || t.includes('deseo hablar') ||
           t.includes('quiero hablar') || t.includes('necesito ayuda') || t.includes('agente') ||
           t.includes('persona') || t.includes('humano') || t.includes('speak to') ||
           t.includes('talk to') || t.includes('agent') || t.includes('advisor');
}

function normalizarNumero(text) {
    const t = text.toLowerCase().trim();
    const mapa = {
        'uno': '1', 'one': '1',
        'dos': '2', 'two': '2',
        'tres': '3', 'three': '3',
        'cuatro': '4', 'four': '4',
        'cinco': '5', 'five': '5',
    };
    return mapa[t] || t;
}

function getDatosBancarios(phone, esEspanol) {
    if (esMexico(phone)) {
        return esEspanol
            ? 'Empezamos con un abono de *$170 pesos MXN*:\n\n🏦 *BBVA Bancomer*\nNombre: Uriel Dominguez Rodriguez\nTarjeta de débito: *4152 3143 4224 4319*\n\nO por PayPal:\n👉 ' + PAYPAL + '\n\nEl resto lo cancela en la entrega. 😊'
            : 'We start with a deposit of *$170 MXN*:\n\n🏦 *BBVA Bancomer*\nName: Uriel Dominguez Rodriguez\nDebit card: *4152 3143 4224 4319*\n\nOr via PayPal:\n👉 ' + PAYPAL + '\n\nThe rest is paid at delivery. 😊';
    } else if (!esEspanol) {
        return 'We start with a deposit of *$10*.\n\nVia PayPal:\n👉 ' + PAYPAL + '\n\nThe rest is paid at delivery. 😊';
    } else {
        return 'Empezamos con un abono de *$10*:\n\n🏦 *Banco de Loja*\nCuenta: *2904553231* — Cédula: *1104753122*\nTitular: *ALVAREZ GRANDA, GUIDO CRISTOPHER*\n\nEl resto lo cancela en la entrega. 😊';
    }
}

function getMensajeFormulario(phone, esEspanol) {
    return getDatosBancarios(phone, esEspanol) + '\n\n' +
        (esEspanol
            ? 'Luego complete este formulario — ahí mismo escoge su paquete:\n📝 ' + FORM + '\n\n💡 No necesita completar todos los campos — lo más importante al inicio es la *cromática* de su evento, ya que el diseño es lo que más tiempo nos lleva. Entregamos en máximo *5 días*. ✨'
            : 'Then fill out this form — there you choose your package:\n📝 ' + FORM + '\n\n💡 You don\'t need to fill all fields — the most important thing at the start is the *color palette* of your event. We deliver in maximum *5 days*. ✨');
}

function getMenuPostPaquetes(opcionesUsadas, esEspanol) {
    const todas = [
        { id: '1', texto: esEspanol ? 'Quiero contratar un paquete' : 'I want to hire a package' },
        { id: '2', texto: esEspanol ? 'Ver el catálogo' : 'See the catalog' },
        { id: '3', texto: esEspanol ? 'Diferencia entre Deluxe y Élite' : 'Difference between Deluxe and Elite' },
        { id: '4', texto: esEspanol ? 'Cómo funciona la plataforma' : 'How the platform works' },
    ];
    const disponibles = todas.filter(o => !opcionesUsadas.includes(o.id));
    let num = 1;
    const renumeradas = disponibles.map(o => ({ ...o, num: String(num++) }));
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣'];
    const lineas = renumeradas.map((o, i) => emojis[i] + ' ' + o.texto).join('\n');
    return {
        texto: (esEspanol
            ? '¿Cómo desea proceder ahora? 😊\n\n👇 Elija una opción *escribiendo el número*:\n\n'
            : 'How would you like to proceed? 😊\n\n👇 Choose an option *by typing the number*:\n\n') +
            lineas + '\n\n✍️ ' + (esEspanol ? 'Escriba solo el número para continuar.' : 'Type only the number to continue.'),
        mapa: renumeradas
    };
}

async function sendText(jid, text) {
    if (!sock) return;
    await sock.sendMessage(jid, { text });
}

async function sendImage(jid, url, caption) {
    if (!sock) return;
    try {
        await sock.sendMessage(jid, { image: { url }, caption });
    } catch {
        await sendText(jid, caption);
    }
}

async function sendAudio(jid, url) {
    if (!sock) return;
    try {
        await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: false });
    } catch {
        console.log('⚠️ Error enviando audio');
    }
}

async function enviarPreguntaIdioma(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '🌍 Hello! / ¡Hola!\n\nIn which language would you like to be assisted?\n¿En qué idioma prefiere que le atendamos?\n\n1️⃣ Español\n2️⃣ English');
    } catch (err) {
        console.error('❌ Error pregunta idioma:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarBienvenida(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '🎉 ¡Hola! Bienvenido/a a *Invitartes*.\n\n' +
            '¡Qué emoción! 👑💕 Sabemos que organizar un evento especial puede ser emocionante, pero también traer muchas dudas. Por eso en *Invitartes* no solo diseñamos invitaciones digitales — te ofrecemos la *plataforma más completa de gestión de eventos del mercado*, única en su tipo. 💛\n\n' +
            '👇 Elija una opción *escribiendo el número*:\n\n' +
            '1️⃣ Quiero invitaciones para mis XV años 👑\n' +
            '2️⃣ Quiero invitaciones para Boda 💍\n' +
            '3️⃣ Quiero invitaciones para otro evento ✨\n' +
            '4️⃣ Quiero la guía gratuita 📖\n\n' +
            '✍️ Escriba solo el número para continuar.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarBienvenidaIngles(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '🎉 Hello! Welcome to *Invitartes*.\n\nWe don\'t just design digital invitations — we offer you the *most complete event management platform on the market*. 💛\n\n' +
            '👇 Choose an option *by typing the number*:\n\n' +
            '1️⃣ I need invitations for a Wedding 💍\n' +
            '2️⃣ I need invitations for a Sweet 15 👑\n' +
            '3️⃣ I need invitations for another event ✨\n' +
            '4️⃣ I want the free guide 📖\n\n' +
            '✍️ Type only the number to continue.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida inglés:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenuRepetido(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId,
            '👇 Por favor elija una de las siguientes opciones *escribiendo el número*:\n\n' +
            '1️⃣ Quiero invitaciones para mis XV años 👑\n' +
            '2️⃣ Quiero invitaciones para Boda 💍\n' +
            '3️⃣ Quiero invitaciones para otro evento ✨\n' +
            '4️⃣ Quiero la guía gratuita 📖\n\n' +
            '✍️ Escriba solo el número para continuar.'
        );
    } catch (err) {
        console.error('❌ Error menú repetido:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesorFinal(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '👩🏻‍💼 No hay problema, en unos minutos uno de nuestros asesores se comunicará con usted.\n\nEstamos para servirle, que tenga un excelente día. ✨');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; }
    } catch (err) {
        console.error('❌ Error asesor final:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesorSolicitado(userId, esEspanol) {
    try {
        await sendText(userId, esEspanol
            ? '👩🏻‍💼 ¡Con gusto! En unos momentos un asesor se comunicará con usted.\n\nPor favor espere, estamos para servirle. ✨'
            : '👩🏻‍💼 Of course! An advisor will contact you shortly.\n\nPlease wait, we are here to help you. ✨');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; estado.respondioPostSecuencia = true; }
    } catch (err) {
        console.error('❌ Error asesor solicitado:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarGuiaGratuita(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '¡Aquí la tienes! 🎉\n\n📖 ' + GUIA + '\n\nLéela con calma — son 5 minutos que te van a ahorrar semanas de estrés.');
        await sleep(5000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Por cierto, ¿para qué evento estás organizando? Así te puedo ayudar mejor 😊\n\n1️⃣ Boda\n2️⃣ XV Años\n3️⃣ Otro evento\n\n✍️ Escriba solo el número para continuar.');
        const estado = userStates.get(userId);
        if (estado) estado.paso = 'guia_segmento';
    } catch (err) {
        console.error('❌ Error guía:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarPuenteEmocional(userId, tipoEvento, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;

        let puente = '';
        if (tipoEvento === 'boda') puente = '¡Qué emoción! 💒 Sabemos lo que es querer que cada detalle quede perfecto — sobre todo cuando es algo tan importante como tu boda.';
        else if (tipoEvento === 'xv') puente = '¡Qué bonito! 🎀 Los XV son un día que se recuerda para siempre — y cada detalle cuenta.';
        else puente = '¡Genial! 🎉 Sea el evento que sea, merece una invitación que trabaje por ti.';

        await sendText(userId, puente);
        await sleep(3000);
        if (userStates.get(userId)?.duenoAtendio) return;

        if (tipoEvento === 'boda') {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '✨ *Ejemplo 1 — Boda* ✨\n\n💍 Juan Pablo & Adriana\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenBoda2, '💌 *Ejemplo 2 — Boda* ✨\n\nHugo & Nickole\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/');
        } else if (tipoEvento === 'xv') {
            await sendImage(userId, FIREBASE_URLS.imagenLucy, '*Ejemplo 1* 🌸✨\n\nLucy te invita a vivir su cuento de hadas. 👑\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenRafaela, '*Ejemplo 2* 🌸✨\n\nRafaela te invita a descubrir cómo continúa su historia. 👑💕\n👉 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/');
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '✨ *Ejemplo 1 — Boda* ✨\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenLia, '🌸 *Ejemplo 2 — XV años* 🌸\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/');
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Sus invitados confirmaron directo desde ahí — sin llamadas, sin perseguir a nadie. 😊');
        await sleep(5000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, '¿Te gustaría saber cómo funcionan nuestras invitaciones y cuánto cuestan? Te explico sin compromiso 😊\n\n1️⃣ ✅ Sí, cuéntame\n2️⃣ ❌ Ahora no, gracias\n\n✍️ Escriba solo el número para continuar.');
        const estado = userStates.get(userId);
        if (estado) { estado.paso = 'guia_permiso'; estado.tipoEvento = tipoEvento; }
    } catch (err) {
        console.error('❌ Error puente emocional:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

// ============ FLUJO B ============
async function enviarSecuenciaBoda_B(userId, esEspanol, tipoEvento, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.tipoEvento = tipoEvento; estado.esEspanol = esEspanol; }

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendText(userId, esEspanol
            ? '¡Hola! 👋 Le saludamos de *Invitartes* ✨\n\n¿Sabía que su invitación puede ser toda una experiencia? 🤩\n\n🎵 Todos los paquetes incluyen música, fotos y videos\n💬 Sus invitados pueden subir fotos en tiempo real\n✅ Confirmaciones automáticas de asistencia\n🌍 Llega a todo el mundo en segundos\n📊 Plataforma privada de gestión de su evento\n♾️ En paquetes superiores, *invitaciones ilimitadas*'
            : 'Hello! 👋 Greetings from *Invitartes* ✨\n\nDid you know your invitation can be a whole experience? 🤩\n\n🎵 All packages include music, photos and videos\n💬 Your guests can upload photos in real time\n✅ Automatic attendance confirmations\n🌍 Reaches anywhere in the world\n📊 Private event management platform\n♾️ In higher packages, *unlimited invitations*');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        if (tipoEvento === 'xv') {
            await sendImage(userId, FIREBASE_URLS.imagenLucy, '*Ejemplo 1* 🌸✨\n\nÉrase una vez una princesa que soñaba con esta noche... Lucy te invita a vivir su cuento de hadas. 👑\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenRafaela, '*Ejemplo 2* 🌸✨\n\nRafaela te invita a descubrir cómo continúa su historia. 👑💕\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/');
        } else if (tipoEvento === 'boda') {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '✨ *Ejemplo 1 — Boda* ✨\n\n💍 Dos almas, un destino... 🌹\n\nConfirme su asistencia 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenBoda2, '💌 *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ 🖤🤍');
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '✨ *Ejemplo 1 — Boda* ✨\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenLia, '🌸 *Ejemplo 2 — XV años* 🌸\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/');
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const imagenAbono = (tipoEvento === 'xv') ? FIREBASE_URLS.imagenAbono15 : FIREBASE_URLS.imagenAbonoBoda;
        let paquetesText;
        if (tipoEvento === 'xv') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música.\n👉 (Ejemplo DELUXE) https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + animaciones premium y más.\n👉 (Ejemplo ÉLITE) https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '🎁 *Our Packages*\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music.\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations.\n👉 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else if (tipoEvento === 'boda') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música.\n👉 (Ejemplo DELUXE) https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + animaciones premium y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music.\n👉 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations.\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        } else {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música.\n👉 (Ejemplo DELUXE) https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + animaciones premium y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music.\n👉 https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations.\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }
        await sendImage(userId, imagenAbono, paquetesText);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const menu = getMenuPostPaquetes([], esEspanol);
        await sendText(userId, menu.texto);

        const estadoF = userStates.get(userId);
        if (estadoF) {
            estadoF.paso = 'flujoB_menu';
            estadoF.menuMapa = menu.mapa;
            estadoF.opcionesUsadas = [];
            estadoF.intentoMenuB = 0;
            estadoF.secuenciaCompleta = true;
            estadoF.respondioPostSecuencia = false;
            estadoF.seguimiento1Enviado = false;
            estadoF.seguimiento2Enviado = false;
            estadoF.seguimiento3Enviado = false;
            estadoF.seguimiento7dEnviado = false;
        }

        programarSeguimientosB(userId, esEspanol, phone);

    } catch (err) {
        console.error('❌ Error secuencia B:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function manejarOpcionMenuB(userId, opcionNum, esEspanol, phone) {
    const estado = userStates.get(userId);
    if (!estado || !estado.menuMapa) return;

    const opcionElegida = estado.menuMapa.find(o => o.num === opcionNum);
    if (!opcionElegida) return;

    const idOriginal = opcionElegida.id;
    estado.opcionesUsadas.push(idOriginal);
    estado.respondioPostSecuencia = true;

    processingUsers.set(userId, Date.now());
    const numPedido = estado.numPedido || '';

    if (idOriginal === '1') {
        await sendText(userId, getMensajeFormulario(phone, esEspanol) + (numPedido ? '\n\n_# Pedido: ' + numPedido + '_' : ''));
        await sleep(2000);
        await sendText(userId, esEspanol ? 'Si tiene alguna pregunta, estamos para servirle ✨' : 'If you have any questions, we are here to help you ✨');
        estado.paso = 'libre';
        estado.conversacionLibre = true;
        processingUsers.delete(userId);
        return;
    }

    if (idOriginal === '2') {
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo,
            esEspanol
                ? '¡Con todo cariño le enviamos nuestro catálogo! 🎉\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un diseño único según sus colores e ideas. 💛'
                : 'Here is our catalog! 🎉\n\nTake a look: https://invitartes.com/catalogo/ 💛');
    }

    if (idOriginal === '3') {
        await sendText(userId, esEspanol
            ? '💍 *Diferencia entre DELUXE y ÉLITE*\n\nVisualmente ambos paquetes se parecen mucho — la diferencia principal está en la *plataforma* y las *funcionalidades*.\n\n*DELUXE — $105*\n✅ Invitaciones personalizadas con nombre y número de pases\n✅ Hasta 4 fotos + música\n✅ Las invitaciones se generan *por pedido* — si al inicio solicita 80, se activan las 80. Si después de la entrega final necesita más, cada pedido adicional tiene un costo de *$10*, sea que pida 1 o 20 invitaciones más.\n\n*ÉLITE — $130 👑*\n✅ Todo lo del Deluxe, más:\n♾️ *Invitaciones ilimitadas* — genera todas las que necesite sin costo adicional\n📊 Contadores en tiempo real de pases, invitaciones e invitados\n✅ Registro de asistentes el día del evento\n💬 Reconfigura el mensaje de WhatsApp de todas las invitaciones globalmente\n🪑 Establece número de mesa antes o después de enviar\n📅 Fecha máxima de confirmación\n📥 Bandeja de entrada con mensajes de todos sus invitados\n📸 Galería en vivo con las fotos que envían sus invitados\n\n*En resumen:* si va a invitar a muchas personas y quiere control total de su evento, el *ÉLITE* es la mejor inversión. 👑'
            : '💍 *Difference between DELUXE and ELITE*\n\nVisually both packages look very similar — the main difference is in the *platform* and *features*.\n\n*DELUXE — $105*\n✅ Personalized invitations with name and number of passes\n✅ Up to 4 photos + music\n✅ Invitations generated *per order* — if you request 80 at first, 80 are activated. Each additional order costs *$10*, whether you request 1 or 20 more.\n\n*ELITE — $130 👑*\n✅ Everything in Deluxe, plus:\n♾️ *Unlimited invitations* — generate as many as you need at no extra cost\n📊 Real-time counters for passes, invitations and guests\n✅ Attendance registration on event day\n💬 Globally reconfigure WhatsApp messages\n🪑 Set table numbers before or after sending\n📅 Maximum confirmation date\n📥 Inbox with messages from all guests\n📸 Live gallery with photos from guests\n\n*In summary:* if you plan to invite many people and want full control, *ELITE* is the best investment. 👑');
    }

    if (idOriginal === '4') {
        await sendText(userId, esEspanol ? '🎧 Le explicamos brevemente cómo funciona nuestra plataforma:' : '🎧 Here is a brief explanation of how our platform works:');
        await sleep(800);
        await sendAudio(userId, FIREBASE_URLS.audio);
        await sleep(2000);
        await sendText(userId, esEspanol
            ? '🔗 Aquí puede ver todas las características detalladas:\n\n👉 https://invitartes.com/caracteristicas/'
            : '🔗 Here you can see all the detailed features:\n\n👉 https://invitartes.com/caracteristicas/');
        await sleep(2000);
        const imagenAbono = (estado.tipoEvento === 'xv') ? FIREBASE_URLS.imagenAbono15 : FIREBASE_URLS.imagenAbonoBoda;
        let paquetesText2;
        if (estado.tipoEvento === 'xv') {
            paquetesText2 = esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n*ESSENTIAL* — $85\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ÉLITE* — $130 👑\n👉 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '🎁 *Our Packages*\n\n*ESSENTIAL* — $85\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ELITE* — $130 👑\n👉 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else {
            paquetesText2 = esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n*ESSENTIAL* — $85\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\n👉 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ÉLITE* — $130 👑\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\n\n*ESSENTIAL* — $85\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\n👉 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ELITE* — $130 👑\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }
        await sendImage(userId, imagenAbono, paquetesText2);
    }

    await sleep(2000);
    if (userStates.get(userId)?.duenoAtendio) return;

    const opcionesRestantes = estado.opcionesUsadas;
    const nuevoMenu = getMenuPostPaquetes(opcionesRestantes, esEspanol);

    if (nuevoMenu.mapa.length === 0) {
        await sendText(userId, esEspanol ? 'Si tiene alguna pregunta más, estamos para servirle. ✨' : 'If you have any more questions, we are here to help you. ✨');
        estado.paso = 'libre';
        estado.conversacionLibre = true;
    } else {
        await sendText(userId, nuevoMenu.texto);
        estado.menuMapa = nuevoMenu.mapa;
        estado.intentoMenuB = 0;
    }

    processingUsers.delete(userId);
}

function programarSeguimientosB(userId, esEspanol, phone) {
    const now = new Date();

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, getMensajeFormulario(phone, esEspanol) + (e.numPedido ? '\n\n_# Pedido: ' + e.numPedido + '_' : ''));
                await sleep(1500);
                await sendText(userId, esEspanol ? 'Si tiene alguna pregunta, estamos para servirle ✨' : 'If you have any questions, we are here to help you ✨');
                e.seguimiento1Enviado = true;
            } catch { console.log('⚠️ Error seg B 1'); }
        }
    }, 7 * 60 * 1000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol
                    ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tiene alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarle ✨'
                    : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨');
                e.seguimiento2Enviado = true;
            } catch { console.log('⚠️ Error seg B 2'); }
        }
    }, 14 * 60 * 1000);

    const manana1217 = new Date(now);
    manana1217.setDate(manana1217.getDate() + 1);
    manana1217.setHours(17, 17, 0, 0);
    const ms1217 = Math.max(manana1217.getTime() - now.getTime(), 60000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol
                    ? '¿Cómo está? Le saluda *Cristopher* de *Invitartes*, muy buenas tardes. Ayer nos escribió preguntando por nuestros paquetes, quería saber si tiene alguna pregunta en la que pueda ayudarle.. 😊'
                    : 'How are you? This is *Cristopher* from *Invitartes*, good afternoon. Yesterday you wrote to us asking about our packages, I wanted to know if there is any question I can help you with.. 😊');
                e.seguimiento3Enviado = true;
            } catch { console.log('⚠️ Error seg B 3'); }
        }
    }, ms1217);

    const siete1215 = new Date(now);
    siete1215.setDate(siete1215.getDate() + 7);
    siete1215.setHours(17, 15, 0, 0);
    const ms7d = Math.max(siete1215.getTime() - now.getTime(), 60000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento7dEnviado && !e.duenoAtendio) {
            try {
                const imgRem = (e.tipoEvento === 'xv') ? FIREBASE_URLS.imagenRemarketingQuince : FIREBASE_URLS.imagenRemarketingBoda;
                await sendImage(userId, imgRem, esEspanol
                    ? '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $50).\n\nTe entregamos un PDF personalizado con un código QR para colocar en las mesas de tu evento. Tus invitados lo escanean y suben sus fotos directo a una galería exclusiva. 📸\n\n✨ Todos los momentos especiales en un solo lugar.\n\nPuedes empezar con solo *$10 de abono*.\n🛡️ Si no te encanta, te devolvemos tu dinero.\n\n¿Todavía necesitas la invitación? 😊'
                    : 'Hello! 👋 A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? ✨\n\n🎁 The next 15 reservations receive our Premium Photo Page with QR *FREE* (valued at $50).\n\nStart with only *$10 deposit*.\n🛡️ If you don\'t love it, we\'ll refund your money.\n\nDo you still need the invitation? 😊');
                e.seguimiento7dEnviado = true;
            } catch { console.log('⚠️ Error seg B 7d'); }
        }
    }, ms7d);
}

// ============ FLUJO A — Seguimientos ============
function programarSeguimientosGenerales(userId, esEspanol, phone) {
    const now = new Date();

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol
                    ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tiene alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarle ✨'
                    : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions?\n\nI am here to help you ✨');
                e.seguimiento1Enviado = true;
            } catch { console.log('⚠️ Error seg 1'); }
        }
    }, 7 * 60 * 1000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol
                    ? 'Le dejo algunos ejemplos más por si gusta revisarles:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda Pasaporte: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduación: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nPara comenzar:\n📝 ' + FORM + '\n\nQuedo atenta 💛'
                    : 'Here are some more examples:\n\n• Sweet 15: https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Passport Wedding: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduation: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nTo get started:\n📝 ' + FORM + '\n\nI am here for you 💛');
                e.seguimiento2Enviado = true;
            } catch { console.log('⚠️ Error seg 2'); }
        }
    }, 14 * 60 * 1000);

    const manana1145 = new Date(now);
    manana1145.setDate(manana1145.getDate() + 1);
    manana1145.setHours(16, 45, 0, 0);
    const ms1145 = Math.max(manana1145.getTime() - now.getTime(), 60000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol
                    ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*.\n\nAyer nos escribió preguntando sobre nuestras invitaciones y quería saber, ¿pudo revisar los paquetes? ¿Le quedó alguna duda? 😊\n\nCon nuestras invitaciones puede tener:\n\n💌 Diseño único según su temática\n✅ Confirmaciones automáticas\n🎵 Música y galería de fotos\n📊 Panel en tiempo real\n🌍 Envío instantáneo\n\nTodo desde *$85 USD* — entrega en máximo 5 días.\n\nCuando esté listo/a:\n📝 ' + FORM + ' 🎨✨'
                    : 'Hello! 👋 I am *Carolina* from *Invitartes*.\n\nYesterday you wrote to us — were you able to review the packages? Any questions? 😊\n\nAll from *$85 USD* — delivered in maximum 5 days.\n\n📝 ' + FORM + ' 🎨✨');
                e.seguimiento3Enviado = true;
            } catch { console.log('⚠️ Error seg 3'); }
        }
    }, ms1145);

    const siete1215 = new Date(now);
    siete1215.setDate(siete1215.getDate() + 7);
    siete1215.setHours(17, 15, 0, 0);
    const ms7d = Math.max(siete1215.getTime() - now.getTime(), 60000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento7dEnviado && !e.duenoAtendio) {
            try {
                const imgRem = (e.tipoEvento === 'xv') ? FIREBASE_URLS.imagenRemarketingQuince : FIREBASE_URLS.imagenRemarketingBoda;
                await sendImage(userId, imgRem, esEspanol
                    ? '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $50).\n\nTe entregamos un PDF personalizado con un código QR para colocar en las mesas de tu evento. Tus invitados lo escanean y suben sus fotos directo a una galería exclusiva. 📸\n\n✨ Todos los momentos especiales en un solo lugar.\n\nPuedes empezar con solo *$10 de abono*.\n🛡️ Si no te encanta, te devolvemos tu dinero.\n\n¿Todavía necesitas la invitación? 😊'
                    : 'Hello! 👋 A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? ✨\n\n🎁 The next 15 reservations receive our Premium Photo Page with QR *FREE* (valued at $50).\n\nStart with only *$10 deposit*.\n🛡️ If you don\'t love it, we\'ll refund your money.\n\nDo you still need the invitation? 😊');
                e.seguimiento7dEnviado = true;
            } catch { console.log('⚠️ Error seg 7d'); }
        }
    }, ms7d);
}

async function enviarFlujoPaquetes(userId, esEspanol, tipoEvento, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? '🔗 Le invitamos a visitar este enlace donde podrá conocer cómo funciona nuestra plataforma:\n\n👉 https://invitartes.com/caracteristicas/'
            : '🔗 Visit this link to learn how our platform works:\n\n👉 https://invitartes.com/caracteristicas/');

        if (esEspanol) {
            await sleep(1500);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendText(userId, '🎧 Le explicamos brevemente nuestros paquetes en el siguiente audio:');
            await sleep(800);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendAudio(userId, FIREBASE_URLS.audio);
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const imagenAbono = (tipoEvento === 'xv') ? FIREBASE_URLS.imagenAbono15 : FIREBASE_URLS.imagenAbonoBoda;

        let paquetesText;
        if (tipoEvento === 'xv') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations and more.\n👉 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else if (tipoEvento === 'boda') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations and more.\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        } else {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations and more.\n👉 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }

        await sendImage(userId, imagenAbono, paquetesText);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const estado = userStates.get(userId);
        const numPedido = estado?.numPedido || '';

        await sendText(userId,
            (esEspanol
                ? 'Para iniciar con el proceso, por favor complete el siguiente formulario:\n📝 ' + FORM + '\n\nO si lo prefiere, también puede enviarnos por WhatsApp los detalles.\n\nUna vez recibamos la información, nos comprometemos a entregarle las invitaciones en un plazo máximo de *5 días*.\n\n'
                : 'To start the process, please fill out the following form:\n📝 ' + FORM + '\n\nOr send us the details via WhatsApp.\n\nWe commit to delivering your invitations within a maximum of *5 days*.\n\n') +
            getDatosBancarios(phone, esEspanol) +
            (numPedido ? '\n\n_# Pedido: ' + numPedido + '_' : '')
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? 'Si tiene alguna pregunta, por favor coméntenos, estamos para servirle ✨'
            : 'If you have any questions, please let us know, we are here to help you ✨');

        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
            estado.seguimiento3Enviado    = false;
            estado.seguimiento7dEnviado   = false;
        }

        programarSeguimientosGenerales(userId, esEspanol, phone);

    } catch (err) {
        console.error('❌ Error flujo paquetes:', err.message);
    }
}

async function enviarSecuenciaXV(userId, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.tipoEvento = 'xv'; estado.esEspanol = true; }

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, '¡Qué emoción! 👑💕\n\nSabemos que organizar unos XV puede ser emocionante, pero también traer muchas dudas y organización.\n\nPor eso en *Invitartes* no solo diseñamos invitaciones digitales.\n\nLe ofrecemos una plataforma que le ayuda a mantener todo bajo control para que pueda disfrutar mucho más este momento junto a su hija. 💛');
        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Con nuestra plataforma podrá:\n\n✅ Confirmaciones de asistencia en tiempo real.\n✅ Control total de invitados.\n✅ Invitados informados desde un solo lugar.\n✅ Invitación digital totalmente personalizada.\n✅ Galería colaborativa de fotografías.\n✅ Reportes y estadísticas.\n\n✨ Además, contamos con funciones exclusivas desarrolladas por *Invitartes* que preferimos explicar durante la asesoría, ya que forman parte del valor diferencial de nuestra plataforma — *única en el mercado*. 👑');
        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenLucy, '*Ejemplo 1* 🌸✨\n\nÉrase una vez una princesa que soñaba con esta noche... Lucy te invita a vivir su cuento de hadas. 👑\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/');
        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenRafaela, '*Ejemplo 2* 🌸✨\n\nRafaela te invita a descubrir cómo continúa su historia. 👑💕\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/');
        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo, '¡Con todo cariño le enviamos nuestro catálogo! 🎉\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un diseño único. 💛');

        await enviarFlujoPaquetes(userId, true, 'xv', phone);

        const now = new Date();
        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && !e2.seguimiento1Enviado && !e2.duenoAtendio) {
                try {
                    await sendImage(userId, FIREBASE_URLS.imagenSheyla, '¡Ah, mira! 👑✨ Si necesita algo temático, le comparto este ejemplo.\n\n*Ejemplo 3* 🌸✨\nSheyla quiere que seas parte de su cuento. 👑✨\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-sheyla-muestra/');
                    e2.seguimiento1Enviado = true;
                } catch { console.log('⚠️ Error seg XV 1'); }
            }
        }, 7 * 60 * 1000);

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && e2.seguimiento1Enviado && !e2.seguimiento2Enviado && !e2.duenoAtendio) {
                try {
                    await sendText(userId, '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tiene alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarle ✨');
                    e2.seguimiento2Enviado = true;
                } catch { console.log('⚠️ Error seg XV 2'); }
            }
        }, 14 * 60 * 1000);

        const manana1145 = new Date(now);
        manana1145.setDate(manana1145.getDate() + 1);
        manana1145.setHours(16, 45, 0, 0);
        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && !e2.seguimiento3Enviado && !e2.duenoAtendio) {
                try {
                    await sendText(userId, '¿Cómo está?.. Ayer nos escribió preguntando sobre las invitaciones para XV años y quería saber, ¿pudo revisarlos?.. Si le quedó alguna duda coméntenos sin problema, estamos para servirle 😊');
                    e2.seguimiento3Enviado = true;
                } catch { console.log('⚠️ Error seg XV 3'); }
            }
        }, Math.max(manana1145.getTime() - now.getTime(), 60000));

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && e2.seguimiento3Enviado && !e2.seguimiento4Enviado && !e2.duenoAtendio) {
                try {
                    await sendText(userId, 'Aprovecho para contarle por qué somos la plataforma más completa para administrar el evento de su hija 🏆✨\n\nCon sus credenciales personalizadas, todo lo maneja desde un solo lugar:\n👥 Lista de invitados y confirmaciones automáticas\n📸 Galería de fotos compartida\n📊 Estadísticas en tiempo real\n\nAsí usted se enfoca en disfrutar los XV años. 👑💛\n\nPlanes desde *$85 USD*, entrega máx. 5 días.\n\n📝 ' + FORM + '\n\n¿Alguna pregunta antes de empezar? Aquí estoy 😊');
                    e2.seguimiento4Enviado = true;
                } catch { console.log('⚠️ Error seg XV 4'); }
            }
        }, (24 * 60 * 60 * 1000) + (10 * 60 * 1000));

    } catch (err) {
        console.error('❌ Error secuencia XV:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol, tipoEvento, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.tipoEvento = tipoEvento; estado.esEspanol = esEspanol; }

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? '¡Hola! 👋 Le saludamos de *Invitartes*, con gusto le contamos sobre nuestras invitaciones digitales ✨\n\n¿Sabía que su invitación puede ser toda una experiencia? 🤩\n\n🎨 Crea invitaciones ilimitadas y personalizadas\n🎵 Con música, fotos y videos incluidos\n💬 Recibe y ve todos los mensajes de sus invitados\n📸 Sus invitados pueden subir sus fotos directamente desde la invitación, ¡creando un álbum compartido en tiempo real!\n✅ Confirmaciones en tiempo real\n🌍 Llega a todo el mundo en segundos\n📊 *Plataforma privada* con contadores en tiempo real, fecha máxima de confirmación, invitaciones ilimitadas y escáner QR opcional'
            : 'Hello! 👋 Greetings from *Invitartes*, we are happy to tell you about our digital invitations ✨\n\nDid you know your invitation can be a whole experience? 🤩\n\n🎨 Create unlimited and personalized invitations\n🎵 With music, photos and videos included\n💬 Receive and view all messages from your guests\n📸 Your guests can upload their photos directly from the invitation, creating a shared album in real time!\n✅ Real-time confirmations\n🌍 Reaches anywhere in the world in seconds\n📊 *Private platform* with real-time counters, unlimited invitations and optional QR scanner');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres, esEspanol
            ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino... 🌹\n\nConfirme su asistencia 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
            : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny... 🌹\n\nConfirm your attendance 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        if (tipoEvento === 'otro') {
            await sendImage(userId, FIREBASE_URLS.imagenLia, esEspanol
                ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... 🎀\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... 🎀\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/');
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenBoda2, esEspanol
                ? '💌 *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ 🖤🤍'
                : '💌 *A love dressed in black and white...*\n\nHugo & Nickole\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ 🖤🤍');
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo, esEspanol
            ? '¡Con todo cariño le enviamos nuestro catálogo! 🎉\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un diseño único. 💛'
            : 'We are happy to share our catalog with you! 🎉\n\nTake a look: https://invitartes.com/catalogo/ 💛');

        await enviarFlujoPaquetes(userId, esEspanol, tipoEvento, phone);

    } catch (err) {
        console.error('❌ Error secuencia:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version, auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Invitartes Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) { qrCodeData = await QRCode.toDataURL(qr); isConnected = false; }
        if (connection === 'close') {
            isConnected = false; qrCodeData = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 3000);
        }
        if (connection === 'open') { isConnected = true; qrCodeData = ''; console.log('✅ Bot conectado!'); }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const message of messages) {
            try {
                if (message.key.remoteJid?.endsWith('@g.us')) continue;
                const userId = message.key.remoteJid;
                const phone = userId ? userId.replace('@s.whatsapp.net', '') : '';

                if (message.key.fromMe) {
                    let e = userStates.get(userId);
                    if (!e) {
                        userStates.set(userId, {
                            paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                            intentoMenu: 0, secuenciaCompleta: false,
                            respondioPostSecuencia: false, seguimiento1Enviado: false,
                            seguimiento2Enviado: false, seguimiento3Enviado: false,
                            seguimiento4Enviado: false, seguimiento7dEnviado: false,
                            duenoAtendio: true, conversacionLibre: false, flujo: null, numPedido: null
                        });
                    } else { e.duenoAtendio = true; }
                    console.log('👤 Dueño atendió: ' + userId);
                    continue;
                }

                const messageText = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
                if (!messageText) continue;
                const msgNorm = normalizarNumero(messageText);
                console.log('📩 ' + phone + ': "' + messageText + '"');

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                // Keyword asesor
                if (estado && !estado.duenoAtendio && !estado.conversacionLibre && esKeywordAsesor(messageText)) {
                    processingUsers.set(userId, Date.now());
                    await enviarMensajeAsesorSolicitado(userId, estado.esEspanol !== false);
                    continue;
                }

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    clienteContador++;
                    const flujoAsignado = (clienteContador % 2 === 0) ? 'B' : 'A';
                    if (flujoAsignado === 'A') contadorFlujoA++;
                    else contadorFlujoB++;
                    const numPedido = flujoAsignado === 'A'
                        ? 'FA-' + String(contadorFlujoA).padStart(3, '0')
                        : 'FB-' + String(contadorFlujoB).padStart(3, '0');

                    userStates.set(userId, {
                        paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                        intentoMenu: 0, secuenciaCompleta: false,
                        respondioPostSecuencia: false, seguimiento1Enviado: false,
                        seguimiento2Enviado: false, seguimiento3Enviado: false,
                        seguimiento4Enviado: false, seguimiento7dEnviado: false,
                        duenoAtendio: false, conversacionLibre: false,
                        flujo: flujoAsignado, numPedido, menuMapa: null, opcionesUsadas: [], intentoMenuB: 0
                    });
                    estado = userStates.get(userId);
                    console.log('🔀 Cliente #' + clienteContador + ' → Flujo ' + flujoAsignado + ' | ' + numPedido);

                    if (esKeywordGuia(messageText)) {
                        estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error);
                        continue;
                    }

                    if (esAngloparlante(phone)) {
                        estado.paso = 'pregunta_idioma';
                        enviarPreguntaIdioma(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else {
                        enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }

                if (estado.duenoAtendio) continue;

                if (estado.paso === 'bienvenida' && esKeywordGuia(messageText)) {
                    processingUsers.set(userId, Date.now());
                    estado.paso = 'guia_segmento';
                    enviarGuiaGratuita(userId, estado.esEspanol !== false).catch(console.error);
                    processingUsers.delete(userId);
                    continue;
                }

                if (estado.paso === 'pregunta_idioma') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true; estado.paso = 'bienvenida';
                        enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = false; estado.paso = 'bienvenida_en';
                        enviarBienvenidaIngles(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarPreguntaIdioma(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }

                if (estado.paso === 'bienvenida_en') {
                    const opciones = { '1': 'boda', '2': 'xv', '3': 'otro' };
                    if (opciones[msgNorm]) {
                        processingUsers.set(userId, Date.now()); estado.paso = 'en_secuencia';
                        const t = opciones[msgNorm];
                        if (estado.flujo === 'B') {
                            enviarSecuenciaBoda_B(userId, false, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else if (t === 'xv') {
                            enviarSecuenciaXV(userId, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            enviarSecuencia(userId, false, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        }
                    } else if (msgNorm === '4') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, false).catch(console.error);
                        processingUsers.delete(userId);
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarBienvenidaIngles(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }

                if (estado.paso === 'guia_segmento') {
                    const mapa = { '1': 'boda', '2': 'xv', '3': 'otro' };
                    const tipo = mapa[msgNorm];
                    if (tipo) {
                        processingUsers.set(userId, Date.now());
                        estado.tipoEvento = tipo; estado.paso = 'guia_puente';
                        enviarPuenteEmocional(userId, tipo, estado.esEspanol !== false).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }

                if (estado.paso === 'guia_permiso') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'en_secuencia';
                        enviarFlujoPaquetes(userId, estado.esEspanol !== false, estado.tipoEvento || 'boda', phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        await sendText(userId, '¡Perfecto! Disfruta la guía y si más adelante necesitas algo, aquí estamos. 💛');
                        estado.conversacionLibre = true; estado.paso = 'libre';
                    }
                    continue;
                }

                if (estado.paso === 'flujoB_menu') {
                    if (estado.menuMapa && estado.menuMapa.find(o => o.num === msgNorm)) {
                        estado.intentoMenuB = 0;
                        await manejarOpcionMenuB(userId, msgNorm, estado.esEspanol !== false, phone);
                    } else {
                        estado.intentoMenuB = (estado.intentoMenuB || 0) + 1;
                        if (estado.intentoMenuB === 1) {
                            processingUsers.set(userId, Date.now());
                            const menu = getMenuPostPaquetes(estado.opcionesUsadas || [], estado.esEspanol !== false);
                            await sendText(userId, menu.texto);
                            processingUsers.delete(userId);
                        } else {
                            processingUsers.set(userId, Date.now());
                            await enviarMensajeAsesorFinal(userId);
                        }
                    }
                    continue;
                }

                if (estado.paso === 'bienvenida') {
                    const opciones = { '1': 'xv', '2': 'boda', '3': 'otro' };
                    if (opciones[msgNorm]) {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true; estado.paso = 'en_secuencia';
                        const t = opciones[msgNorm];
                        if (estado.flujo === 'B') {
                            enviarSecuenciaBoda_B(userId, true, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else if (t === 'xv') {
                            enviarSecuenciaXV(userId, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            enviarSecuencia(userId, true, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        }
                    } else if (msgNorm === '4') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error);
                        processingUsers.delete(userId);
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) {
                            enviarMenuRepetido(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            enviarMensajeAsesorFinal(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        }
                    }
                    continue;
                }

                if (estado.secuenciaCompleta && estado.paso !== 'flujoB_menu') { estado.respondioPostSecuencia = true; continue; }
                if (estado.conversacionLibre || estado.paso === 'libre') continue;

            } catch (err) {
                console.error('❌ Error handler:', err.message);
            }
        }
    });
}

app.get('/', async (req, res) => {
    if (isConnected) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px}</style></head><body><div class="c"><h1>✅ Bot Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2></div></div></body></html>');
    } else if (qrCodeData) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:2rem;border-radius:20px;text-align:center;max-width:500px}h1{color:#667eea}img{max-width:280px}</style></head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><img src="' + qrCodeData + '" alt="QR"><p>Se actualiza cada 5 segundos</p></div></body></html>');
    } else {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:6px solid #f3f3f3;border-top:6px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style></head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando...</h1></div></body></html>');
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected, clienteContador, flujoA: contadorFlujoA, flujoB: contadorFlujoB });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT v7.1 (Baileys) — Flujo A/B + # Pedido');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
