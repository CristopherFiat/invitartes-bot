const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;

const FIREBASE_URLS = {
    audio:        'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    imagenSobres: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/da.webp?alt=media&token=687cea05-0f0a-4d07-82c7-fd28cd0297fe',
    imagenLia:    'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/lia.webp?alt=media'
};

const userStates      = new Map();
const processingUsers = new Map();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FORM_ES = 'https://docs.google.com/forms/d/e/1FAIpQLSemjvJ7kdMHXojtciXBsaOOJFN1Zl8wFEG5DPc1ayfpSWZ67g/viewform?usp=header';
const FORM_EN = 'https://docs.google.com/forms/d/e/1FAIpQLSc3xqI5c4J6ElWNUTyYFccgJsPL4Br9qBF9bDHsyzV1t2jRrg/viewform?usp=header';

const CODIGOS_HISPANOS = [
    '1787', '1939', '1809', '1829', '1849',
    '593', '591', '595', '598', '506', '503', '502', '504', '505', '507', '240',
    '54', '56', '57', '53', '52', '51', '34', '58',
];

function esHispanohablante(userId) {
    const numero = userId.replace('@s.whatsapp.net', '').replace(/\D/g, '').trim();
    if (!numero || numero.length < 6) return true;
    const codesOrdenados = [...CODIGOS_HISPANOS].sort((a, b) => b.length - a.length);
    for (const codigo of codesOrdenados) {
        if (numero.startsWith(codigo)) {
            console.log(`🌍 +${codigo} → Español`);
            return true;
        }
    }
    console.log(`🌍 → Inglés (${numero.substring(0, 4)}...)`);
    return false;
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
        console.log(`⚠️ Error enviando audio`);
    }
}

