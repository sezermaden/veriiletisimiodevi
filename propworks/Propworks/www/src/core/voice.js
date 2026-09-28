/* Spoken lines for WREN, the facility AI. Uses the platform's speech synthesiser when
   it exists (Windows ships voices, so the UWP build speaks); otherwise the subtitle
   still shows and a short synthetic "chirp" marks the line. */
import { settings } from './settings.js';
import { Audio } from './audio.js';

let voice = null;
function pickVoice() {
  const all = window.speechSynthesis?.getVoices?.() || [];
  const en = all.filter((v) => /^en/i.test(v.lang));
  // Prefer a neutral, clear English voice; any English voice beats none.
  voice = en.find((v) => /Aria|Jenny|Zira|Samantha|Google UK English Female|Hazel|Susan/i.test(v.name)) || en[0] || null;
}
if (window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}

export function speak(text, { pitch = 1.05, rate = 1.02, speaker = 'WREN' } = {}) {
  const synth = window.speechSynthesis;
  if (!settings.tts || !synth || !voice || settings.voice <= 0) {
    Audio.play('terminal');
    return;
  }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.pitch = speaker === 'WREN' ? pitch : 0.7;
    u.rate = rate;
    u.volume = Math.min(1, settings.voice * settings.master);
    synth.speak(u);
  } catch { Audio.play('terminal'); }
}

export function stopSpeech() { try { window.speechSynthesis?.cancel(); } catch { /* */ } }
