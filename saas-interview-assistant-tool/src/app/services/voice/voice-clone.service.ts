import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * VoiceCloneService — IN-DEVELOPMENT (practice/rehearsal only).
 *
 * Talks to the hidden /dev/voice/* backend endpoints. Those return 404 unless
 * the server has ENABLE_VOICE_CLONE=true, so this service is inert in
 * production. The UI that uses it is gated behind environment.voiceCloneEnabled.
 *
 * Flow:
 *   1. record a few short voice samples (reuse the agent-training recordings)
 *   2. cloneVoice(samples) -> voiceId   (store on the user/session)
 *   3. speak(voiceId, text) -> plays the answer back in the user's voice
 */
@Injectable({ providedIn: 'root' })
export class VoiceCloneService {
  private readonly api = environment.apiUrl;

  get enabled(): boolean {
    return (environment as any).voiceCloneEnabled === true;
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token') || '';
    return { Authorization: `Bearer ${token}` };
  }

  /** Create a cloned voice from one or more audio blobs. Returns the voiceId. */
  async cloneVoice(samples: Blob[]): Promise<string> {
    if (!this.enabled) throw new Error('Voice cloning is not enabled.');
    const form = new FormData();
    samples.forEach((b, i) => form.append('samples', b, `sample-${i}.webm`));
    const res = await fetch(`${this.api}/dev/voice/clone`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(`Clone failed (${res.status})`);
    const data = await res.json();
    return data.voiceId as string;
  }

  /** Synthesize `text` in the cloned voice and return a playable audio URL. */
  async synthesize(voiceId: string, text: string): Promise<string> {
    if (!this.enabled) throw new Error('Voice cloning is not enabled.');
    const res = await fetch(`${this.api}/dev/voice/speak`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, text }),
    });
    if (!res.ok) throw new Error(`Synthesis failed (${res.status})`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  /** Convenience: synthesize and play immediately. Returns the Audio element. */
  async speak(voiceId: string, text: string): Promise<HTMLAudioElement> {
    const url = await this.synthesize(voiceId, text);
    const audio = new Audio(url);
    await audio.play().catch(() => {});
    return audio;
  }

  /**
   * Verify clone quality: synthesizes each test script in the cloned voice,
   * transcribes it back, and returns a per-script accuracy + overall verdict.
   * High accuracy = clean, faithful clone with no overlap/garbling.
   */
  async verify(
    voiceId: string,
    scripts: { id: string; text: string }[]
  ): Promise<{
    overallAccuracy: number;
    overallVerdict: string;
    results: { id: string; expected: string; heard: string; accuracy: number; verdict: string }[];
  }> {
    if (!this.enabled) throw new Error('Voice cloning is not enabled.');
    const res = await fetch(`${this.api}/dev/voice/verify`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, scripts }),
    });
    if (!res.ok) throw new Error(`Verification failed (${res.status})`);
    return res.json();
  }

  /** Remove a cloned voice from the provider (cleanup / privacy). */
  async deleteVoice(voiceId: string): Promise<void> {
    if (!this.enabled) return;
    await fetch(`${this.api}/dev/voice/${encodeURIComponent(voiceId)}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    }).catch(() => {});
  }
}
