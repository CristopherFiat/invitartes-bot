const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;

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
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://invitartes.com/plataforma-administracion-eventos/';
const GUIA = 'https://drive.google.com/file/d/1-20hT7sOjSJSd6poqRZb3jfYWB3c4ew5/view?usp=sharing';
const PAYPAL = 'https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC';

function esMexico(userId) {
    return userId && userId.startsWith('52');
}

function esAngloparlante(userId) {
    const prefijos = ['1', '44', '61', '64', '353', '27'];
    if (!userId) return false;
    return prefijos.some(p => userId.startsWith(p));
}

function esKeywordGuia(text) {
    const t = text.toLowerCase().trim();
    return t.includes('guía') || t.includes('guia') || t.includes('guide') ||
           t.includes('quiero la guía') || t.includes('quiero la guia') ||
           t.includes('guia gratuita') || t.includes('guía gratuita');
}

function getDatosBancarios(userId, esEspanol) {
    if (esMexico(userId)) {
        return esEspanol
            ? 'Podemos empezar con un abono inicial de *$170 pesos MXN*, que puede realizar al siguiente número:\n\n' +
              '🏦 *BBVA Bancomer*\n' +
              'Nombre: Uriel Dominguez Rodriguez\n' +
              'Tarjeta de débito: *4152 3143 4224 4319*\n\n' +
              'O por PayPal:\n👉 ' + PAYPAL + '\n\n' +
              'El saldo restante podrá ser cancelado en el momento de la entrega de sus invitaciones. ✨'
            : 'We can start with an initial deposit of *$170 MXN*, which you can send to:\n\n' +
              '🏦 *BBVA Bancomer*\n' +
              'Name: Uriel Dominguez Rodriguez\n' +
              'Debit card: *4152 3143 4224 4319*\n\n' +
              'Or via PayPal:\n👉 ' + PAYPAL + '\n\n' +
              'The remaining balance can be paid at the time of delivery of your invitations. ✨';
    } else if (!esEspanol) {
        return 'We can start with an initial deposit of *$10*, which you can send via:\n\n' +
               'Or via PayPal:\n👉 ' + PAYPAL + '\n\n' +
               'The remaining balance can be paid at the time of delivery of your invitations. ✨';
    } else {
        return 'Empezamos con un abono inicial de *$10*, que puede realizar al siguiente número de cuenta:\n\n' +
               '🏦 *Banco de Loja*\n' +
               'Número de cuenta: *2904553231*\n' +
               'Cédula: *1104753122*\n' +
               'Tipo de cuenta: Cuenta de ahorros _(cuenta activa)_\n' +
               'Titular: *ALVAREZ GRANDA, GUIDO CRISTOPHER*\n\n' +
               'El saldo restante podrá ser cancelado en el momento de la entrega de sus invitaciones. ✨';
    }
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
        await sendText(userId,
            '🌍 Hello! / ¡Hola!\n\n' +
            'In which language would you like to be assisted?\n' +
            '¿En qué idioma prefiere que le atendamos?\n\n' +
            '1️⃣ Español\n' +
            '2️⃣ English'
        );
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
            '🎉 Hello! Welcome to *Invitartes*.\n\n' +
            'We don\'t just design digital invitations — we offer you the *most complete event management platform on the market*, one of a kind. 💛\n\n' +
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
        await sendText(userId,
            '👩🏻‍💼 No hay problema, en unos minutos uno de nuestros asesores se comunicará con usted.\n\nEstamos para servirle, que tenga un excelente día. ✨'
        );
        const estado = userStates.get(userId);
        if (estado) {
            estado.conversacionLibre = true;
            estado.paso = 'libre';
        }
    } catch (err) {
        console.error('❌ Error mensaje asesor final:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarFlujoPaquetes(userId, esEspanol, tipoEvento) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '🔗 Le invitamos a visitar este enlace donde podrá conocer cómo funciona nuestra plataforma y ver las características detalladas de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
                : '🔗 We invite you to visit this link to learn how our platform works:\n\n👉 https://invitartes.com/caracteristicas/'
        );

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

        let paquetesText;
        if (tipoEvento === 'xv') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n' +
                  '*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n' +
                  '*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n' +
                  '*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n' +
                  '*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n' +
                  '*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n' +
                  '*ELITE* — $130 👑\nEverything in Deluxe + unlimited invitations + up to 20 photos + premium animations and more.\n👉 (ELITE Example) https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else if (tipoEvento === 'boda') {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n' +
                  '*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n' +
                  '*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n' +
                  '*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n' +
                  '*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n' +
                  '*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n' +
                  '*ELITE* — $130 👑\nEverything in Deluxe + unlimited invitations + up to 20 photos + premium animations and more.\n👉 (ELITE Example) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        } else {
            paquetesText = esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n' +
                  '*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n' +
                  '*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n' +
                  '*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n' +
                  '*ESSENTIAL* — $85\nTemplate-based, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n' +
                  '*DELUXE* — $105\nCustom design + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n' +
                  '*ELITE* — $130 👑\nEverything in Deluxe + unlimited invitations + up to 20 photos + premium animations and more.\n👉 (ELITE Example) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }
        await sendText(userId, paquetesText);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            (esEspanol
                ? 'Para iniciar con el proceso, por favor complete el siguiente formulario (Datos para sus invitaciones):\n📝 ' + FORM + '\n\nO si lo prefiere, también puede enviarnos por WhatsApp los detalles y la temática que desea.\n\nUna vez recibamos la información, nos comprometemos a entregarle las invitaciones en un plazo máximo de *5 días*.\n\n'
                : 'To start the process, please fill out the following form:\n📝 ' + FORM + '\n\nOr send us the details via WhatsApp.\n\nWe commit to delivering your invitations within a maximum of *5 days*.\n\n') +
            getDatosBancarios(userId, esEspanol)
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? 'Si tiene alguna pregunta, por favor coméntenos, estamos para servirle ✨'
                : 'If you have any questions, please let us know, we are here to help you ✨'
        );

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
            estado.seguimiento3Enviado    = false;
            estado.seguimiento7dEnviado   = false;
        }

        // Seguimiento 1 — 7 min
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tiene alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarle ✨'
                            : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨'
                    );
                    e.seguimiento1Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 1'); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 14 min
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? 'Le dejo algunos ejemplos más por si gusta revisarles:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda Pasaporte: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduación: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nPara comenzar:\n📝 ' + FORM + '\n\nQuedo atenta 💛'
                            : 'Here are some more examples:\n\n• Sweet 15 (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Passport Wedding: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduation: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nTo get started:\n📝 ' + FORM + '\n\nI am here for you 💛'
                    );
                    e.seguimiento2Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 2'); }
            }
        }, 14 * 60 * 1000);

        // Seguimiento 3 — 24h a las 11:45 am fijo
        const now = new Date();
        const manana1145 = new Date(now);
        manana1145.setDate(manana1145.getDate() + 1);
        manana1145.setHours(16, 45, 0, 0); // 11:45 Guayaquil = 16:45 UTC
        const ms1145 = manana1145.getTime() - now.getTime();

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*.\n\nAyer nos escribió preguntando sobre nuestras invitaciones digitales y quería saber, ¿pudo revisar los paquetes? ¿Le quedó alguna duda o necesita que le explique algo? 😊\n\nCon nuestras invitaciones puede tener:\n\n💌 Diseño único según su temática\n✅ Confirmaciones automáticas de asistencia\n🎵 Música y galería de fotos integradas\n📊 Panel para ver en tiempo real quiénes asisten\n🌍 Envío instantáneo a todos sus invitados\n\nTodo desde *$85 USD* — con entrega en máximo 5 días.\n\nCuando esté listo/a, llene este formulario y comenzamos:\n📝 ' + FORM + ' 🎨✨'
                            : 'Hello! 👋 I am *Carolina* from *Invitartes*.\n\nYesterday you wrote to us asking about our digital invitations — were you able to review the packages? Any questions? 😊\n\nWith our invitations you can have:\n\n💌 Unique design based on your theme\n✅ Automatic attendance confirmations\n🎵 Music and photo gallery included\n📊 Real-time panel to see who is attending\n🌍 Instant delivery to all your guests\n\nAll from *$85 USD* — delivered in maximum 5 days.\n\nWhen you are ready:\n📝 ' + FORM + ' 🎨✨'
                    );
                    e.seguimiento3Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 3'); }
            }
        }, ms1145);

        // Seguimiento 7 días — a las 12:15 pm fijo
        const siete1215 = new Date(now);
        siete1215.setDate(siete1215.getDate() + 7);
        siete1215.setHours(17, 15, 0, 0); // 12:15 Guayaquil = 17:15 UTC
        const ms7d = siete1215.getTime() - now.getTime();

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento7dEnviado && !e.duenoAtendio) {
                try {
                    const imgRem = (e.tipoEvento === 'xv') ? FIREBASE_URLS.imagenRemarketingQuince : FIREBASE_URLS.imagenRemarketingBoda;
                    await sendImage(userId, imgRem,
                        (esEspanol
                            ? '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n' +
                              '🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $50).\n\n' +
                              'Te entregamos un PDF personalizado con un código QR para colocar en las mesas o espacios de tu evento. Tus invitados simplemente lo escanean con su celular y pueden subir directamente las fotos que vayan tomando a una página exclusiva de tu evento. 📸\n\n' +
                              '✨ Las fotos se van reuniendo automáticamente en una galería colaborativa, para que al final tengas todos esos momentos especiales en un solo lugar.\n\n' +
                              'Y lo mejor: puedes empezar con solo *$10 de abono*.\n' +
                              '🛡️ Si no te encanta, te devolvemos tu dinero.\n\n' +
                              '¿Todavía necesitas la invitación para tu evento? 😊'
                            : 'Hello! 👋 A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? Because we have something new. ✨\n\n' +
                              '🎁 The next 15 reservations receive our Premium Photo Page with QR *FREE* (valued at $50).\n\n' +
                              'We deliver a personalized PDF with a QR code to place on the tables of your event. Your guests scan it and upload their photos directly to an exclusive gallery. 📸\n\n' +
                              '✨ All photos are automatically gathered in one collaborative gallery.\n\n' +
                              'And the best part: you can start with only *$10 deposit*.\n' +
                              '🛡️ If you don\'t love it, we\'ll refund your money.\n\n' +
                              'Do you still need the invitation for your event? 😊')
                    );
                    e.seguimiento7dEnviado = true;
                } catch { console.log('⚠️ Error seguimiento 7d'); }
            }
        }, ms7d);

    } catch (err) {
        console.error('❌ Error flujo paquetes:', err.message);
    }
}

