/**
 * Speech, abstracted away from whoever produces it.
 *
 * The UI talks to one facade — speak / pause / resume / stop / setVolume /
 * setRate — and subscribes to a snapshot store. Swapping the browser engine for
 * a hosted voice is a one-line change here and nothing at all in the panel.
 *
 * The browser engine is the default rather than a fallback: it is instant, free,
 * offline, and needs no key. Its three well-known defects are all handled by
 * speaking one sentence at a time:
 *
 *   • Chrome silently stops an utterance after roughly fifteen seconds. Short
 *     utterances never reach that limit.
 *   • Volume and rate are fixed once an utterance starts. With a sentence queue
 *     a change takes effect within a sentence instead of requiring a restart.
 *   • A long utterance reports progress only through sparse word boundaries.
 *     Per-sentence chunks give a reliable floor for the progress bar.
 */

export type SpeechStatus = 'idle' | 'loading' | 'speaking' | 'paused';

export interface SpeechSnapshot {
  readonly status: SpeechStatus;
  /** 0 → 1 through the current text. */
  readonly progress: number;
  readonly volume: number;
  readonly rate: number;
  /** The browser refused to start without a gesture — show a Play button. */
  readonly blocked: boolean;
  readonly supported: boolean;
  readonly error: string | null;
}

type Listener = () => void;

const REMOTE_ENDPOINT = import.meta.env.VITE_TTS_API_URL as string | undefined;

/** Roughly a breath. Long enough to sound natural, short enough to stay agile. */
const MAX_CHUNK = 180;

/**
 * Split into speakable chunks on sentence boundaries, falling back to clause
 * boundaries for anything still too long. Abbreviations that end in a period
 * are rare in this corpus, so a simple rule is safe here.
 */
export const chunkForSpeech = (text: string): string[] => {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK) {
      chunks.push(sentence);
      continue;
    }
    let remainder = sentence;
    while (remainder.length > MAX_CHUNK) {
      const cut = remainder.lastIndexOf(',', MAX_CHUNK);
      const at = cut > MAX_CHUNK * 0.4 ? cut + 1 : MAX_CHUNK;
      chunks.push(remainder.slice(0, at).trim());
      remainder = remainder.slice(at).trim();
    }
    if (remainder) chunks.push(remainder);
  }
  return chunks;
};

class SpeechService {
  #listeners = new Set<Listener>();
  #snapshot: SpeechSnapshot;

  #chunks: string[] = [];
  #chunkIndex = 0;
  #charsBefore = 0;
  #totalChars = 0;

  /** Chrome garbage-collects utterances that nothing references mid-speech. */
  #current: SpeechSynthesisUtterance | null = null;
  #keepAlive: number | null = null;
  #audio: HTMLAudioElement | null = null;
  #generation = 0;
  #voice: SpeechSynthesisVoice | null = null;

