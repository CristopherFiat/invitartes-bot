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
    pdfPaquetes: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/caracteristicas2026.pdf?alt=media',
    audio: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    video: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/Promooficialfinal%202%20(3).mp4?alt=media',
    imagenSobres: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/sobres.webp?alt=media',
    imagenLia: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/lia.webp?alt=media'
};

const userStates = new Map();
const processingUsers = new Map(); // Cambio: Map en vez de Set para guardar timestamp

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

client.on('authenticated', () => {
    console.log('✅ Autenticación exitosa');
});

client.on('ready', async () => {
    clientReady = true;
    console.log('\n✅ BOT LISTO Y FUNCIONANDO\n');
    try {
        const info = await client.info;
        botPhoneNumber = info.wid._serialized;
        console.log(`📱 Número: ${botPhoneNumber}`);
    } catch (error) {
        console.log('⚠️ No se pudo obtener info del bot');
    }
    
    // Limpiar usuarios bloqueados cada 10 minutos
    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [userId, timestamp] of processingUsers.entries()) {
            if (now - timestamp > 5 * 60 * 1000) { // 5 minutos
                processingUsers.delete(userId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`🧹 Auto-limpieza: ${cleaned} usuario(s) liberados`);
        }
    }, 10 * 60 * 1000);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Desconectado:', reason);
    clientReady = false;
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function esMensajeDeInicio(text) {
    const triggers = [
        'hola', 'hey', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
        'buen dia', 'buena tarde', 'buena noche', 'ola', 'holis', 'saludos',
        'invitacion', 'invitación', 'boda', 'xv años', 'quinceaños',
        'baby shower', 'cumpleaños', 'evento', 'información', 'informacion',
        'info', 'precio', 'costo', 'cuanto', 'quiero', 'necesito', 'quisiera'
    ];
    const textLower = text.toLowerCase().trim();
    return triggers.some(trigger => textLower.includes(trigger));
}

