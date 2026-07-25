/**
 * Push-to-talk voice recorder: tap to start, auto-stop on silence, hard cap at
 * ~30s. Feature-detects the container the device can actually produce (webm/opus
 * on Chrome/Android, mp4/AAC on iOS Safari) and reports a live input level for
 * the waveform. Client-only (uses getUserMedia / MediaRecorder / AudioContext).
 */

export const MAX_RECORDING_MS = 30_000;
const SILENCE_RMS = 0.02;
const SILENCE_HOLD_MS = 1500;
const SPEECH_RMS = 0.05;

/** Candidate containers, most-preferred first. */
const MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
];

function defaultIsSupported(type: string): boolean {
  return (
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)
  );
}

/**
 * Pick the first container the device supports. Pure given an `isSupported`
 * predicate, so it's unit-testable without a real MediaRecorder.
 */
export function pickRecordingMimeType(
  isSupported: (type: string) => boolean = defaultIsSupported,
): string {
  for (const type of MIME_PREFERENCES) {
    if (isSupported(type)) return type;
  }
  return ""; // let the browser choose its default
}

export interface RecorderCallbacks {
  /** Input level 0..1, ~60fps while recording (drives the waveform). */
  onLevel?: (level: number) => void;
  /** Fired when recording ends (silence, cap, or manual stop) with the audio. */
  onComplete?: (result: { blob: Blob; mimeType: string }) => void;
  onError?: (error: Error) => void;
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: Blob[] = [];
  private raf = 0;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceStart: number | null = null;
  private hasSpoken = false;
  private mimeType = "";
  private stopped = false;

  constructor(private cb: RecorderCallbacks) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = pickRecordingMimeType();
    this.recorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => this.finalize();
    this.recorder.start();

    // Level metering + silence detection.
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);
    this.monitor();

    this.capTimer = setTimeout(() => this.stop(), MAX_RECORDING_MS);
  }

  /** Request stop; the recorded audio arrives via onComplete. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.capTimer) clearTimeout(this.capTimer);
    cancelAnimationFrame(this.raf);
    try {
      if (this.recorder && this.recorder.state !== "inactive") {
        this.recorder.stop();
      } else {
        this.finalize();
      }
    } catch (err) {
      this.cb.onError?.(err as Error);
    }
  }

  /** Abandon the recording without emitting audio. */
  cancel(): void {
    this.stopped = true;
    if (this.capTimer) clearTimeout(this.capTimer);
    cancelAnimationFrame(this.raf);
    this.teardownStream();
  }

  private monitor = () => {
    if (!this.analyser) return;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    this.cb.onLevel?.(Math.min(1, rms * 4));

    const now = Date.now();
    if (rms > SPEECH_RMS) {
      this.hasSpoken = true;
      this.silenceStart = null;
    } else if (rms < SILENCE_RMS && this.hasSpoken) {
      if (this.silenceStart === null) this.silenceStart = now;
      else if (now - this.silenceStart > SILENCE_HOLD_MS) {
        this.stop();
        return;
      }
    }
    this.raf = requestAnimationFrame(this.monitor);
  };

  private finalize(): void {
    const blob = new Blob(this.chunks, {
      type: this.mimeType || "audio/webm",
    });
    this.teardownStream();
    if (blob.size > 0) {
      this.cb.onComplete?.({ blob, mimeType: blob.type });
    } else {
      this.cb.onError?.(new Error("No audio captured"));
    }
  }

  private teardownStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close().catch(() => {});
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
  }
}