  constructor() {
    const supported =
      typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

    this.#snapshot = Object.freeze({
      status: 'idle' as SpeechStatus,
      progress: 0,
      volume: 0.9,
      rate: 1,
      blocked: false,
      supported,
      error: null,
    });

    if (supported) this.#pickVoice();
  }

  /* --- store ------------------------------------------------------------- */

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): SpeechSnapshot => this.#snapshot;

  #patch(next: Partial<SpeechSnapshot>): void {
    const merged = { ...this.#snapshot, ...next };
    const unchanged = (Object.keys(merged) as (keyof SpeechSnapshot)[]).every(
      (field) => merged[field] === this.#snapshot[field],
    );
    if (unchanged) return;

    this.#snapshot = Object.freeze(merged);
    for (const listener of this.#listeners) listener();
  }

  /* --- voice selection ---------------------------------------------------- */

  /**
   * Voices load asynchronously and the first call often returns an empty list,
   * so this re-runs on `voiceschanged`. An en-GB/en-US local voice is preferred
   * — network voices introduce a lag that ruins click-to-speech.
   */
  #pickVoice(): void {
    const choose = (): void => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      this.#voice =
        voices.find((v) => v.localService && /^en[-_](GB|US)/i.test(v.lang)) ??
        voices.find((v) => /^en/i.test(v.lang)) ??
        voices[0] ??
        null;
    };

    choose();
    window.speechSynthesis.addEventListener('voiceschanged', choose);
  }

  /* --- transport ---------------------------------------------------------- */

  speak(text: string): void {
    this.stop();

    const trimmed = text.trim();
    if (!trimmed) return;

    if (!this.#snapshot.supported && !REMOTE_ENDPOINT) {
      this.#patch({
        status: 'idle',
        error: 'This browser has no speech engine, so the guide is text only.',
      });
      return;
    }

    this.#chunks = chunkForSpeech(trimmed);
    this.#chunkIndex = 0;
    this.#charsBefore = 0;
    this.#totalChars = this.#chunks.join(' ').length;
    this.#generation += 1;

    this.#patch({ status: 'loading', progress: 0, error: null, blocked: false });

    if (REMOTE_ENDPOINT) {
      void this.#speakRemote(trimmed, this.#generation);
      return;
    }
    this.#speakNextChunk(this.#generation);
  }

  /* --- browser engine ------------------------------------------------------ */

  #speakNextChunk(generation: number): void {
    if (generation !== this.#generation) return;

    if (this.#chunkIndex >= this.#chunks.length) {
      this.#finish();
      return;
    }

    const chunk = this.#chunks[this.#chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.volume = this.#snapshot.volume;
    utterance.rate = this.#snapshot.rate;
    utterance.pitch = 1;
    if (this.#voice) utterance.voice = this.#voice;

    utterance.onstart = () => {
      if (generation !== this.#generation) return;
      this.#patch({ status: 'speaking', blocked: false });
    };

    utterance.onboundary = (event) => {
      if (generation !== this.#generation) return;
      const spoken = this.#charsBefore + (event.charIndex ?? 0);
      this.#patch({ progress: Math.min(1, spoken / Math.max(1, this.#totalChars)) });
    };

    utterance.onend = () => {
      if (generation !== this.#generation) return;
      this.#charsBefore += chunk.length + 1;
      this.#chunkIndex += 1;
      this.#patch({
        progress: Math.min(1, this.#charsBefore / Math.max(1, this.#totalChars)),
      });
      this.#speakNextChunk(generation);
    };

    utterance.onerror = (event) => {
      if (generation !== this.#generation) return;
      // `interrupted` and `canceled` are what stop() produces; they are not
      // failures and must not surface as one.
      if (event.error === 'interrupted' || event.error === 'canceled') return;

      if (event.error === 'not-allowed') {
        this.#patch({
          status: 'idle',
          blocked: true,
          error: 'Autoplay is blocked — press play to hear the guide.',
        });
        return;
      }
      this.#patch({ status: 'idle', error: 'Speech playback failed.' });
    };

    this.#current = utterance;
    window.speechSynthesis.speak(utterance);
    this.#startKeepAlive();
  }

  /**
   * Chrome pauses its own synthesis queue when a tab has been speaking for a
   * while. Nudging resume() on a timer is the long-standing workaround.
   */
  #startKeepAlive(): void {
    this.#stopKeepAlive();
    this.#keepAlive = window.setInterval(() => {
      if (this.#snapshot.status !== 'speaking') return;
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 9000);
  }

  #stopKeepAlive(): void {
    if (this.#keepAlive !== null) {
      window.clearInterval(this.#keepAlive);
      this.#keepAlive = null;
    }
  }

  /* --- hosted engine ------------------------------------------------------- */

  /**
   * Hosted voice. Same credential rule as the language model: the endpoint must
   * be one you control, because a VITE_ variable is published in the bundle.
   * Expected to answer with an audio body (audio/mpeg, audio/wav, …).
   */
  async #speakRemote(text: string, generation: number): Promise<void> {
    try {
      const response = await fetch(REMOTE_ENDPOINT as string, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Voice endpoint returned ${response.status}`);

      const blob = await response.blob();
      if (generation !== this.#generation) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = this.#snapshot.volume;
      audio.playbackRate = this.#snapshot.rate;

      audio.ontimeupdate = () => {
        if (generation !== this.#generation || !audio.duration) return;
        this.#patch({ progress: Math.min(1, audio.currentTime / audio.duration) });
      };
      audio.onended = () => {
        if (generation !== this.#generation) return;
        URL.revokeObjectURL(url);
        this.#finish();
      };
      audio.onerror = () => {
        if (generation !== this.#generation) return;
        URL.revokeObjectURL(url);
        this.#patch({ status: 'idle', error: 'Voice playback failed.' });
      };

      this.#audio = audio;
      await audio.play();
      if (generation === this.#generation) this.#patch({ status: 'speaking' });
    } catch (error) {
      if (generation !== this.#generation) return;

      // A rejected play() is the autoplay policy, not a broken endpoint.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.#patch({
          status: 'idle',
          blocked: true,
          error: 'Autoplay is blocked — press play to hear the guide.',
        });
        return;
      }
      // Fall back to the browser engine rather than losing the narration.
      if (this.#snapshot.supported) {
        this.#speakNextChunk(generation);
        return;
      }
      this.#patch({ status: 'idle', error: 'The voice service is unavailable.' });
    }
  }

  /* --- controls ------------------------------------------------------------ */

  pause(): void {
    if (this.#snapshot.status !== 'speaking') return;
    if (this.#audio) this.#audio.pause();
    else window.speechSynthesis.pause();
    this.#patch({ status: 'paused' });
  }

  resume(): void {
    if (this.#snapshot.status !== 'paused') return;
    if (this.#audio) void this.#audio.play();
    else window.speechSynthesis.resume();
    this.#patch({ status: 'speaking' });
  }

  stop(): void {
    this.#generation += 1;
    this.#stopKeepAlive();

    if (this.#audio) {
      this.#audio.pause();
      this.#audio.src = '';
      this.#audio = null;
    }

    // Detach before cancelling. `cancel()` fires `onend` on the utterance that
    // was in flight, and an un-detached handler would happily advance the queue
    // of the narration we are trying to silence — which is precisely how two
    // planets end up talking over each other.
    if (this.#current) {
      this.#current.onstart = null;
      this.#current.onend = null;
      this.#current.onerror = null;
      this.#current.onboundary = null;
      this.#current = null;
    }
    if (this.#snapshot.supported) window.speechSynthesis.cancel();
    this.#chunks = [];
    this.#chunkIndex = 0;
    this.#charsBefore = 0;
    this.#patch({ status: 'idle', progress: 0 });
  }

  #finish(): void {
    this.#stopKeepAlive();
    this.#current = null;
    this.#audio = null;
    this.#patch({ status: 'idle', progress: 1 });
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.#patch({ volume: clamped });
    // Applies immediately to hosted audio; to the next sentence on the browser
    // engine, which is why the text is chunked.
    if (this.#audio) this.#audio.volume = clamped;
  }

  setRate(rate: number): void {
    const clamped = Math.max(0.5, Math.min(2, rate));
    this.#patch({ rate: clamped });
    if (this.#audio) this.#audio.playbackRate = clamped;
  }

  /** Release everything — called when the assistant unmounts. */
  dispose(): void {
    this.stop();
    this.#listeners.clear();
  }
}

/**
 * One engine for the whole app. A second would fight the first for the single
 * global `speechSynthesis` queue, which is exactly how overlapping narration
 * happens.
 */
export const speech = new SpeechService();

export const usesHostedVoice = (): boolean =>
  typeof REMOTE_ENDPOINT === 'string' && REMOTE_ENDPOINT.trim().length > 0;
