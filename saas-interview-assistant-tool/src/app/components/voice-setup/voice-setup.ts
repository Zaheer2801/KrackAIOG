import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { VoiceCloneService } from '../../services/voice/voice-clone.service';
import { ENROLLMENT_SCRIPTS, VERIFICATION_SCRIPTS, EnrollmentSection } from '../../services/voice/enrollment-scripts';

/**
 * Voice Setup — IN-DEVELOPMENT (hidden behind environment.voiceCloneEnabled).
 * Practice/rehearsal: record enrollment scripts → clone → verify quality → play back.
 */
@Component({
  selector: 'app-voice-setup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voice-setup.html',
  styleUrl: './voice-setup.css',
})
export class VoiceSetup {
  enabled = (environment as any).voiceCloneEnabled === true;

  sections: EnrollmentSection[] = ENROLLMENT_SCRIPTS;
  verificationScripts = VERIFICATION_SCRIPTS;

  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  recordingSectionId: string | null = null;
  recordedSamples: Map<string, Blob> = new Map(); // sectionId -> audio blob

  // Clone state
  voiceId: string | null = null;
  isCloning = false;
  isVerifying = false;
  isSynthesizing = false;

  // Verification report
  report: {
    overallAccuracy: number;
    overallVerdict: string;
    results: { id: string; expected: string; heard: string; accuracy: number; verdict: string }[];
  } | null = null;

  constructor(
    private voice: VoiceCloneService,
    private toaster: ToastrService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  get recordedCount(): number { return this.recordedSamples.size; }
  get totalSections(): number { return this.sections.length; }
  get allRecorded(): boolean { return this.recordedSamples.size === this.sections.length; }

  async startRecording(sectionId: string) {
    if (this.recordingSectionId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.recordedSamples.set(sectionId, blob);
        stream.getTracks().forEach((t) => t.stop());
        this.recordingSectionId = null;
        this.cdr.detectChanges();
      };
      this.mediaRecorder.start();
      this.recordingSectionId = sectionId;
    } catch (err: any) {
      this.toaster.error('Microphone unavailable: ' + (err?.message || ''), 'Recording Error');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  playSample(sectionId: string) {
    const blob = this.recordedSamples.get(sectionId);
    if (!blob) return;
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play().catch(() => {});
  }

  reRecord(sectionId: string) {
    this.recordedSamples.delete(sectionId);
    this.cdr.detectChanges();
  }

  async createClone() {
    if (!this.allRecorded) {
      this.toaster.warning('Please record all sections first.', '');
      return;
    }
    this.isCloning = true;
    try {
      const samples = Array.from(this.recordedSamples.values());
      this.voiceId = await this.voice.cloneVoice(samples);
      this.toaster.success('Voice cloned! Now verify the quality.', 'Clone Created');
    } catch (err: any) {
      this.toaster.error(err?.message || 'Clone failed', 'Error');
    } finally {
      this.isCloning = false;
      this.cdr.detectChanges();
    }
  }

  async runVerification() {
    if (!this.voiceId) return;
    this.isVerifying = true;
    this.report = null;
    try {
      this.report = await this.voice.verify(
        this.voiceId,
        this.verificationScripts.map((s) => ({ id: s.id, text: s.text })),
      );
    } catch (err: any) {
      this.toaster.error(err?.message || 'Verification failed', 'Error');
    } finally {
      this.isVerifying = false;
      this.cdr.detectChanges();
    }
  }

  async playInMyVoice(text: string) {
    if (!this.voiceId) return;
    this.isSynthesizing = true;
    try {
      await this.voice.speak(this.voiceId, text);
    } catch (err: any) {
      this.toaster.error(err?.message || 'Playback failed', 'Error');
    } finally {
      this.isSynthesizing = false;
      this.cdr.detectChanges();
    }
  }

  verdictClass(v: string): string {
    if (v === 'excellent' || v === 'good') return 'text-emerald-400';
    return 'text-rose-400';
  }

  back() { this.router.navigate(['dashboard']); }
}
