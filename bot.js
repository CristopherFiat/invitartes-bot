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

// Estado de conversaciones mejorado
const userStates = new Map();

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
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Desconectado:', reason);
    clientReady = false;
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function esMensajeDeInicio(text) {
    const triggers = [
        'hola', 'buenos dias', 'buenas tardes', 'buenas noches',
        'buen dia', 'buena tarde', 'buena noche', 'ola', 'holis',
        'invitacion', 'invitación', 'boda', 'xv años', 'quinceaños',
        'baby shower', 'cumpleaños', 'evento'
    ];
    return triggers.some(trigger => text.toLowerCase().includes(trigger));
}

async function enviarMenuPrincipal(userId) {
    const chat = await client.getChatById(userId);
    console.log(`📤 Enviando menú principal a: ${userId}`);
    
    try {
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('¿Cómo está? 😊 Con gusto le ayudamos ✨');
        
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            '📋 *Menú Principal*\n\n' +
            '1️⃣ Explícame sobre las invitaciones\n' +
            '2️⃣ Quiero hablar con un asesor'
        );
        
        console.log(`✅ Menú enviado a: ${userId}`);
    } catch (error) {
        console.error('❌ Error enviando menú:', error);
    }
}

async function enviarSecuenciaCompleta(userId) {
    const chat = await client.getChatById(userId);
    console.log(`📤 Enviando secuencia completa a: ${userId}`);
    
    try {
        // MENSAJE 1
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('😊 Con mucho gusto, ahora le explico ✨');
        console.log('  ✓ Mensaje 1/9 enviado');
        
        // MENSAJE 2 - Características
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
        console.log('  ✓ Mensaje 2/9 enviado');
        
        // MENSAJE 3 - Imagen Sobres + Link
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgSobres = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(imgSobres, undefined, {
                caption: 'Le envío un ejemplo real de nuestras invitaciones:\n\n' +
                         '🔗 *Invitación completa:*\n' +
                         'https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/'
            });
            console.log('  ✓ Mensaje 3/9 enviado (imagen sobres)');
        } catch (error) {
            console.log('  ⚠️ Error con imagen sobres');
            await chat.sendMessage(
                'Le envío un ejemplo real de nuestras invitaciones:\n\n' +
                '🔗 *Invitación completa:*\n' +
                'https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/'
            );
        }
        
        // MENSAJE 4 - Imagen Lia + Link
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgLia = await MessageMedia.fromUrl(FIREBASE_URLS.imagenLia);
            await chat.sendMessage(imgLia, undefined, {
                caption: 'Le comparto otra muestra real 💎\n\n' +
                         '📲 Abre la invitación aquí:\n' +
                         'https://invitartes.com/invitacion-xv-anos-lia-haro/'
            });
            console.log('  ✓ Mensaje 4/9 enviado (imagen Lia)');
        } catch (error) {
            console.log('  ⚠️ Error con imagen Lia');
            await chat.sendMessage(
                'Le comparto otra muestra real 💎\n\n' +
                '📲 Abre la invitación aquí:\n' +
                'https://invitartes.com/invitacion-xv-anos-lia-haro/'
            );
        }
        
        // MENSAJE 5 - Video
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const videoMedia = await MessageMedia.fromUrl(FIREBASE_URLS.video);
            await chat.sendMessage(videoMedia, undefined, {
                caption: 'Le envío un videito de cómo funciona nuestro sistema para gestionar invitaciones digitales ✨'
            });
            console.log('  ✓ Mensaje 5/9 enviado (video)');
        } catch (error) {
            console.log('  ⚠️ Error enviando video');
        }
        
        // MENSAJE 6 - PDF
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const pdfMedia = await MessageMedia.fromUrl(FIREBASE_URLS.pdfPaquetes);
            await chat.sendMessage(pdfMedia, undefined, {
                caption: 'Le comento que tenemos 3 paquetes diseñados para adaptarse a diferentes necesidades y presupuestos 🎯\n\n' +
                         'En el PDF adjunto encontrará las características detalladas de cada uno.'
            });
            console.log('  ✓ Mensaje 6/9 enviado (PDF)');
        } catch (error) {
            console.log('  ⚠️ Error enviando PDF');
        }
        
        // MENSAJE 7 - Audio
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('A continuación le explico de manera resumida nuestros paquetes en el audio:');
        
        await sleep(1000);
        try {
            const audioMedia = await MessageMedia.fromUrl(FIREBASE_URLS.audio);
            await chat.sendMessage(audioMedia);
            console.log('  ✓ Mensaje 7/9 enviado (audio)');
        } catch (error) {
            console.log('  ⚠️ Error enviando audio');
        }
        
        // MENSAJE 8 - Planes
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
        console.log('  ✓ Mensaje 8/9 enviado');
        
        // MENSAJE 9 - Proceso de inicio
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
        console.log('  ✓ Mensaje 9/9 enviado');
        
        // MENSAJE 10 - Cierre
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('Si tiene una pregunta, por favor coméntenos, estamos para servirle ✨');
        console.log('  ✓ Mensaje 10/10 enviado');
        
        // Programar mensaje de seguimiento (7 minutos)
        setTimeout(async () => {
            const estado = userStates.get(userId);
            if (estado && !estado.respondio) {
                try {
                    await chat.sendMessage(
                        'Hola que tal, le saluda *Carolina* del Equipo de *Invitartes* ¿Tiene alguna pregunta?'
                    );
                    console.log(`📞 Mensaje de seguimiento enviado a: ${userId}`);
                } catch (error) {
                    console.log('⚠️ Error en mensaje de seguimiento');
                }
            }
        }, 7 * 60 * 1000); // 7 minutos
        
        console.log(`✅ Secuencia completa enviada a: ${userId}\n`);
        
    } catch (error) {
        console.error('❌ Error enviando secuencia:', error);
    }
}

async function enviarMensajeAsesor(userId) {
    const chat = await client.getChatById(userId);
    console.log(`📤 Enviando mensaje de asesor a: ${userId}`);
    
    try {
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
        console.error('❌ Error enviando mensaje de asesor:', error);
    }
}

client.on('message', async (message) => {
    try {
        if (message.fromMe) return;
        
        const chat = await message.getChat();
        if (chat.isGroup) return;
        
        const userId = message.from;
        const messageText = message.body.trim();
        
        console.log(`📩 De ${userId}: "${messageText}"`);
        
        // Obtener o crear estado del usuario
        let estado = userStates.get(userId);
        
        // Si es mensaje de inicio y es nuevo usuario
        if (!estado && esMensajeDeInicio(messageText)) {
            userStates.set(userId, {
                menuEnviado: true,
                respondio: false,
                timestamp: new Date()
            });
            await enviarMenuPrincipal(userId);
            return;
        }
        
        // Si ya tiene estado, procesar respuesta
        if (estado) {
            estado.respondio = true; // Marcar que respondió
            
            if (messageText === '1') {
                await enviarSecuenciaCompleta(userId);
                return;
            }
            
            if (messageText === '2') {
                await enviarMensajeAsesor(userId);
                return;
            }
        }
        
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
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
    console.log('\n🤖 INVITARTES BOT v2.0');
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
