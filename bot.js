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
    audio:            'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    imagenSobres:     BASE + 'JAlove.webp?alt=media&token=8ac373fa-f9a6-496e-aa96-7bfd20db85a1',
    imagenCatalogo:   BASE + 'catalogue_11zon.webp?alt=media&token=e8760350-1beb-4687-ae76-4f57fd40ac4f',
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://invitartes.com/plataforma-administracion-eventos/';

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

async function enviarBienvenida(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId,
            '🎉 ¡Hola! Bienvenido/a a *Invitartes*.\n\n' +
            '👇 Elija una opción *escribiendo el número*:\n\n' +
            '1️⃣ Explíqueme sobre las invitaciones digitales\n' +
            '2️⃣ Hablar con un asesor\n' +
            '3️⃣ Tell me about digital invitations 🇺🇸\n' +
            '4️⃣ Speak with an advisor 🇺🇸\n\n' +
            '✍️ Escriba solo el número *1*, *2*, *3* o *4* para continuar.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        console.log('📤 Secuencia: ' + userId + ' | ' + (esEspanol ? 'ES' : 'EN'));

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '¡Hola! 👋 Le saludamos de *Invitartes*, con gusto le contamos sobre nuestras invitaciones digitales ✨\n\n' +
                  '¿Sabía que su invitación puede ser toda una experiencia? 🤩\n\n' +
                  '🎨 Crea invitaciones ilimitadas y personalizadas\n' +
                  '🎵 Con música, fotos y videos incluidos\n' +
                  '💬 Recibe y ve todos los mensajes de sus invitados\n' +
                  '📸 Sus invitados pueden subir sus fotos directamente desde la invitación, ¡creando un álbum compartido en tiempo real!\n' +
                  '✅ Confirmaciones en tiempo real\n' +
                  '🌍 Llega a todo el mundo en segundos\n' +
                  '📊 *Plataforma privada* con contadores en tiempo real, fecha máxima de confirmación, invitaciones ilimitadas y escáner QR opcional'
                : 'Hello! 👋 Greetings from *Invitartes*, we are happy to tell you about our digital invitations ✨\n\n' +
                  'Did you know your invitation can be a whole experience? 🤩\n\n' +
                  '🎨 Create unlimited and personalized invitations\n' +
                  '🎵 With music, photos and videos included\n' +
                  '💬 Receive and view all messages from your guests\n' +
                  '📸 Your guests can upload their photos directly from the invitation, creating a shared album in real time!\n' +
                  '✅ Real-time confirmations\n' +
                  '🌍 Reaches anywhere in the world in seconds\n' +
                  '📊 *Private platform* with real-time counters, max confirmation date, unlimited invitations and optional QR scanner'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece ser celebrado de la manera más especial. Le invitamos a ser parte de este momento único que guardaremos en el corazón para siempre. 💫\n\nConfirme su asistencia dentro de la invitación 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nThe most beautiful love deserves to be celebrated in the most special way. We invite you to be part of this unique moment we will keep in our hearts forever. 💫\n\nConfirm your attendance inside the invitation 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo,
            esEspanol
                ? '¡Con todo cariño le enviamos nuestro catálogo! 🎉 para que pueda revisar otros modelos que se ajusten a la temática de su evento. 📋✨\n\nÉchele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo del catálogo y lo adaptamos a su temática, o creamos un diseño único según sus colores e ideas. 💛'
                : 'We are happy to share our catalog with you! 🎉 so you can explore other models that suit your event\'s theme. 📋✨\n\nTake a look: https://invitartes.com/catalogo/\n\nYou can choose a model from the catalog and we adapt it to your theme, or we create a unique design based on your colors and ideas. 💛'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '🔗 Le invitamos a visitar este enlace donde podrá conocer cómo funciona nuestra plataforma de administración de invitaciones y ver las características detalladas de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
                : '🔗 We invite you to visit this link where you can learn how our invitation management platform works and see the detailed features of each package:\n\n👉 https://invitartes.com/caracteristicas/'
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
        await sendText(userId,
            esEspanol
                ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas 🎨\n\n' +
                  '*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/\n\n' +
                  '*ÉLITE PLUS* — $150 🚀\nTodo lo del Élite + página exclusiva de carga de fotos vinculada a QR imprimible + PDF A5 con el código QR para colocar en mesas o arreglos florales y subir fotos + QR editable para imprimirlo donde lo necesite.\n👉 (Ejemplo ÉLITE PLUS) https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💡 *Save the Date* — $20 adicionales _(precio especial al adquirir cualquier plan)_\nPágina exclusiva como expectativa para que sus invitados sepan cuándo es el evento.'
                : '🎁 *Our Packages*\nAll our invitations are completely personalized 🎨\n\n' +
                  '*ESSENTIAL* — $85\nTemplate-based, one invitation for everyone, no photos, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE* — $105\nCustom design with personalized name and number of passes + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + animated icons, premium animations, max confirmation date and more.\n👉 (ELITE Example) https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/\n\n' +
                  '*ELITE PLUS* — $150 🚀\nEverything in Elite + exclusive photo upload page linked to printable QR + A5 PDF with QR code for tables or floral arrangements and photo uploads + editable QR to print wherever you need it.\n👉 (ELITE PLUS Example) https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💡 *Save the Date* — $20 additional _(special price when purchasing any plan)_\nExclusive page as a teaser so your guests know when the event is.'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? 'Para iniciar con el proceso, por favor complete el siguiente formulario (Datos para sus invitaciones):\n📝 ' + FORM + '\n\n' +
                  'O si lo prefiere, también puede enviarnos por WhatsApp los detalles y la temática que desea para sus invitaciones.\n\n' +
                  'Una vez recibamos la información, nos comprometemos a entregarle las invitaciones en un plazo máximo de *5 días*.\n\n' +
                  'Empezamos con un abono inicial de *$10*, que puede realizar al siguiente número de cuenta:\n\n' +
                  '🏦 *Banco de Loja*\n' +
                  'Número de cuenta: *2904553231*\n' +
                  'Cédula: *1104753122*\n' +
                  'Tipo de cuenta: Cuenta de ahorros _(cuenta activa)_\n' +
                  'Titular: *ALVAREZ GRANDA, GUIDO CRISTOPHER*\n\n' +
                  'El saldo restante podrá ser cancelado en el momento de la entrega de sus invitaciones. ✨'
                : 'To start the process, please fill out the following form (Details for your invitations):\n📝 ' + FORM + '\n\n' +
                  'Or if you prefer, you can also send us the details and theme you want for your invitations via WhatsApp.\n\n' +
                  'Once we receive the information, we commit to delivering your invitations within a maximum of *5 days*.\n\n' +
                  'We start with an initial deposit of *$10*, which you can send using one of the following options:\n\n' +
                  '🇪🇨 *If you are in Ecuador — Bank transfer:*\n' +
                  '🏦 Banco de Loja\n' +
                  'Account number: *2904553231*\n' +
                  'ID: *1104753122*\n' +
                  'Account type: Savings account _(active account)_\n' +
                  'Holder: *ALVAREZ GRANDA, GUIDO CRISTOPHER*\n\n' +
                  '🌍 *If you are outside Ecuador — PayPal:*\n' +
                  '👉 https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC\n\n' +
                  'The remaining balance can be paid at the time of delivery of your invitations. ✨'
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
        }
        console.log('✅ Secuencia completa: ' + userId);

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

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? 'Le dejo algunos ejemplos más:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda Pasaporte: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduación: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nRecuerde que también contamos con el plan *ÉLITE PLUS* que incluye página exclusiva de carga de fotos, PDF A5 con QR para mesas o arreglos florales y QR editable. 🚀\n\nPara comenzar:\n📝 ' + FORM + '\n\nQuedo atenta 💛'
                            : 'Here are some more examples:\n\n• Sweet 15 (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Passport Wedding: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Graduation: https://invitartes.com/graduacion-promocion-77-colegio-americano-de-guayaquil-copy-copy/#\n\nRemember we also have the *ELITE PLUS* plan which includes an exclusive photo upload page, A5 PDF with QR for tables or floral arrangements and editable QR. 🚀\n\nTo get started:\n📝 ' + FORM + '\n\nI am here for you 💛'
                    );
                    e.seguimiento2Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 2'); }
            }
        }, 14 * 60 * 1000);

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 🌸 Soy *Carolina* de *Invitartes*.\n\n' +
                              'Quería recordarle que con nuestras invitaciones digitales puede tener:\n\n' +
                              '💌 Diseño único según su temática\n' +
                              '✅ Confirmaciones automáticas de asistencia\n' +
                              '🎵 Música y galería de fotos integradas\n' +
                              '📊 Panel para ver en tiempo real quiénes asisten\n' +
                              '🌍 Envío instantáneo a todos sus invitados\n\n' +
                              'Todo desde *$85 USD* — con entrega en máximo 5 días.\n\n' +
                              'Y si desea el máximo nivel, nuestro plan *ÉLITE PLUS* incluye además página exclusiva de carga de fotos, PDF A5 con QR para mesas o arreglos florales y QR editable. 🚀\n\n' +
                              '*¿Para qué evento necesita su invitación?* 📅\n\n' +
                              'Llene este formulario _(5 min)_ y comenzamos a dar vida a su invitación personalizada. 🎨✨\n📝 ' + FORM
                            : 'Hello! 🌸 I am *Carolina* from *Invitartes*.\n\n' +
                              'I wanted to remind you that with our digital invitations you can have:\n\n' +
                              '💌 Unique design based on your theme\n' +
                              '✅ Automatic attendance confirmations\n' +
                              '🎵 Music and photo gallery included\n' +
                              '📊 Real-time panel to see who is attending\n' +
                              '🌍 Instant delivery to all your guests\n\n' +
                              'All from *$85 USD* — delivered in maximum 5 days.\n\n' +
                              'And if you want the maximum level, our *ELITE PLUS* plan also includes an exclusive photo upload page, A5 PDF with QR for tables or floral arrangements and editable QR. 🚀\n\n' +
                              '*What event do you need your invitation for?* 📅\n\n' +
                              'Fill out this form _(5 min)_ and we will start bringing your personalized invitation to life. 🎨✨\n📝 ' + FORM
                    );
                    e.seguimiento3Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 3'); }
            }
        }, 24 * 60 * 60 * 1000);

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

                if (message.key.fromMe) {
                    let e = userStates.get(userId);
                    if (!e) {
                        userStates.set(userId, {
                            paso: 'bienvenida',
                            esEspanol: null,
                            secuenciaCompleta: false,
                            respondioPostSecuencia: false,
                            seguimiento1Enviado: false,
                            seguimiento2Enviado: false,
                            seguimiento3Enviado: false,
                            duenoAtendio: true,
                            conversacionLibre: false
                        });
                    } else {
                        e.duenoAtendio = true;
                    }
                    console.log('👤 Dueño atendió a: ' + userId + ' — flujo completamente cancelado');
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
                        paso: 'bienvenida',
                        esEspanol: null,
                        secuenciaCompleta: false,
                        respondioPostSecuencia: false,
                        seguimiento1Enviado: false,
                        seguimiento2Enviado: false,
                        seguimiento3Enviado: false,
                        duenoAtendio: false,
                        conversacionLibre: false
                    });
                    enviarBienvenida(userId).catch(err => {
                        console.error(err.message);
                        processingUsers.delete(userId);
                    });
                    continue;
                }

                if (estado.duenoAtendio) {
                    console.log('⛔ ' + userId + ' — dueño ya atendió, ignorando mensaje');
                    continue;
                }

                if (estado.paso === 'bienvenida') {
                    if (messageText === '1' || messageText === '3') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = messageText === '1';
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, estado.esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2' || messageText === '4') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = messageText === '2';
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        enviarMensajeAsesor(userId, estado.esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarBienvenida(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                if (estado.secuenciaCompleta) {
                    estado.respondioPostSecuencia = true;
                    continue;
                }

                if (estado.conversacionLibre || estado.paso === 'libre') {
                    continue;
                }

            } catch (err) {
                console.error('❌ Error handler:', err.message);
            }
        }
    });
}

app.get('/', async (req, res) => {
    if (isConnected) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Conectado</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px}</style></head><body><div class="c"><h1>✅ Bot Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2></div></div></body></html>');
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
    console.log('\n🤖 INVITARTES BOT v4.6 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
