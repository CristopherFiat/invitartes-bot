const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;

const FIREBASE_URLS = {
    audio:        'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    imagenSobres: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/dia1.webp?alt=media&token=d42a626c-c48d-48c3-a152-3801e174be0d',
    imagenLia:    'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/lia.webp?alt=media'
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSc1KeOF_isYggQcmkydkfxQRymA8fVn1gEUXxlr8e2zVjwDNA/viewform?usp=header';

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
        if (e && e.duenoAtendio) {
            console.log('⛔ Bienvenida cancelada — dueño ya atendió a: ' + userId);
            return;
        }
        await sendText(userId,
            '🎉 ¡Hola! Bienvenido/a a *Invitartes*.\n\n' +
            '👇 Elige una opción *escribiendo el número*:\n\n' +
            '1️⃣ Explícame sobre las invitaciones digitales\n' +
            '2️⃣ Hablar con un asesor\n' +
            '3️⃣ Tell me about digital invitations 🇺🇸\n' +
            '4️⃣ Speak with an advisor 🇺🇸\n\n' +
            '✍️ Escribe solo el número *1*, *2*, *3* o *4* para continuar.'
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
        if (e && e.duenoAtendio) {
            console.log('⛔ Secuencia cancelada — dueño ya atendió a: ' + userId);
            return;
        }
        console.log('📤 Secuencia: ' + userId + ' | ' + (esEspanol ? 'ES' : 'EN'));

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
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
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece ser celebrado de la manera más especial. Te invitamos a ser parte de este momento único que guardaremos en el corazón para siempre. 💫\n\nConfirma tu asistencia dentro de la invitación 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
                : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nThe most beautiful love deserves to be celebrated in the most special way. We invite you to be part of this unique moment we will keep in our hearts forever. 💫\n\nConfirm your attendance inside the invitation 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenLia,
            esEspanol
                ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... los XV años son uno de ellos. 🎀\n\nUna noche mágica, llena de ilusión, luz y recuerdos que duran toda la vida. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... a Sweet 15 is one of them. 🎀\n\nA magical night, full of dreams, light and memories that last a lifetime. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '🔗 Te invito a visitar este enlace donde podrás conocer cómo funciona nuestra plataforma de administración de invitaciones y ver las características detalladas de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
                : '🔗 Visit this link to learn how our invitation management platform works and see the detailed features of each package:\n\n👉 https://invitartes.com/caracteristicas/'
        );

        if (esEspanol) {
            await sleep(1500);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendText(userId, '🎧 Te explico brevemente nuestros paquetes en el siguiente audio:');
            await sleep(800);
            if (userStates.get(userId)?.duenoAtendio) return;
            await sendAudio(userId, FIREBASE_URLS.audio);
        }

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '_Todas nuestras invitaciones son completamente personalizadas_ 🎨\n\n' +
                  '*ESSENTIAL* — $85\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE* — $105\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ÉLITE* — $130 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
                : '🎁 *Our Packages*\n\n' +
                  '_All our invitations are completely personalized_ 🎨\n\n' +
                  '*ESSENTIAL* — $85\nTemplate-based, one invitation for everyone, no photos, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE* — $105\nCustom design with personalized name and number of passes + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE* — $130 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + animated icons, premium animations, max confirmation date and more.\n👉 (ELITE Example) https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
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
                            ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tienes alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarte ✨'
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
                            ? 'Te dejo algunos ejemplos más:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda moderna: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduación: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nPara comenzar:\n📝 ' + FORM + '\n\nQuedo atenta 💛'
                            : 'Here are some more examples:\n\n• Sweet 15 (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Modern Wedding: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduation: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nTo get started:\n📝 ' + FORM + '\n\nI am here for you 💛'
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
                              'Quería recordarte que con nuestras invitaciones digitales puedes tener:\n\n' +
                              '💌 Diseño único según tu temática\n' +
                              '✅ Confirmaciones automáticas de asistencia\n' +
                              '🎵 Música y galería de fotos integradas\n' +
                              '📊 Panel para ver en tiempo real quiénes asisten\n' +
                              '🌍 Envío instantáneo a todos tus invitados\n\n' +
                              'Todo desde *$85 USD* — con entrega en máximo 5 días.\n\n' +
                              '*¿Para qué evento necesitas tu invitación?* 📅\n\n' +
                              'Llena este formulario _(5 min)_ y comenzamos a dar vida a tu invitación personalizada. 🎨✨\n📝 ' + FORM
                            : 'Hello! 🌸 I am *Carolina* from *Invitartes*.\n\n' +
                              'I wanted to remind you that with our digital invitations you can have:\n\n' +
                              '💌 Unique design based on your theme\n' +
                              '✅ Automatic attendance confirmations\n' +
                              '🎵 Music and photo gallery included\n' +
                              '📊 Real-time panel to see who is attending\n' +
                              '🌍 Instant delivery to all your guests\n\n' +
                              'All from *$85 USD* — delivered in maximum 5 days.\n\n' +
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
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto contigo.\n\nPor favor permanece en línea 🙏\n\nSerá un placer atenderte. ✨'
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
    console.log('\n🤖 INVITARTES BOT v4.2 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
