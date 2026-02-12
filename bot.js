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

const client = new Client({
    authStrategy: new LocalAuth({ 
        dataPath: './.wwebjs_auth',
        clientId: 'invitartes-bot'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/nix/store/*/bin/chromium',
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
        'invitacion', 'invitación', 'boda', 'xv años', 'quinceaños',
        'baby shower', 'cumpleaños', 'evento'
    ];
    return triggers.some(trigger => text.toLowerCase().includes(trigger));
}

async function enviarInformacionCompleta(userId) {
    const chat = await client.getChatById(userId);
    console.log(`📤 Enviando información a: ${userId}`);
    
    try {
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('😊 Con mucho gusto, ahora le explico ✨');
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            'Le envío algunas funciones de nuestras invitaciones:\n\n' +
            '💫 *Tu evento, tu estilo:* Diseño 100% personalizado\n\n' +
            '📱 *Confirmaciones automáticas:* Tus invitados confirman con un clic\n\n' +
            '🎵 *Multimedia:* Música, videos, galerías de fotos\n\n' +
            '⏰ *Recordatorios inteligentes:* Nadie olvida tu fecha\n\n' +
            '🎁 *Mesa de regalos integrada*\n\n' +
            '📊 *Control total:* Dashboard en tiempo real\n\n' +
            '♾️ *Sin límites de invitados*\n\n' +
            '🌍 *Alcance global*\n\n' +
            '🔄 *Actualizaciones ilimitadas*'
        );
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgSobres = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(imgSobres, undefined, {
                caption: 'Ejemplo real:\n\n🔗 https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/'
            });
        } catch (error) {
            await chat.sendMessage('🔗 https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgLia = await MessageMedia.fromUrl(FIREBASE_URLS.imagenLia);
            await chat.sendMessage(imgLia, undefined, {
                caption: '🔗 https://invitartes.com/invitacion-a-los-xv-anos-de-lia-isabella-muestra/'
            });
        } catch (error) {
            await chat.sendMessage('🔗 https://invitartes.com/invitacion-a-los-xv-anos-de-lia-isabella-muestra/');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('📸 *Instagram:*\nhttps://www.instagram.com/invitartes.ec');
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const audioMedia = await MessageMedia.fromUrl(FIREBASE_URLS.audio);
            await chat.sendMessage(audioMedia, undefined, {
                caption: '🎤 Audio explicativo'
            });
        } catch (error) {
            console.log('⚠️ Error enviando audio');
        }
        
        await chat.sendStateTyping();
        await sleep(3000);
        try {
            const videoMedia = await MessageMedia.fromUrl(FIREBASE_URLS.video);
            await chat.sendMessage(videoMedia, undefined, {
                caption: '🎬 Video promocional'
            });
        } catch (error) {
            console.log('⚠️ Error enviando video');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const pdfMedia = await MessageMedia.fromUrl(FIREBASE_URLS.pdfPaquetes);
            await chat.sendMessage(pdfMedia, undefined, {
                caption: '📄 *Catálogo 2026*'
            });
        } catch (error) {
            console.log('⚠️ Error enviando PDF');
        }
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            '💰 *PRECIO ESPECIAL: $75*\n\n' +
            '📌 *Incluye TODO:*\n' +
            '• Diseño personalizado\n' +
            '• Confirmaciones ilimitadas\n' +
            '• Multimedia completa\n' +
            '• Dashboard de control\n' +
            '• Mesa de regalos\n' +
            '• Recordatorios automáticos\n' +
            '• Soporte técnico\n\n' +
            '🎁 *PAGO ÚNICO - SIN COSTOS OCULTOS*'
        );
        
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            '📞 *¿Listo para tu invitación?*\n\n' +
            'WhatsApp: +593 99 380 9643\n' +
            '📧 invitartesec@gmail.com\n' +
            '🌐 www.invitartes.com\n\n' +
            '✨ *¡Tu evento inolvidable!*'
        );
        
        console.log(`✅ Información enviada a: ${userId}\n`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

client.on('message', async (message) => {
    try {
        if (message.fromMe) return;
        
        const chat = await message.getChat();
        if (chat.isGroup) return;
        
        const userId = message.from;
        const messageText = message.body;
        
        console.log(`📩 De ${userId}: "${messageText}"`);
        
        if (esMensajeDeInicio(messageText)) {
            if (userStates.has(userId)) {
                console.log(`⏭️ Usuario ya procesado`);
                return;
            }
            
            userStates.set(userId, { timestamp: new Date() });
            await enviarInformacionCompleta(userId);
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