async function enviarMenuPrincipal(userId) {
    try {
        const chat = await client.getChatById(userId);
        console.log(`📤 Enviando menú principal a: ${userId}`);
        
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('¿Cómo está? 😊 Con gusto le ayudamos ✨');
        
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            '📋 *MENÚ PRINCIPAL*\n\n' +
            'Por favor, escriba únicamente el número de la opción que desea elegir y envíelo como mensaje.\n\n' +
            '1️⃣ Explícame sobre las invitaciones\n' +
            '2️⃣ Quiero hablar con un asesor\n\n' +
            '✍️ Digite solo el número (1 o 2) para continuar.'
        );
        
        console.log(`✅ Menú enviado a: ${userId}`);
    } catch (error) {
        console.error(`❌ Error enviando menú a ${userId}:`, error.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuenciaCompleta(userId) {
    try {
        const chat = await client.getChatById(userId);
        console.log(`📤 Enviando secuencia completa a: ${userId}`);
        
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('😊 Con mucho gusto, ahora le explico ✨');
        console.log(`  ✓ ${userId}: Mensaje 1/10`);
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            'Le envío algunas de las funciones que puede tener en nuestras invitaciones:\n\n' +
            '💫 *Tu evento, tu estilo:* Diseño 100% personalizado que refleja la esencia de tu celebración\n\n' +
            '📱 *Confirmaciones automáticas:* Olvídate de estar preguntando uno por uno. Tus invitados confirman con un clic y tú lo ves en tiempo real\n\n' +
            '🎵 *Ambiente desde el primer momento:* Música, videos, galerías de fotos... tu invitación cobra vida\n\n' +
            '⏰ *Recordatorios inteligentes:* El sistema se encarga de que nadie olvide tu fecha especial\n\n' +
            '🎁 *Mesa de regalos integrada:* Tus invitados saben exactamente qué regalarte, sin complicaciones\n\n' +
            '📊 *Control total:* Dashboard para ver quiénes confirmaron, cuántos van, cuántos asistieron.\n\n' +
            '♾️ *Sin límites:* Envía a todos tus invitados sin pagar extra por cada uno\n\n' +
            '🌍 *Alcance global:* ¿Familiares en el extranjero? Llegan en segundos, sin costos de envío\n\n' +
            '🔄 *Actualizaciones ilimitadas:* ¿Cambió algo? Edita y todos se enteran al instante.'
        );
        console.log(`  ✓ ${userId}: Mensaje 2/10`);
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgSobres = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(imgSobres, { 
                caption: 'Le envío un ejemplo real de nuestras invitaciones ✨\n\n🔗 Invitación completa:\nhttps://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/' 
            });
            console.log(`  ✓ ${userId}: Mensaje 3/10 (imagen sobres)`);
        } catch (error) {
            console.log(`  ⚠️ ${userId}: Error imagen sobres`);
            await chat.sendMessage('Le envío un ejemplo real de nuestras invitaciones ✨\n\n🔗 Invitación completa:\nhttps://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgLia = await MessageMedia.fromUrl(FIREBASE_URLS.imagenLia);
            await chat.sendMessage(imgLia, { 
                caption: 'Le comparto otra muestra real 💎\n\n📲 Abre la invitación aquí:\nhttps://invitartes.com/invitacion-xv-anos-lia-haro/' 
            });
            console.log(`  ✓ ${userId}: Mensaje 4/10 (imagen Lia)`);
        } catch (error) {
            console.log(`  ⚠️ ${userId}: Error imagen Lia`);
            await chat.sendMessage('Le comparto otra muestra real 💎\n\n📲 Abre la invitación aquí:\nhttps://invitartes.com/invitacion-xv-anos-lia-haro/');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const videoMedia = await MessageMedia.fromUrl(FIREBASE_URLS.video);
            await chat.sendMessage(videoMedia, { 
                caption: 'Le envío un video de cómo funciona nuestro sistema para gestionar invitaciones digitales ✨' 
            });
            console.log(`  ✓ ${userId}: Mensaje 5/10 (video)`);
        } catch (error) {
            console.log(`  ⚠️ ${userId}: Error video`);
            await chat.sendMessage('Le envío un video de cómo funciona nuestro sistema para gestionar invitaciones digitales ✨');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const pdfMedia = await MessageMedia.fromUrl(FIREBASE_URLS.pdfPaquetes);
            await chat.sendMessage(pdfMedia, { 
                caption: 'Le comento que tenemos 3 paquetes diseñados para adaptarse a diferentes necesidades y presupuestos 🎯\n\nEn el PDF adjunto encontrará las características detalladas de cada uno.' 
            });
            console.log(`  ✓ ${userId}: Mensaje 6/10 (PDF)`);
        } catch (error) {
            console.log(`  ⚠️ ${userId}: Error PDF`);
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('A continuación le explico de manera resumida nuestros paquetes en el audio:');
        
        await sleep(1000);
        try {
            const audioMedia = await MessageMedia.fromUrl(FIREBASE_URLS.audio);
            await chat.sendMessage(audioMedia);
            console.log(`  ✓ ${userId}: Mensaje 7/10 (audio)`);
        } catch (error) {
            console.log(`  ⚠️ ${userId}: Error audio`);
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            '🌟 *Planes de Invitaciones Digitales* 🌟\n\n' +
            '*ESSENTIAL — $65*\n' +
            'Sencillo y bonito\n' +
            '👉 Ejemplo: https://invitartes.com/muestra-serenitas-invitartes-essential/\n\n' +
            '*DELUXE — $79*\n' +
            'Más estilo + envío público\n' +
            '👉 Ejemplo: https://invitartes.com/invitacion-baby-shower-muestra/\n\n' +
            '*ELITE — $100* 👑\n' +
            'Todo Deluxe + íconos animados, acceso privado, dashboard, invitaciones ilimitadas, fecha límite, mensajes editables y contador de asistencias en vivo.\n' +
            '👉 Ejemplo: https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/'
        );
        console.log(`  ✓ ${userId}: Mensaje 8/10`);
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            'Para iniciar con el proceso, por favor, complete el siguiente formulario (Datos para sus invitaciones):\n\n' +
            '📝 https://forms.gle/98PBCSF1hbYC3iTj7\n\n' +
            'O si lo prefiere, también puede enviarnos por WhatsApp los detalles y la temática que desea para sus invitaciones.\n\n' +
            'Una vez recibamos la información, nos comprometemos a entregarle las invitaciones en un plazo máximo de 5 días.\n\n' +
            'Empezamos con un abono inicial de $10, que puede realizar al siguiente número de cuenta:\n\n' +
            '*Banco de Loja*\n' +
            'Número de cuenta: 2904553231\n' +
            'Cédula: 1104753122\n' +
            'Tipo de cuenta: Cuenta de ahorros (cuenta activa)\n' +
            'Titular: ALVAREZ GRANDA, GUIDO CRISTOPHER\n\n' +
            'El saldo restante podrá ser cancelado en el momento de la entrega de sus invitaciones. ✨'
        );
        console.log(`  ✓ ${userId}: Mensaje 9/10`);
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('Si tiene una pregunta, por favor coméntenos, estamos para servirle ✨');
        console.log(`  ✓ ${userId}: Mensaje 10/10`);
        
        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado = false;
            estado.seguimiento2Enviado = false;
        }
        
        // SEGUIMIENTO 1: Después de 7 minutos
        setTimeout(async () => {
            const estadoActual = userStates.get(userId);
            if (estadoActual && estadoActual.secuenciaCompleta && !estadoActual.respondioPostSecuencia && !estadoActual.seguimiento1Enviado) {
                try {
                    await chat.sendMessage(
                        'Hola que tal, le saluda *Carolina* del Equipo de *Invitartes* ¿Tiene alguna pregunta?'
                    );
                    estadoActual.seguimiento1Enviado = true;
                    console.log(`📞 Seguimiento 1 enviado a: ${userId}`);
                    
                    // SEGUIMIENTO 2: Después de otros 7 minutos (total 14 min desde el final de la secuencia)
                    setTimeout(async () => {
                        const estadoFinal = userStates.get(userId);
                        if (estadoFinal && !estadoFinal.respondioPostSecuencia && estadoFinal.seguimiento1Enviado && !estadoFinal.seguimiento2Enviado) {
                            try {
                                await chat.sendMessage(
                                    'Hola, quería recordarte que personalizamos completamente tu invitación digital según tu estilo, colores y temática. Cada invitado recibe su invitación con su nombre y número de pases.\n\n' +
                                    'Además, te activamos una plataforma con una lista interactiva de todos tus invitados, lista para enviarles el mensaje vía WhatsApp o email.\n\n' +
                                    'Te dejo algunos ejemplos:\n' +
                                    '• XV años (Van Gogh): https://invitartes.com/xv-anos-anghelith-cuando-el-cielo-se-lleno-de-estrellas/\n' +
                                    '• Boda (apertura): https://invitartes.com/invitacion-a-la-boda-de-israel-y-genesis/\n' +
                                    '• Boda (rojo): https://invitartes.com/invitacion-a-la-boda-de-mari-jose-oficial-copy/\n' +
                                    '• Graduación: https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n' +
                                    'Si quieres comenzar, llena este formulario: https://forms.gle/98PBCSF1hbYC3iTj7\n\n' +
                                    'Abono inicial: $10. El resto lo cancelas al recibir tus invitaciones.\n\n' +
                                    'Quedo atenta.'
                                );
                                estadoFinal.seguimiento2Enviado = true;
                                console.log(`📞 Seguimiento 2 enviado a: ${userId}`);
                            } catch (error) {
                                console.log(`⚠️ ${userId}: Error seguimiento 2`);
                            }
                        }
                    }, 7 * 60 * 1000); // 7 minutos adicionales
                    
                } catch (error) {
                    console.log(`⚠️ ${userId}: Error seguimiento 1`);
                }
            }
        }, 7 * 60 * 1000); // 7 minutos
        
        console.log(`✅ Secuencia completa enviada a: ${userId}\n`);
        
    } catch (error) {
        console.error(`❌ Error secuencia ${userId}:`, error.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId) {
    try {
        const chat = await client.getChatById(userId);
        console.log(`📤 Enviando mensaje de asesor a: ${userId}`);
        
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            '👩🏻‍💼 *Asesor en línea*\n\n' +
            '¡Gracias por comunicarse con nosotros!\n\n' +
            'En unos momentos uno de nuestros asesores se pondrá en contacto con usted.\n' +
            'Le pedimos por favor permanecer en línea.\n\n' +
            'Será un placer atenderle. ✨'
        );
        console.log(`✅ Mensaje de asesor enviado a: ${userId}`);
    } catch (error) {
        console.error(`❌ Error asesor ${userId}:`, error.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarRespuestaPorDefecto(userId, messageText) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendMessage(
            'Disculpe, no entendí su mensaje. 😊\n\n' +
            'Por favor escriba *"Hola"* o *"Información"* para comenzar, o envíe *1* o *2* si ya vio el menú.'
        );
        console.log(`💬 Respuesta por defecto a ${userId}: "${messageText}"`);
    } catch (error) {
        console.error(`❌ Error respuesta defecto ${userId}:`, error.message);
    }
}

client.on('message', async (message) => {
    try {
        if (message.fromMe) return;
        
        const chat = await message.getChat();
        if (chat.isGroup) return;
        
        const userId = message.from;
        const messageText = message.body.trim();
        
        console.log(`📩 ${userId}: "${messageText}"`);
        
        // Verificar si está bloqueado por timeout
        if (processingUsers.has(userId)) {
            const timestamp = processingUsers.get(userId);
            const elapsed = Date.now() - timestamp;
            if (elapsed < 5 * 60 * 1000) { // Menos de 5 min
                console.log(`⏭️ ${userId} procesando (${Math.round(elapsed/1000)}s)`);
                return;
            } else {
                console.log(`🔓 ${userId} liberado por timeout`);
                processingUsers.delete(userId);
            }
        }
        
        let estado = userStates.get(userId);
        
        // Mensaje de inicio
        if (!estado && esMensajeDeInicio(messageText)) {
            processingUsers.set(userId, Date.now());
            userStates.set(userId, {
                menuEnviado: true,
                secuenciaCompleta: false,
                respondioPostSecuencia: false,
                seguimiento1Enviado: false,
                seguimiento2Enviado: false,
                timestamp: new Date()
            });
            enviarMenuPrincipal(userId).catch(err => {
                console.error(`❌ ${userId}:`, err.message);
                processingUsers.delete(userId);
            });
            return;
        }
        
        // Opciones del menú
        if (estado) {
            if (estado.secuenciaCompleta) {
                estado.respondioPostSecuencia = true;
                console.log(`✅ ${userId} respondió post-secuencia`);
            }
            
            if (messageText === '1') {
                processingUsers.set(userId, Date.now());
                enviarSecuenciaCompleta(userId).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            
            if (messageText === '2') {
                processingUsers.set(userId, Date.now());
                enviarMensajeAsesor(userId).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            
            // Si tiene estado pero no es 1 o 2, permitir conversación libre
            console.log(`💬 ${userId} conversación libre`);
            return;
        }
        
        // Mensaje no reconocido
        console.log(`❓ ${userId} mensaje no reconocido`);
        await enviarRespuestaPorDefecto(userId, messageText);
        
    } catch (error) {
        console.error('❌ Error handler:', error.message);
    }
});

app.get('/', async (req, res) => {
    if (clientReady) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bot Conectado</title>
                <style>
                    body {
                        font-family: system-ui;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                    }
                    .container {
                        background: white;
                        padding: 3rem;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h1 { color: #667eea; margin-bottom: 1rem; }
                    .status { background: #d4edda; color: #155724; padding: 1rem; border-radius: 10px; margin: 1rem 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ Bot Conectado</h1>
                    <div class="status">
                        <h2>🎉 Funcionando correctamente</h2>
                        <p>📱 ${botPhoneNumber || 'Cargando...'}</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeData) {
        try {
            const qrImage = await QRCode.toDataURL(qrCodeData);
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta http-equiv="refresh" content="5">
                    <title>Conectar WhatsApp</title>
                    <style>
                        body {
                            font-family: system-ui;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0;
                            padding: 20px;
                        }
                        .container {
                            background: white;
                            padding: 2rem;
                            border-radius: 20px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                            max-width: 600px;
                        }
                        h1 { color: #667eea; }
                        .qr { background: white; padding: 20px; border-radius: 15px; display: inline-block; margin: 20px 0; }
                        .qr img { max-width: 300px; height: auto; }
                        .instructions { text-align: left; background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                        ol { margin-left: 20px; }
                        li { margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 Conectar WhatsApp</h1>
                        <div class="qr">
                            <img src="${qrImage}" alt="QR Code">
                        </div>
                        <div class="instructions">
                            <h3>📋 Instrucciones:</h3>
                            <ol>
                                <li>Abre WhatsApp en tu celular</li>
                                <li>Ve a Configuración ⚙️</li>
                                <li>Toca "Dispositivos Vinculados"</li>
                                <li>Toca "Vincular un dispositivo"</li>
                                <li>Escanea el código QR</li>
                            </ol>
                        </div>
                        <p>🔄 Se actualiza cada 5 segundos</p>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            res.send('<h1>Error generando QR</h1>');
        }
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="refresh" content="3">
                <title>Iniciando...</title>
                <style>
                    body {
                        font-family: system-ui;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                    }
                    .container { background: white; padding: 3rem; border-radius: 20px; text-align: center; }
                    .loader {
                        border: 8px solid #f3f3f3;
                        border-top: 8px solid #667eea;
                        border-radius: 50%;
                        width: 60px;
                        height: 60px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                    h1 { color: #667eea; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="loader"></div>
                    <h1>⏳ Iniciando Bot...</h1>
                </div>
            </body>
            </html>
        `);
    }
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT v3.0 (Optimizado)');
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
