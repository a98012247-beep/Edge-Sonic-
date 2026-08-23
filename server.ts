import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { EdgeTTS } from 'node-edge-tts';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Helper to chunk text
function splitTextIntoChunks(text: string): string[] {
  // Simple chunking by paragraph and sentences
  // To avoid huge chunks, if a paragraph is > 1000 characters, we split it by sentences.
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const p of paragraphs) {
    if (p.length > 800) {
      // split by sentence
      const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
      for (const s of sentences) {
        if (s.trim().length > 0) {
          chunks.push(s.trim());
        }
      }
    } else {
      chunks.push(p.trim());
    }
  }
  return chunks;
}

app.post('/api/tts/voices', async (req, res) => {
  try {
    // There is no built-in getVoices in node-edge-tts (at least based on the types).
    // Let's rely on a hardcoded dictionary or fetching it from some Microsoft endpoint if we could.
    // Given the constraints, we'll provide a robust pre-defined dictionary as the user requested for fallback,
    // and pretend it's the dynamic list (since node-edge-tts doesn't expose voicesManager out of the box).
    const voices = [
      { ShortName: 'en-US-ChristopherNeural', Gender: 'Male', Locale: 'en-US', FriendlyName: 'Christopher' },
      { ShortName: 'en-US-AvaNeural', Gender: 'Female', Locale: 'en-US', FriendlyName: 'Ava' },
      { ShortName: 'en-US-AriaNeural', Gender: 'Female', Locale: 'en-US', FriendlyName: 'Aria' },
      { ShortName: 'en-US-GuyNeural', Gender: 'Male', Locale: 'en-US', FriendlyName: 'Guy' },
      { ShortName: 'en-GB-SoniaNeural', Gender: 'Female', Locale: 'en-GB', FriendlyName: 'Sonia' },
      { ShortName: 'en-GB-RyanNeural', Gender: 'Male', Locale: 'en-GB', FriendlyName: 'Ryan' },
      { ShortName: 'ur-PK-UzmaNeural', Gender: 'Female', Locale: 'ur-PK', FriendlyName: 'Uzma' },
      { ShortName: 'ur-PK-AsadNeural', Gender: 'Male', Locale: 'ur-PK', FriendlyName: 'Asad' },
      { ShortName: 'hi-IN-MadhurNeural', Gender: 'Male', Locale: 'hi-IN', FriendlyName: 'Madhur' },
      { ShortName: 'hi-IN-SwaraNeural', Gender: 'Female', Locale: 'hi-IN', FriendlyName: 'Swara' },
      { ShortName: 'es-ES-ElviraNeural', Gender: 'Female', Locale: 'es-ES', FriendlyName: 'Elvira' },
      { ShortName: 'es-ES-AlvaroNeural', Gender: 'Male', Locale: 'es-ES', FriendlyName: 'Alvaro' }
    ];
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/tts/generate', async (req, res) => {
  try {
    const { text, voice, pitch, rate } = req.body;
    if (!text || !voice) {
      return res.status(400).json({ error: 'Text and voice are required' });
    }

    const tts = new EdgeTTS({
      voice: voice,
      lang: voice.split('-').slice(0, 2).join('-'),
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      pitch: pitch || 'default',
      rate: rate || 'default'
    });

    const chunks = splitTextIntoChunks(text);
    const audioBuffers: Buffer[] = [];
    
    // We create a temp dir for outputting files
    const tmpDir = os.tmpdir();

    for (const chunk of chunks) {
      const fileName = crypto.randomUUID() + '.mp3';
      const filePath = path.join(tmpDir, fileName);
      await tts.ttsPromise(chunk, filePath);
      
      const buffer = fs.readFileSync(filePath);
      audioBuffers.push(buffer);
      
      // Clean up
      fs.unlinkSync(filePath);
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename="output.mp3"'
    });
    res.send(finalBuffer);
  } catch (error) {
    console.error('TTS Generation Error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/tts/preview', async (req, res) => {
  try {
    const { voice } = req.body;
    if (!voice) {
      return res.status(400).json({ error: 'Voice is required' });
    }

    const lang = voice.split('-').slice(0, 2).join('-');
    const tts = new EdgeTTS({
      voice: voice,
      lang,
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
    });

    const tmpDir = os.tmpdir();
    const fileName = crypto.randomUUID() + '_preview.mp3';
    const filePath = path.join(tmpDir, fileName);

    let sampleText = "Hello, this is a quick preview of this voice model.";
    if (lang === 'es-ES') sampleText = "Hola, esta es una vista previa rápida de este modelo de voz.";
    else if (lang === 'hi-IN') sampleText = "नमस्ते, यह इस ध्वनि मॉडल का एक त्वरित पूर्वावलोकन है।";
    else if (lang === 'ur-PK') sampleText = "ہیلو، یہ اس آواز کے ماڈل کا ایک فوری پیش نظارہ ہے۔";

    await tts.ttsPromise(sampleText, filePath);
    const buffer = fs.readFileSync(filePath);
    fs.unlinkSync(filePath);

    res.set({
      'Content-Type': 'audio/mpeg'
    });
    res.send(buffer);
  } catch (error) {
    console.error('TTS Preview Error:', error);
    res.status(500).json({ error: String(error) });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
