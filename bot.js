const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let qrCodeData = '';
let clientReady = false;
let botPhoneNumber = '';

const FIREBASE_URLS = {
    audio:        'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    video:        'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/Promooficialfinal%202%20(3).mp4?alt=media',
    imagenSobres: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/da.webp?alt=media&token=687cea05-0f0a-4d07-82c7-fd28cd0297fe',
    imagenLia:    'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/lia.webp?alt=media'
};

const userStates      = new Map();
const processingUsers = new Map();

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth',
        clientId: 'invitartes-bot'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 ESCANEA ESTE QR CON WHATSAPP');
    console.log('='.repeat(60));
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
});

client.on('authenticated', () => console.log('✅ Autenticación exitosa'));

client.on('ready', async () => {
    clientReady = true;
    console.log('\n✅ BOT LISTO Y FUNCIONANDO\n');
    try {
        const info = await client.info;
        botPhoneNumber = info.wid._serialized;
        console.log(`📱 Número: ${botPhoneNumber}`);
    } catch {
        console.log('⚠️ No se pudo obtener info del bot');
    }

    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [userId, ts] of processingUsers.entries()) {
            if (now - ts > 5 * 60 * 1000) { processingUsers.delete(userId); cleaned++; }
        }
        if (cleaned > 0) console.log(`🧹 Auto-limpieza: ${cleaned} usuario(s) liberados`);
    }, 10 * 60 * 1000);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Desconectado:', reason);
    clientReady = false;
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function enviarSelectorIdioma(userId) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(800);
        await chat.sendMessage(
            '¡Hola! 👋\n\n' +
            'Antes de comenzar, dinos en qué idioma prefieres que te hablemos:\n\n' +
            '🇪🇸 *1* — Español\n' +
            '🇺🇸 *2* — English\n\n' +
            '✍️ Escribe solo el número *1* o *2* para continuar.'
        );
        console.log(`✅ Selector idioma enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error selector idioma ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenu(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(1000);
        if (esEspanol) {
            await chat.sendMessage(
                '¿En qué te puedo ayudar hoy?\n\n' +
                '1️⃣ Quiero conocer las invitaciones digitales\n' +
                '2️⃣ Prefiero hablar con un asesor\n\n' +
                '✍️ Escribe solo el número *1 o 2* para continuar.'
            );
        } else {
            await chat.sendMessage(
                'How can I help you today?\n\n' +
                '1️⃣ I want to learn about digital invitations\n' +
                '2️⃣ I prefer to speak with an advisor\n\n' +
                '✍️ Type only the number *1 or 2* to continue.'
            );
        }
        console.log(`✅ Menú enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error menú ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        const FORM_ES = 'https://docs.google.com/forms/d/e/1FAIpQLSemjvJ7kdMHXojtciXBsaOOJFN1Zl8wFEG5DPc1ayfpSWZ67g/viewform?usp=header';
        const FORM_EN = 'https://docs.google.com/forms/d/e/1FAIpQLSc3xqI5c4J6ElWNUTyYFccgJsPL4Br9qBF9bDHsyzV1t2jRrg/viewform?usp=header';
        const form = esEspanol ? FORM_ES : FORM_EN;
        console.log(`📤 Iniciando secuencia: ${userId} | ${esEspanol ? 'ES 🇪🇸' : 'EN 🇺🇸'}`);

        // 1 — Presentación
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
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
        console.log(`  ✓ ${userId}: 1 — Presentación`);

        // 2 — Imagen boda
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const img1 = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(img1, {
                caption: esEspanol
                    ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece ser celebrado de la manera más especial. Te invitamos a ser parte de este momento único que guardaremos en el corazón para siempre. 💫\n\nConfirma tu asistencia dentro de la invitación 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
                    : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nThe most beautiful love deserves to be celebrated in the most special way. We invite you to be part of this unique moment we will keep in our hearts forever. 💫\n\nConfirm your attendance inside the invitation 👇\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
            });
        } catch {
            await chat.sendMessage(
                esEspanol
                    ? '✨ *Ejemplo real 1 — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
                    : '✨ *Real example 1 — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\n🔗 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/'
            );
        }
        console.log(`  ✓ ${userId}: 2 — Imagen Boda`);

        // 3 — Imagen XV años
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const img2 = await MessageMedia.fromUrl(FIREBASE_URLS.imagenLia);
            await chat.sendMessage(img2, {
                caption: esEspanol
                    ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... los XV años son uno de ellos. 🎀\n\nUna noche mágica, llena de ilusión, luz y recuerdos que duran toda la vida. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                    : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... a Sweet 15 is one of them. 🎀\n\nA magical night, full of dreams, light and memories that last a lifetime. ✨\n\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
            });
        } catch {
            await chat.sendMessage(
                esEspanol
                    ? '🌸 *Ejemplo real 2 — Quinceaños* 🌸\n\n🌟 Hay momentos que marcan para siempre... 🎀\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                    : '🌸 *Real example 2 — Sweet 15* 🌸\n\n🌟 There are moments that mark you forever... 🎀\n🔗 https://invitartes.com/invitacion-xv-anos-lia-haro/'
            );
        }
        console.log(`  ✓ ${userId}: 3 — Imagen XV Años`);

        // 4 — Link plataforma
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            esEspanol
                ? '🔗 Te invito a visitar este enlace donde podrás conocer cómo funciona nuestra plataforma de administración de invitaciones y ver las características detalladas de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
                : '🔗 Visit this link to learn how our invitation management platform works and see the detailed features of each package:\n\n👉 https://invitartes.com/caracteristicas/'
        );
        console.log(`  ✓ ${userId}: 4 — Link plataforma`);

        // 5 — Audio (solo español)
        if (esEspanol) {
            await chat.sendStateTyping();
            await sleep(1500);
            await chat.sendMessage('🎧 Te explico brevemente nuestros paquetes en el siguiente audio:');
            await sleep(800);
            try {
                const audio = await MessageMedia.fromUrl(FIREBASE_URLS.audio);
                await chat.sendMessage(audio);
            } catch {
                console.log(`  ⚠️ ${userId}: Error enviando audio`);
            }
            console.log(`  ✓ ${userId}: 5 — Audio`);
        }

        // 6 — Paquetes
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '*ESSENTIAL — $85*\n' +
                  'Basado en plantilla, sencillo y bonito.\n' +
                  '👉 https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE — $105*\n' +
                  'Diseño personalizado + imágenes y plataforma de envíos.\n' +
                  '👉 https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE — $130* 👑\n' +
                  'Todo lo del Deluxe + invitaciones ilimitadas, íconos animados, fecha máxima de confirmación y más.\n' +
                  '👉 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💳 _Pago único · Sin suscripción_'
                : '🎁 *Our Packages*\n\n' +
                  '*ESSENTIAL — $85*\n' +
                  'Template-based, simple and beautiful.\n' +
                  '👉 https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
                  '*DELUXE — $105*\n' +
                  'Custom design + photos and sending platform.\n' +
                  '👉 https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
                  '*ELITE — $130* 👑\n' +
                  'Everything in Deluxe + unlimited invitations, animated icons, max confirmation date and more.\n' +
                  '👉 https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n\n' +
                  '💳 _One-time payment · No subscription_'
        );
        console.log(`  ✓ ${userId}: 6 — Paquetes`);

        // 7 — Formulario
        await chat.sendStateTyping();
        await sleep(2000);
        if (esEspanol) {
            await chat.sendMessage(
                'Para comenzar, responde estas *5 preguntas rápidas* y un diseñador se pondrá en contacto contigo para continuar el proceso:\n\n' +
                '📝 ' + form + '\n\n' +
                'Una vez que lo llenes, te enviaremos nuestros datos de pago. Iniciamos con un abono de *$30* y el saldo restante lo puedes pagar al momento de la entrega. 💳'
            );
            await sleep(1500);
            await chat.sendStateTyping();
            await sleep(1000);
            await chat.sendMessage(
                'Por favor confírmanos una vez que hayas llenado el formulario para verificar que nos ha llegado correctamente. ✅\n\n' +
                '¡Cualquier pregunta con gusto te ayudamos! 😊'
            );
        } else {
            await chat.sendMessage(
                'To get started, answer these *5 quick questions* and a designer will contact you to continue the process:\n\n' +
                '📝 ' + form + '\n\n' +
                'I am here if you have any questions! 😊'
            );
        }
        console.log(`  ✓ ${userId}: 7 — Formulario`);

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
            estado.seguimiento24Enviado   = false;
        }
        console.log(`✅ Secuencia completa: ${userId}\n`);

        // Seguimiento 1 — 7 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado) {
                try {
                    await chat.sendMessage(
                        esEspanol
                            ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tienes alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarte ✨'
                            : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨'
                    );
                    e.seguimiento1Enviado = true;
                    console.log(`📞 Seguimiento 1 → ${userId}`);
                } catch { console.log(`⚠️ ${userId}: Error seguimiento 1`); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 14 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado) {
                try {
                    await chat.sendMessage(
                        esEspanol
                            ? 'Te dejo algunos ejemplos más por si quieres ver otros estilos:\n\n• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Boda moderna: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduación: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nPara comenzar solo llena el formulario:\n📝 ' + form + '\n\nQuedo atenta 💛'
                            : 'Here are some more examples in case you want to see other styles:\n\n• Sweet 15 (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n• Modern Wedding: https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n• Graduation: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\nTo get started just fill out the form:\n📝 ' + form + '\n\nI am here for you 💛'
                    );
                    e.seguimiento2Enviado = true;
                    console.log(`📞 Seguimiento 2 → ${userId}`);
                } catch { console.log(`⚠️ ${userId}: Error seguimiento 2`); }
            }
        }, 14 * 60 * 1000);

        // Seguimiento 3 — 24 horas
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento24Enviado) {
                try {
                    await chat.sendMessage(
                        esEspanol
                            ? '¡Hola! 🌸 Soy *Carolina* de *Invitartes*.\n\nQuería recordarte que con nuestras invitaciones digitales puedes tener:\n\n💌 Diseño único según tu temática\n✅ Confirmaciones automáticas de asistencia\n🎵 Música y galería de fotos integradas\n📊 Panel para ver en tiempo real quiénes asisten\n🌍 Envío instantáneo a todos tus invitados\n\nTodo desde *$85 USD* — con entrega en máximo 5 días.\n\n*¿Ya tienes en mente una fecha para tu evento?* 📅\n\nSi es así, ¡podemos comenzar hoy mismo! 🎉\n📝 ' + form
                            : 'Hello! 🌸 I am *Carolina* from *Invitartes*.\n\nI wanted to remind you that with our digital invitations you can have:\n\n💌 Unique design based on your theme\n✅ Automatic attendance confirmations\n🎵 Music and photo gallery included\n📊 Real-time panel to see who is attending\n🌍 Instant delivery to all your guests\n\nAll from *$85 USD* — delivered in maximum 5 days.\n\n*Do you already have a date in mind for your event?* 📅\n\nIf so, we can start today! 🎉\n📝 ' + form
                    );
                    e.seguimiento24Enviado = true;
                    console.log(`📞 Seguimiento 24h → ${userId}`);
                } catch { console.log(`⚠️ ${userId}: Error seguimiento 24h`); }
            }
        }, 24 * 60 * 60 * 1000);

    } catch (err) {
        console.error(`❌ Error secuencia ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            esEspanol
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto contigo.\n\nPor favor permanece en línea 🙏\n\nSerá un placer atenderte. ✨'
                : '👩🏻‍💼 Perfect! One of our advisors will contact you shortly.\n\nPlease stay online 🙏\n\nIt will be a pleasure to assist you. ✨'
        );
        console.log(`✅ Mensaje asesor enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error asesor ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

client.on('message', async (message) => {
    try {
        if (message.fromMe) return;
        const chat = await message.getChat();
        if (chat.isGroup) return;

        const userId      = message.from;
        const messageText = message.body.trim();
        console.log(`📩 ${userId}: "${messageText}"`);

        if (processingUsers.has(userId)) {
            const elapsed = Date.now() - processingUsers.get(userId);
            if (elapsed < 5 * 60 * 1000) {
                console.log(`⏭️ ${userId} procesando (${Math.round(elapsed / 1000)}s)`);
                return;
            }
            processingUsers.delete(userId);
        }

        let estado = userStates.get(userId);

        // ── USUARIO NUEVO → selector de idioma ──
        if (!estado) {
            processingUsers.set(userId, Date.now());
            userStates.set(userId, {
                paso: 'eligiendo_idioma',
                esEspanol: null,
                secuenciaCompleta: false,
                respondioPostSecuencia: false,
                seguimiento1Enviado: false,
                seguimiento2Enviado: false,
                seguimiento24Enviado: false,
                intentoMenu: 0,
                conversacionLibre: false
            });
            enviarSelectorIdioma(userId).catch(err => {
                console.error(`❌ ${userId}:`, err.message);
                processingUsers.delete(userId);
            });
            return;
        }

        // ── ELIGIENDO IDIOMA ──
        if (estado.paso === 'eligiendo_idioma') {
            if (messageText === '1' || messageText === '2') {
                processingUsers.set(userId, Date.now());
                estado.esEspanol = messageText === '1';
                estado.paso = 'en_menu';
                console.log(`🌍 ${userId} eligió: ${estado.esEspanol ? 'Español' : 'English'}`);
                enviarMenu(userId, estado.esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
            } else {
                // Si escribe otra cosa, repetir selector
                processingUsers.set(userId, Date.now());
                enviarSelectorIdioma(userId).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
            }
            return;
        }

        const esEspanol = estado.esEspanol;

        // ── EN MENÚ principal ──
        if (estado.paso === 'en_menu') {
            if (messageText === '1') {
                processingUsers.set(userId, Date.now());
                estado.paso = 'en_secuencia';
                enviarSecuencia(userId, esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            if (messageText === '2') {
                processingUsers.set(userId, Date.now());
                estado.conversacionLibre = true;
                estado.paso = 'libre';
                enviarMensajeAsesor(userId, esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            // No entendió
            processingUsers.set(userId, Date.now());
            estado.intentoMenu = (estado.intentoMenu || 0) + 1;
            try {
                await (await client.getChatById(userId)).sendMessage(
                    esEspanol
                        ? 'Disculpa, no entendí tu mensaje 😊\n\nPor favor escribe *1* o *2* para continuar.'
                        : 'Sorry, I did not understand your message 😊\n\nPlease type *1* or *2* to continue.'
                );
                if (estado.intentoMenu >= 2) {
                    estado.conversacionLibre = true;
                    estado.paso = 'libre';
                    await sleep(500);
                    await (await client.getChatById(userId)).sendMessage(
                        esEspanol
                            ? 'Parece que necesitas ayuda personalizada 😊\nTe conecto con un asesor ahora mismo 👩‍💻'
                            : 'It seems you need personalized help 😊\nLet me connect you with an advisor right now 👩‍💻'
                    );
                }
            } catch (err) {
                console.error(`❌ ${userId}:`, err.message);
            } finally {
                processingUsers.delete(userId);
            }
            return;
        }

        // ── SECUENCIA COMPLETA ──
        if (estado.secuenciaCompleta) {
            estado.respondioPostSecuencia = true;
            console.log(`✅ ${userId} respondió — seguimientos cancelados`);
            return;
        }

        // ── CONVERSACIÓN LIBRE ──
        if (estado.conversacionLibre || estado.paso === 'libre') {
            console.log(`💬 ${userId} en conversación libre`);
            return;
        }

    } catch (err) {
        console.error('❌ Error handler:', err.message);
    }
});

app.get('/', async (req, res) => {
    if (clientReady) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Conectado</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px;margin:1rem 0}</style>
        </head><body><div class="c"><h1>✅ Bot Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2><p>📱 ${botPhoneNumber || 'Cargando...'}</p></div></div></body></html>`);
    } else if (qrCodeData) {
        try {
            const qrImage = await QRCode.toDataURL(qrCodeData);
            res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar WhatsApp</title>
            <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px}.c{background:white;padding:2rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;max-width:600px}h1{color:#667eea}.q{background:white;padding:20px;border-radius:15px;display:inline-block;margin:20px 0}.q img{max-width:300px}.i{text-align:left;background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}ol{margin-left:20px}li{margin:10px 0}</style>
            </head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><div class="q"><img src="${qrImage}" alt="QR"></div>
            <div class="i"><h3>📋 Instrucciones:</h3><ol><li>Abre WhatsApp en tu celular</li><li>Ve a Configuración ⚙️</li><li>Toca "Dispositivos Vinculados"</li><li>Toca "Vincular un dispositivo"</li><li>Escanea el código QR</li></ol></div>
            <p>🔄 Se actualiza cada 5 segundos</p></div></body></html>`);
        } catch { res.send('<h1>Error generando QR</h1>'); }
    } else {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando...</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:8px solid #f3f3f3;border-top:8px solid #667eea;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style>
        </head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando Bot...</h1></div></body></html>`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', ready: clientReady, hasQR: !!qrCodeData, timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT v4.4');
    console.log(`🌐 Puerto: ${PORT}`);
    console.log('🚀 Inicializando WhatsApp...\n');
});

server.on('listening', () => {
    console.log('✅ Servidor listo');
    client.initialize();
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️ Cerrando...');
    await client.destroy();
    process.exit(0);
});