async function enviarSelectorIdioma(userId) {
    try {
        await sendText(userId,
            '👋 ¡Hola! / Hi!\n\n' +
            'Por favor, selecciona tu idioma / Please select your language:\n\n' +
            '🇪🇸 *1* — Español\n' +
            '🇺🇸 *2* — English\n\n' +
            '✍️ Escribe solo el número *1* o *2* para continuar.\n' +
            '✍️ Type only the number *1* or *2* to continue.'
        );
    } catch (err) {
        console.error(`❌ Error selector idioma:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenu(userId, esEspanol) {
    try {
        await sleep(1000);
        await sendText(userId,
            esEspanol
                ? '¿En qué te puedo ayudar hoy?\n\n' +
                  '1️⃣ Quiero conocer las invitaciones digitales\n' +
                  '2️⃣ Prefiero hablar con un asesor\n\n' +
                  '✍️ Escribe solo el número *1 o 2* para continuar.'
                : 'How can I help you today?\n\n' +
                  '1️⃣ I want to learn about digital invitations\n' +
                  '2️⃣ I prefer to speak with an advisor\n\n' +
                  '✍️ Type only the number *1 or 2* to continue.'
        );
    } catch (err) {
        console.error(`❌ Error menú:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const form = esEspanol ? FORM_ES : FORM_EN;
        console.log(`📤 Secuencia: ${userId} | ${esEspanol ? 'ES' : 'EN'}`);

        await sleep(1500);
        await sendText(userId,
            esEspanol
                ? '¡Hola! 👋 Te saludamos de *Invitartes*, con gusto te contamos sobre nuestras invitaciones digitales ✨\n\n' +
                  '¿Sabías que tu invitación puede ser toda una experiencia? 🤩\n\n' +
                  '🎨 Crea invitaciones ilimitadas y personalizadas\n' +
                  '🎵 Con música, fotos y videos incluidos\n' +
                  '💬 Recibe y ve todos los mensajes de tus invitados\n' +
                  '📸 Tus invitados pueden subir sus fotos directamente desde la invitación, ¡creando un álbum compartido en tiempo real!\n' +
                  '✅ Confirmaciones en tiempo real\n' +
                  '🌍 Llega a todo el mundo en segundos'
                : 'Hello! 👋 Greetings from *Invitartes*, we are happy to tell you about our digital invitations ✨\n\n' +
                  'Did you know your invitation can be a whole experience? 🤩\n\n' +
                  '🎨 Create unlimited and personalized invitations\n' +
                  '🎵 With music, photos and videos included\n' +
                  '💬 Receive and view all messages from your guests\n' +
                  '📸 Your guests can upload their photos directly from the invitation, creating a shared album in real time!\n' +
                  '✅ Real-time confirmations\n' +
                  '🌍 Reaches anywhere in the world in seconds'
        );

        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece ser celebrado de la manera más especial. Te invitamos a ser parte de este momento único que guardaremos en el corazón para siempre. 💫\n\nConfirma tu asistencia dentro de la invitación 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
                : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nThe most beautiful love deserves to be celebrated in the most special way. We invite you to be part of this unique moment we will keep in our hearts forever. 💫\n\nConfirm your attendance inside the invitation 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
        );

        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenLia,
            esEspanol
                ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... los XV años son uno de ellos. 🎀\n\nUna noche mágica, llena de ilusión, luz y recuerdos que duran toda la vida. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... a Sweet 15 is one of them. 🎀\n\nA magical night, full of dreams, light and memories that last a lifetime. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
        );

        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? '🔗 Te invito a visitar este enlace donde podrás conocer cómo funciona nuestra plataforma de administración de invitaciones y ver las características detalladas de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
                : '🔗 Visit this link to learn how our invitation management platform works and see the detailed features of each package:\n\n👉 https://invitartes.com/caracteristicas/'
        );

        if (esEspanol) {
            await sleep(1500);
            await sendText(userId, '🎧 Te explico brevemente nuestros paquetes en el siguiente audio:');
            await sleep(800);
            await sendAudio(userId, FIREBASE_URLS.audio);
        }

        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '*ESSENTIAL — $85*\nBasado en plantilla, sencillo y bonito.\n👉 https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE — $105*\nDiseño personalizado + imágenes y plataforma de envíos.\n👉 https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE — $130* 👑\nTodo lo del Deluxe + invitaciones ilimitadas, íconos animados, fecha máxima de confirmación y más.\n👉 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💳 _Pago único · Sin suscripción_'
                : '🎁 *Our Packages*\n\n' +
                  '*ESSENTIAL — $85*\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE — $105*\nCustom design + photos and sending platform.\n👉 https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE — $130* 👑\nEverything in Deluxe + unlimited invitations, animated icons, max confirmation date and more.\n👉 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💳 _One-time payment · No subscription_'
        );

        await sleep(2000);
        if (esEspanol) {
            await sendText(userId,
                'Para comenzar, responde estas *5 preguntas rápidas* y un diseñador se pondrá en contacto contigo:\n\n' +
                '📝 ' + form + '\n\n' +
                'Una vez que lo llenes, te enviaremos nuestros datos de pago. Iniciamos con un abono de *$30* y el saldo restante lo puedes pagar al momento de la entrega. 💳'
            );
            await sleep(1500);
            await sendText(userId,
                'Por favor confírmanos una vez que hayas llenado el formulario. ✅\n\n¡Cualquier pregunta con gusto te ayudamos! 😊'
            );
        } else {
            await sendText(userId,
                'To get started, answer these *5 quick questions* and a designer will contact you:\n\n' +
                '📝 ' + form + '\n\nI am here if you have any questions! 😊'
            );
        }

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
            estado.seguimiento3Enviado    = false;
        }
        console.log(`✅ Secuencia completa: ${userId}`);

        // Seguimiento 1 — 7 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tienes alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarte ✨'
                            : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨'
                    );
                    e.seguimiento1Enviado = true;
                } catch { console.log(`⚠️ Error seguimiento 1`); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 14 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? 'Te dejo algunos ejemplos más:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda moderna: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduación: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nPara comenzar:\n📝 ' + form + '\n\nQuedo atenta 💛'
                            : 'Here are some more examples:\n\n• Sweet 15: https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Modern Wedding: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduation: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nTo get started:\n📝 ' + form + '\n\nI am here for you 💛'
                    );
                    e.seguimiento2Enviado = true;
                } catch { console.log(`⚠️ Error seguimiento 2`); }
            }
        }, 14 * 60 * 1000);

        // Seguimiento 3 — 1 hora
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 🌸 Soy *Carolina* de *Invitartes*.\n\nQuería recordarte que con nuestras invitaciones digitales puedes tener:\n\n💌 Diseño único según tu temática\n✅ Confirmaciones automáticas de asistencia\n🎵 Música y galería de fotos integradas\n📊 Panel para ver en tiempo real quiénes asisten\n🌍 Envío instantáneo a todos tus invitados\n\nTodo desde *$85 USD* — con entrega en máximo 5 días.\n\n*¿Ya tienes en mente una fecha para tu evento?* 📅\n\n¡Podemos comenzar hoy mismo! 🎉\n📝 ' + form
                            : 'Hello! 🌸 I am *Carolina* from *Invitartes*.\n\nI wanted to remind you about our digital invitations:\n\n💌 Unique design based on your theme\n✅ Automatic attendance confirmations\n🎵 Music and photo gallery included\n📊 Real-time panel to see who is attending\n🌍 Instant delivery to all your guests\n\nAll from *$85 USD* — delivered in maximum 5 days.\n\n*Do you already have a date in mind?* 📅\n\nWe can start today! 🎉\n📝 ' + form
                    );
                    e.seguimiento3Enviado = true;
                } catch { console.log(`⚠️ Error seguimiento 3`); }
            }
        }, 60 * 60 * 1000);

    } catch (err) {
        console.error(`❌ Error secuencia:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        await sleep(1500);
        await sendText(userId,
            esEspanol
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto contigo.\n\nPor favor permanece en línea 🙏\n\nSerá un placer atenderte. ✨'
                : '👩🏻‍💼 Perfect! One of our advisors will contact you shortly.\n\nPlease stay online 🙏\n\nIt will be a pleasure to assist you. ✨'
        );
    } catch (err) {
        console.error(`❌ Error asesor:`, err.message);
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
            console.log('❌ Desconectado. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(startBot, 3000);
            }
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
                if (message.key.fromMe) continue;
                if (message.key.remoteJid?.endsWith('@g.us')) continue;

                const userId = message.key.remoteJid;
                const messageText = (
                    message.message?.conversation ||
                    message.message?.extendedTextMessage?.text ||
                    ''
                ).trim();

                if (!messageText) continue;
                console.log(`📩 ${userId}: "${messageText}"`);

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                // USUARIO NUEVO
                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'eligiendo_idioma',
                        intentoIdioma: 1,
                        esEspanol: null,
                        secuenciaCompleta: false,
                        respondioPostSecuencia: false,
                        seguimiento1Enviado: false,
                        seguimiento2Enviado: false,
                        seguimiento3Enviado: false,
                        intentoMenu: 0,
                        conversacionLibre: false
                    });
                    enviarSelectorIdioma(userId).catch(err => {
                        console.error(err.message);
                        processingUsers.delete(userId);
                    });
                    continue;
                }

                // ELIGIENDO IDIOMA
                if (estado.paso === 'eligiendo_idioma') {
                    if (messageText === '1' || messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = messageText === '1';
                        estado.paso = 'en_menu';
                        enviarMenu(userId, estado.esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (estado.intentoIdioma >= 2) {
                        processingUsers.set(userId, Date.now());
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        estado.esEspanol = true;
                        await sendText(userId,
                            '👩🏻‍💼 Parece que necesitas ayuda personalizada.\n\nEn unos momentos uno de nuestros asesores se pondrá en contacto contigo. 🙏\n\nSerá un placer atenderte. ✨'
                        );
                        processingUsers.delete(userId);
                    } else {
                        processingUsers.set(userId, Date.now());
                        estado.intentoIdioma = (estado.intentoIdioma || 1) + 1;
                        enviarSelectorIdioma(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                const esEspanol = estado.esEspanol;

                // EN MENÚ
                if (estado.paso === 'en_menu') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                        continue;
                    }
                    if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        enviarMensajeAsesor(userId, esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                        continue;
                    }
                    processingUsers.set(userId, Date.now());
                    estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                    try {
                        await sendText(userId,
                            esEspanol
                                ? 'Disculpa, no entendí tu mensaje 😊\n\nPor favor escribe *1* o *2* para continuar.'
                                : 'Sorry, I did not understand your message 😊\n\nPlease type *1* or *2* to continue.'
                        );
                        if (estado.intentoMenu >= 2) {
                            estado.conversacionLibre = true;
                            estado.paso = 'libre';
                            await sleep(500);
                            await sendText(userId,
                                esEspanol
                                    ? 'Parece que necesitas ayuda personalizada 😊\nTe conecto con un asesor ahora mismo 👩‍💻'
                                    : 'It seems you need personalized help 😊\nLet me connect you with an advisor right now 👩‍💻'
                            );
                        }
                    } catch (err) {
                        console.error(err.message);
                    } finally {
                        processingUsers.delete(userId);
                    }
                    continue;
                }

                // SECUENCIA COMPLETA
                if (estado.secuenciaCompleta) {
                    estado.respondioPostSecuencia = true;
                    console.log(`✅ ${userId} respondió — seguimientos cancelados`);
                    continue;
                }

                // CONVERSACIÓN LIBRE
                if (estado.conversacionLibre || estado.paso === 'libre') {
                    console.log(`💬 ${userId} conversación libre`);
                    continue;
                }

            } catch (err) {
                console.error('❌ Error handler:', err.message);
            }
        }
    });
}

// SERVIDOR WEB
app.get('/', async (req, res) => {
    if (isConnected) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Conectado</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px;margin:1rem 0}</style>
        </head><body><div class="c"><h1>✅ Bot Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2></div></div></body></html>`);
    } else if (qrCodeData) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar WhatsApp</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px}.c{background:white;padding:2rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;max-width:600px}h1{color:#667eea}.q img{max-width:300px}.i{text-align:left;background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}ol{margin-left:20px}li{margin:10px 0}</style>
        </head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><div class="q"><img src="${qrCodeData}" alt="QR"></div>
        <div class="i"><ol><li>Abre WhatsApp en tu celular</li><li>Ve a Configuración ⚙️</li><li>Toca "Dispositivos Vinculados"</li><li>Escanea el QR</li></ol></div>
        <p>🔄 Se actualiza cada 5 segundos</p></div></body></html>`);
    } else {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando...</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:8px solid #f3f3f3;border-top:8px solid #667eea;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style>
        </head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando Bot...</h1></div></body></html>`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected, timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🤖 INVITARTES BOT v3.0 (Baileys)`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log('🚀 Iniciando...\n');
    startBot();
});

process.on('SIGTERM', async () => {
    console.log('⏹️ Cerrando...');
    process.exit(0);
});