async function enviarFlujoPaquetesCompleto(userId, esEspanol, tipoEvento) {
    try {
        const estado = userStates.get(userId);
        if (estado) {
            estado.tipoEvento = tipoEvento;
            estado.esEspanol = esEspanol;
        }
        await enviarFlujoPaquetes(userId, esEspanol, tipoEvento);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarGuiaGratuita(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        console.log('📖 Flujo Guía: ' + userId);

        await sendText(userId,
            '¡Aquí la tienes! 🎉\n\n' +
            '📖 ' + GUIA + '\n\n' +
            'Léela con calma — son 5 minutos que te van a ahorrar semanas de estrés.'
        );

        await sleep(5000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            'Por cierto, ¿para qué evento estás organizando? Así te puedo ayudar mejor 😊\n\n' +
            '1️⃣ Boda\n2️⃣ XV Años\n3️⃣ Otro evento\n\n✍️ Escriba solo el número para continuar.'
        );

        const estado = userStates.get(userId);
        if (estado) {
            estado.paso = 'guia_segmento';
        }
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
        if (tipoEvento === 'boda') {
            puente = '¡Qué emoción! 💒 Sabemos lo que es querer que cada detalle quede perfecto — sobre todo cuando es algo tan importante como tu boda.';
        } else if (tipoEvento === 'xv') {
            puente = '¡Qué bonito! 🎀 Los XV son un día que se recuerda para siempre — y cada detalle cuenta.';
        } else {
            puente = '¡Genial! 🎉 Sea el evento que sea, merece una invitación que trabaje por ti.';
        }

        await sendText(userId, puente);

        await sleep(3000);
        if (userStates.get(userId)?.duenoAtendio) return;

        // Enviar 2 ejemplos según tipo
        if (tipoEvento === 'boda') {
            await sendImage(userId, FIREBASE_URLS.imagenSobres,
                '✨ *Ejemplo 1 — Boda* ✨\n\n💍 Juan Pablo & Adriana...\n\nConfirme su asistencia 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
            );
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenBoda2,
                '💌 *Ejemplo 2 — Boda* ✨\n\nHugo & Nickole...\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/'
            );
        } else if (tipoEvento === 'xv') {
            await sendImage(userId, FIREBASE_URLS.imagenLucy,
                '*Ejemplo 1* 🌸✨\n\nÉrase una vez una princesa que soñaba con esta noche... Lucy te invita a vivir su cuento de hadas. 👑\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/'
            );
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenRafaela,
                '*Ejemplo 2* 🌸✨\n\nRafaela te invita a descubrir cómo continúa su historia. 👑💕\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/'
            );
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenSobres,
                '✨ *Ejemplo 1 — Boda* ✨\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
            );
            await sleep(2000);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenLia,
                '🌸 *Ejemplo 2 — XV años* 🌸\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
            );
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            'Sus invitados confirmaron directo desde ahí — sin llamadas, sin perseguir a nadie. 😊'
        );

        await sleep(5000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            '¿Te gustaría saber cómo funcionan nuestras invitaciones y cuánto cuestan? Te explico sin compromiso 😊\n\n' +
            '1️⃣ ✅ Sí, cuéntame\n' +
            '2️⃣ ❌ Ahora no, gracias\n\n' +
            '✍️ Escriba solo el número para continuar.'
        );

        const estado = userStates.get(userId);
        if (estado) {
            estado.paso = 'guia_permiso';
            estado.tipoEvento = tipoEvento;
        }
    } catch (err) {
        console.error('❌ Error puente emocional:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuenciaXV(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        console.log('📤 Secuencia XV: ' + userId);

        const estado = userStates.get(userId);
        if (estado) estado.tipoEvento = 'xv';

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            '¡Qué emoción! 👑💕\n\nSabemos que organizar unos XV puede ser emocionante, pero también traer muchas dudas y organización.\n\nPor eso en *Invitartes* no solo diseñamos invitaciones digitales.\n\nLe ofrecemos una plataforma que le ayuda a mantener todo bajo control para que pueda disfrutar mucho más este momento junto a su hija. 💛'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            'Con nuestra plataforma podrá:\n\n✅ Confirmaciones de asistencia en tiempo real.\n✅ Control total de invitados.\n✅ Invitados informados desde un solo lugar.\n✅ Invitación digital totalmente personalizada.\n✅ Galería colaborativa de fotografías.\n✅ Reportes y estadísticas.\n\n✨ Además, contamos con funciones exclusivas desarrolladas por *Invitartes* que preferimos explicar durante la asesoría, ya que forman parte del valor diferencial de nuestra plataforma — *única en el mercado*. 👑'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenLucy,
            '*Ejemplo 1* 🌸✨\n\nÉrase una vez una princesa que soñaba con esta noche... y hoy ese sueño se hace realidad. Lucy te invita a vivir su cuento de hadas. 👑\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenRafaela,
            '*Ejemplo 2* 🌸✨\n\nHabía una vez una historia que comenzaba con "Érase una vez"... Rafaela te invita a descubrir cómo continúa. 👑💕\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo,
            '¡Con todo cariño le enviamos nuestro catálogo! 🎉\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un diseño único según sus colores e ideas. 💛'
        );

        await enviarFlujoPaquetes(userId, true, 'xv');

        const estado2 = userStates.get(userId);
        if (estado2) {
            estado2.secuenciaCompleta      = true;
            estado2.respondioPostSecuencia = false;
            estado2.seguimiento1Enviado    = false;
            estado2.seguimiento2Enviado    = false;
            estado2.seguimiento3Enviado    = false;
            estado2.seguimiento4Enviado    = false;
            estado2.seguimiento7dEnviado   = false;
        }

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && !e2.seguimiento1Enviado && !e2.duenoAtendio) {
                try {
                    await sendImage(userId, FIREBASE_URLS.imagenSheyla,
                        '¡Ah, mira! 👑✨ Si necesita algo temático, le comparto este ejemplo.\n\n*Ejemplo 3* 🌸✨\nSheyla quiere que seas parte de su cuento. 👑✨\n\n👉 https://invitartes.com/erase-una-vez-mis-xv-anos-sheyla-muestra/'
                    );
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

        const now = new Date();
        const manana1145 = new Date(now);
        manana1145.setDate(manana1145.getDate() + 1);
        manana1145.setHours(16, 45, 0, 0);
        const ms1145 = manana1145.getTime() - now.getTime();

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && !e2.seguimiento3Enviado && !e2.duenoAtendio) {
                try {
                    await sendText(userId, '¿Cómo está?.. Ayer nos escribió preguntando sobre las invitaciones para XV años y quería saber, ¿pudo revisarlos?.. Si le quedó alguna duda coméntenos sin problema, estamos para servirle 😊');
                    e2.seguimiento3Enviado = true;
                } catch { console.log('⚠️ Error seg XV 3'); }
            }
        }, ms1145);

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && e2.seguimiento3Enviado && !e2.seguimiento4Enviado && !e2.duenoAtendio) {
                try {
                    await sendText(userId,
                        'Aprovecho para contarle por qué somos la plataforma más completa para administrar el evento de su hija 🏆✨\n\nCon sus credenciales personalizadas, todo lo maneja desde un solo lugar:\n👥 Lista de invitados y confirmaciones automáticas\n📸 Galería de fotos compartida\n📊 Estadísticas en tiempo real de quién ya confirmó\n\nAsí usted se enfoca en disfrutar los XV años, no en perseguir confirmaciones por WhatsApp 👑💛\n\nPlanes desde *$85 USD*, entrega máx. 5 días.\n\n📝 ' + FORM + '\n\n¿Alguna pregunta antes de empezar? Aquí estoy 😊'
                    );
                    e2.seguimiento4Enviado = true;
                } catch { console.log('⚠️ Error seg XV 4'); }
            }
        }, (24 * 60 * 60 * 1000) + (10 * 60 * 1000));

        const siete1215 = new Date(now);
        siete1215.setDate(siete1215.getDate() + 7);
        siete1215.setHours(17, 15, 0, 0);
        const ms7d = siete1215.getTime() - now.getTime();

        setTimeout(async () => {
            const e2 = userStates.get(userId);
            if (e2 && e2.secuenciaCompleta && !e2.respondioPostSecuencia && !e2.seguimiento7dEnviado && !e2.duenoAtendio) {
                try {
                    await sendImage(userId, FIREBASE_URLS.imagenRemarketingQuince,
                        '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $50).\n\nTe entregamos un PDF personalizado con un código QR para colocar en las mesas o espacios de tu evento. Tus invitados simplemente lo escanean y pueden subir directamente las fotos a una página exclusiva. 📸\n\n✨ Las fotos se van reuniendo automáticamente en una galería colaborativa.\n\nY lo mejor: puedes empezar con solo *$10 de abono*.\n🛡️ Si no te encanta, te devolvemos tu dinero.\n\n¿Todavía necesitas la invitación para tu evento? 😊'
                    );
                    e2.seguimiento7dEnviado = true;
                } catch { console.log('⚠️ Error seg XV 7d'); }
            }
        }, ms7d);

    } catch (err) {
        console.error('❌ Error secuencia XV:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol, tipoEvento) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;

        const estado = userStates.get(userId);
        if (estado) {
            estado.tipoEvento = tipoEvento;
            estado.esEspanol = esEspanol;
        }

        console.log('📤 Secuencia: ' + userId + ' | ' + (esEspanol ? 'ES' : 'EN') + ' | ' + tipoEvento);

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '¡Hola! 👋 Le saludamos de *Invitartes*, con gusto le contamos sobre nuestras invitaciones digitales ✨\n\n¿Sabía que su invitación puede ser toda una experiencia? 🤩\n\n🎨 Crea invitaciones ilimitadas y personalizadas\n🎵 Con música, fotos y videos incluidos\n💬 Recibe y ve todos los mensajes de sus invitados\n📸 Sus invitados pueden subir sus fotos directamente desde la invitación, ¡creando un álbum compartido en tiempo real!\n✅ Confirmaciones en tiempo real\n🌍 Llega a todo el mundo en segundos\n📊 *Plataforma privada* con contadores en tiempo real, fecha máxima de confirmación, invitaciones ilimitadas y escáner QR opcional'
                : 'Hello! 👋 Greetings from *Invitartes*, we are happy to tell you about our digital invitations ✨\n\nDid you know your invitation can be a whole experience? 🤩\n\n🎨 Create unlimited and personalized invitations\n🎵 With music, photos and videos included\n💬 Receive and view all messages from your guests\n📸 Your guests can upload their photos directly from the invitation, creating a shared album in real time!\n✅ Real-time confirmations\n🌍 Reaches anywhere in the world in seconds\n📊 *Private platform* with real-time counters, max confirmation date, unlimited invitations and optional QR scanner'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece ser celebrado de la manera más especial. 💫\n\nConfirme su asistencia 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nConfirm your attendance 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        if (tipoEvento === 'otro') {
            await sendImage(userId, FIREBASE_URLS.imagenLia,
                esEspanol
                    ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... los XV años son uno de ellos. 🎀\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                    : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... 🎀\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
            );
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenBoda2,
                esEspanol
                    ? '💌 *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole te invitan a ser parte del día más importante de sus vidas.\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ 🖤🤍'
                    : '💌 *A love dressed in black and white...*\n\nHugo & Nickole invite you to be part of the most important day of their lives.\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ 🖤🤍'
            );
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo,
            esEspanol
                ? '¡Con todo cariño le enviamos nuestro catálogo! 🎉\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un diseño único según sus colores e ideas. 💛'
                : 'We are happy to share our catalog with you! 🎉\n\nTake a look: https://invitartes.com/catalogo/ 💛'
        );

        await enviarFlujoPaquetes(userId, esEspanol, tipoEvento);

        const estado2 = userStates.get(userId);
        if (estado2) {
            estado2.secuenciaCompleta      = true;
            estado2.respondioPostSecuencia = false;
            estado2.seguimiento1Enviado    = false;
            estado2.seguimiento2Enviado    = false;
            estado2.seguimiento3Enviado    = false;
            estado2.seguimiento7dEnviado   = false;
        }

    } catch (err) {
        console.error('❌ Error secuencia:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sleep(1500);
        await sendText(userId,
            esEspanol
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto con usted.\n\nPor favor permanezca en línea 🙏\n\nSerá un placer atenderle. ✨'
                : '👩🏻‍💼 Perfect! One of our advisors will contact you shortly.\n\nPlease stay online 🙏\n\nIt will be a pleasure to assist you. ✨'
        );
    } catch (err) {
        console.error('❌ Error asesor:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Invitartes Bot', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('📱 QR generado');
            qrCodeData = await QRCode.toDataURL(qr);
            isConnected = false;
        }
        if (connection === 'close') {
            isConnected = false;
            qrCodeData = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 3000);
        }
        if (connection === 'open') {
            isConnected = true;
            qrCodeData = '';
            console.log('✅ Bot conectado!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const message of messages) {
            try {
                if (message.key.remoteJid?.endsWith('@g.us')) continue;
                const userId = message.key.remoteJid;
                const phoneNumber = userId ? userId.replace('@s.whatsapp.net', '') : '';

                if (message.key.fromMe) {
                    let e = userStates.get(userId);
                    if (!e) {
                        userStates.set(userId, {
                            paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                            intentoMenu: 0, secuenciaCompleta: false,
                            respondioPostSecuencia: false, seguimiento1Enviado: false,
                            seguimiento2Enviado: false, seguimiento3Enviado: false,
                            seguimiento4Enviado: false, seguimiento7dEnviado: false,
                            duenoAtendio: true, conversacionLibre: false
                        });
                    } else {
                        e.duenoAtendio = true;
                    }
                    console.log('👤 Dueño atendió a: ' + userId);
                    continue;
                }

                const messageText = (
                    message.message?.conversation ||
                    message.message?.extendedTextMessage?.text || ''
                ).trim();
                if (!messageText) continue;
                console.log('📩 ' + userId + ': "' + messageText + '"');

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                        intentoMenu: 0, secuenciaCompleta: false,
                        respondioPostSecuencia: false, seguimiento1Enviado: false,
                        seguimiento2Enviado: false, seguimiento3Enviado: false,
                        seguimiento4Enviado: false, seguimiento7dEnviado: false,
                        duenoAtendio: false, conversacionLibre: false
                    });
                    estado = userStates.get(userId);

                    // Detectar keyword guía
                    if (esKeywordGuia(messageText)) {
                        estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error);
                        continue;
                    }

                    // Detectar idioma por país
                    if (esAngloparlante(phoneNumber)) {
                        estado.paso = 'pregunta_idioma';
                        enviarPreguntaIdioma(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else {
                        enviarBienvenida(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                if (estado.duenoAtendio) continue;

                // Keyword guía en cualquier momento del paso bienvenida
                if (estado.paso === 'bienvenida' && esKeywordGuia(messageText)) {
                    processingUsers.set(userId, Date.now());
                    estado.paso = 'guia_segmento';
                    enviarGuiaGratuita(userId, estado.esEspanol !== false).catch(console.error);
                    processingUsers.delete(userId);
                    continue;
                }

                // Pregunta de idioma (angloparlantes)
                if (estado.paso === 'pregunta_idioma') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.paso = 'bienvenida';
                        enviarBienvenida(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = false;
                        estado.paso = 'bienvenida_en';
                        enviarBienvenidaIngles(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarPreguntaIdioma(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                // Menú inglés
                if (estado.paso === 'bienvenida_en') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, false, 'boda').catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuenciaXV(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '3') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, false, 'otro').catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '4') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, false).catch(console.error);
                        processingUsers.delete(userId);
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarBienvenidaIngles(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                // Flujo guía — segmentación
                if (estado.paso === 'guia_segmento') {
                    let tipo = null;
                    if (messageText === '1') tipo = 'boda';
                    else if (messageText === '2') tipo = 'xv';
                    else if (messageText === '3') tipo = 'otro';

                    if (tipo) {
                        processingUsers.set(userId, Date.now());
                        estado.tipoEvento = tipo;
                        estado.paso = 'guia_puente';
                        enviarPuenteEmocional(userId, tipo, estado.esEspanol !== false).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                // Flujo guía — permiso para vender
                if (estado.paso === 'guia_permiso') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarFlujoPaquetesCompleto(userId, estado.esEspanol !== false, estado.tipoEvento || 'boda').catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        await sendText(userId, '¡Perfecto! Disfruta la guía y si más adelante necesitas algo, aquí estamos. 💛');
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        processingUsers.delete(userId);
                    }
                    continue;
                }

                // Menú principal
                if (estado.paso === 'bienvenida') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.paso = 'en_secuencia';
                        enviarSecuenciaXV(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, true, 'boda').catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '3') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, true, 'otro').catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '4') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error);
                        processingUsers.delete(userId);
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) {
                            enviarMenuRepetido(userId).catch(err => {
                                console.error(err.message);
                                processingUsers.delete(userId);
                            });
                        } else {
                            enviarMensajeAsesorFinal(userId).catch(err => {
                                console.error(err.message);
                                processingUsers.delete(userId);
                            });
                        }
                    }
                    continue;
                }

                if (estado.secuenciaCompleta) {
                    estado.respondioPostSecuencia = true;
                    continue;
                }

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
    res.json({ status: 'ok', connected: isConnected });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT v6.0 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
