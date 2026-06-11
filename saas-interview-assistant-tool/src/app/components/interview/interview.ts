import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IInterview, InterviewService } from '../../services/interview/interview';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { Auth } from '../../services/auth/auth';
import { catchError, EMPTY, interval, Subscription, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface Question {
  questionNumber: number;
  question: string;
  answer: string;
}

interface Capture {
  preview: string;
  blob: Blob;
}

@Component({
  selector: 'app-interview',
  imports: [FormsModule, CommonModule],
  templateUrl: './interview.html',
  styleUrl: './interview.css',
  standalone: true,
})
export class Interview implements OnDestroy {
  setupStep: 'prep' | 'greeting' | 'agent' | 'pairing' | 'interview' = 'prep';
  aiGreeting: string = '';
  isGreetingLoading: boolean = false;
  isInterviewActive = false;
  isListening = false;
  elapsedTime = 0;
  questions: Question[] = [];
  isProcessing = false;
  isGeneratingAnswer = false;
  isThinkingFirstToken = false;
  resumeFile: File | null = null;
  resumeUploaded = false;
  resumeText = '';
  jobDescription: string = '';
  resumeAnchors: string = '';
  domainGlossary: string = '';
  agentBrain: string = '';
  prepContext: string = '';
  isPrepLoading: boolean = false;

  // Agent training state
  trainingQuestions: Array<{ id: number; type: string; question: string; hint: string }> = [];
  currentTrainingIndex: number = 0;
  agentTrainingAnswers: Array<{ id: number; type: string; question: string; answer: string }> = [];
  currentTrainingAnswer: string = '';
  isLoadingTrainingQuestions: boolean = false;
  isBuildingAgentBrain: boolean = false;
  isTrainingSpeaking: boolean = false;
  isGeneratingTrainingAnswer: boolean = false;
  agentActivated: boolean = false;
  private speechRecognition: any = null;

  userTier!: string;
  remainingMinutes = 0;
  isAdmin = false;
  private lowCreditsWarned = false;

  // Screen capture state
  captures: Capture[] = [];
  isCapturing = false;
  isSending = false;
  aiResponse: string = '';
  captureSources: any[] = [];
  showPicker = false;


  // Auto-answer mode
  isAutoMode = true;

  // 'meeting' = system/loopback audio (interviewer's voice from Zoom/Teams)
  // 'mic'     = device microphone (user's own voice) — Bluetooth auto-handled by OS
  audioMode: 'meeting' | 'mic' = 'meeting';

  // Keyboard shortcut timing for double-key detection
  private _lastShiftTime = 0;
  private _lastCTime = 0;

  @HostListener('document:keydown', ['$event'])
  onGlobalKeyDown(e: KeyboardEvent) {
    // Ignore when typing in any input / textarea / contenteditable
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;

    // Only active during the interview step
    if (this.setupStep !== 'interview' || !this.isInterviewActive) return;

    // ── Spacebar → generate answer now ──
    if (e.code === 'Space') {
      e.preventDefault();
      if (!this.isGeneratingAnswer) this.answerWithAI();
      return;
    }

    // ── Double Shift (within 500 ms) → clear transcription buffer ──
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      const now = Date.now();
      if (now - this._lastShiftTime < 500) {
        this.clearTranscription();
        this._lastShiftTime = 0;
        this.toaster.info('Buffer cleared', '', { timeOut: 1200 });
      } else {
        this._lastShiftTime = now;
      }
      return;
    }

    // ── C pressed twice (within 500 ms) → clear transcription buffer ──
    if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      if (now - this._lastCTime < 500) {
        this.clearTranscription();
        this._lastCTime = 0;
        this.toaster.info('Buffer cleared', '', { timeOut: 1200 });
      } else {
        this._lastCTime = now;
      }
    }
  }

  // Stealth
  sessionId: string = Math.random().toString(36).substring(2, 10);
  isStealthActive = false;
  qrCodeUrl = '';
  stealthBufferTime = 0;
  stealthInterval: any;

  // Electron environment detection
  isElectron = !!(window as any).electronAPI?.setBehindMode;

  // Click-through / BEHIND mode
  isClickThrough = false;

  toggleBehindMode() {
    this.isClickThrough = !this.isClickThrough;
    (window as any).electronAPI?.setBehindMode(this.isClickThrough);
    if (this.isClickThrough) {
      this.toaster.info('BEHIND ON — KrackAI is now see-through. Press Ctrl+Alt+B to return.', '', { timeOut: 4000 });
    }
  }

  apiUrl = environment.apiUrl;
  webSocketUrl = environment.websockerUrl;

  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private extraStreams: MediaStream[] = []; // additional streams to stop on cleanup
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  // Restarts audio when Bluetooth/earphones connect or disconnect
  private _deviceChangeHandler = () => {
    if (!this.isListening) return;
    console.log('[KrackAI] Audio device changed — restarting capture on new device');
    this.stopRealtimeAudioCapture();
    setTimeout(() => this.startRealtimeAudioCapture(), 600);
  };

  private timerSubscription?: Subscription;
  private wasExplicitlyCompleted = false;

  private readonly defaultCaptureTitle = 'Code Analysis from Screen Capture';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private interviewService: InterviewService,
    private toaster: ToastrService,
    private authService: Auth,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.getUserTier();
    (window as any).electronAPI?.onBehindModeChanged((val: boolean) => {
      this.isClickThrough = val;
      this.cdr.detectChanges();
    });
  }

  async onResumeSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, DOCX, or TXT file');
      return;
    }

    this.resumeFile = file;
    this.isProcessing = true;
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const response = await fetch(`${this.apiUrl}/upload-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload resume');
      const data = await response.json();
      this.resumeText = data.text;
      this.resumeUploaded = true;
      this.toaster.success('Resume uploaded successfully');
    } catch (error: any) {
      alert(`Failed to upload resume: ${error.message}`);
      this.resumeFile = null;
    } finally {
      this.isProcessing = false;
    }
  }

  isGeneratingQr = false;

  async enableStealthMode() {
    if (this.isGeneratingQr) return;
    this.isGeneratingQr = true;
    // Clear any existing countdown before starting a new one
    if (this.stealthInterval) { clearInterval(this.stealthInterval); this.stealthInterval = null; }
    try {
      const QRCode = await import('qrcode');
      let stealthUrl: string;

      if ((window as any).electronAPI?.getStealthInfo) {
        // Electron: use local LAN HTTP server — no internet/Render dependency
        const info = await (window as any).electronAPI.getStealthInfo();
        console.log('[Stealth] getStealthInfo returned:', info);
        if (!info?.port) {
          this.toaster.error(
            'Could not start pairing server. Try restarting the app.',
            'Pairing Error', { timeOut: 6000 }
          );
          return;
        }
        // If no LAN IP detected (Ethernet/VPN), fall back to Render backend
        if (!info.lanIp) {
          stealthUrl = `${this.apiUrl}/stealth/${this.sessionId}`;
          this.toaster.warning('No WiFi IP detected — using cloud fallback for pairing.', '', { timeOut: 4000 });
        } else {
          stealthUrl = `http://${info.lanIp}:${info.port}/stealth/${this.sessionId}`;
        }
      } else {
        // Browser: use remote backend
        let lanIp = window.location.hostname;
        if (!lanIp || lanIp === 'localhost' || lanIp === '127.0.0.1') {
          try {
            const ipRes = await fetch(`${this.apiUrl}/local-ip`);
            if (ipRes.ok) lanIp = (await ipRes.json()).ip;
          } catch {}
        }
        const isLocal = lanIp === 'localhost' || lanIp === '127.0.0.1';
        stealthUrl = isLocal
          ? `http://${lanIp}:3000/stealth/${this.sessionId}`
          : `${this.apiUrl}/stealth/${this.sessionId}`;
      }

      this.qrCodeUrl = await QRCode.toDataURL(stealthUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      this.isStealthActive = true;
      this.stealthBufferTime = 600; // 10-minute window

      if (this.stealthInterval) clearInterval(this.stealthInterval);
      this.stealthInterval = setInterval(() => {
        if (this.stealthBufferTime > 0) {
          this.stealthBufferTime--;
        } else {
          clearInterval(this.stealthInterval);
        }
        this.cdr.detectChanges();
      }, 1000);
    } catch (err: any) {
      this.toaster.error('Failed to generate QR code: ' + err.message);
    } finally {
      this.isGeneratingQr = false;
    }
    this.cdr.detectChanges();
  }

  cancelStealth() {
    this.isStealthActive = false;
    if (this.stealthInterval) clearInterval(this.stealthInterval);
  }

  async confirmPrepStep() {
    if (!this.resumeUploaded) {
      alert('Please select a context document to proceed.');
      return;
    }

    if (!this.jobDescription.trim()) {
      alert('Please enter a target Job Description to align responses.');
      return;
    }

    this.isGreetingLoading = true;
    try {
      const response = await fetch(`${this.apiUrl}/generate-greeting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          resumeText: this.resumeText,
          jobDescription: this.jobDescription
        })
      });

      if (!response.ok) throw new Error('Failed to generate greeting');
      const data = await response.json();
      this.aiGreeting = data.greeting;
      this.resumeAnchors = data.resumeAnchors;
      this.setupStep = 'greeting'; // Transition to greeting screen instantly

      // Process domain glossary concurrently in the background
      const glossaryPromise = fetch(`${this.apiUrl}/generate-glossary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          resumeAnchors: this.resumeAnchors,
          jobDescription: this.jobDescription
        })
      }).then(res => res.json())
        .then(data => {
          if (data.domainGlossary) {
            this.domainGlossary = data.domainGlossary;
          }
        }).catch(err => console.error("Glossary generation failed:", err));

      // Build interview prep intelligence in the background (runs while user reads greeting)
      this.isPrepLoading = true;
      glossaryPromise.then(() => {
        // Wait for glossary first so prep has domain context
        return fetch(`${this.apiUrl}/generate-interview-prep`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            resumeAnchors: this.resumeAnchors,
            domainGlossary: this.domainGlossary,
            jobDescription: this.jobDescription
          })
        });
      }).then(res => res!.json())
        .then(data => {
          if (data.prepContext) {
            this.prepContext = data.prepContext;
            console.log('[KrackAI] Interview prep intelligence ready');
          }
        })
        .catch(err => console.error("Interview prep failed:", err))
        .finally(() => {
          this.isPrepLoading = false;
          this.cdr.detectChanges();
        });

    } catch (err: any) {
      this.toaster.error('AI Error: ' + err.message);
    } finally {
      this.isGreetingLoading = false;
    }
  }

  proceedToPairing() {
    this.setupStep = 'agent';
    this.agentTrainingAnswers = [];
    this.currentTrainingIndex = 0;
    this.currentTrainingAnswer = '';
    this.agentActivated = false;
    this.loadTrainingQuestions();
  }

  async loadTrainingQuestions() {
    this.isLoadingTrainingQuestions = true;
    try {
      const response = await fetch(`${this.apiUrl}/generate-training-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          resumeAnchors: this.resumeAnchors,
          domainGlossary: this.domainGlossary,
          jobDescription: this.jobDescription
        })
      });
      if (!response.ok) throw new Error('Failed to generate training questions');
      const data = await response.json();
      this.trainingQuestions = data.questions;
      this.agentTrainingAnswers = this.trainingQuestions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        answer: ''
      }));
    } catch (err: any) {
      this.toaster.error('Failed to load training questions: ' + err.message);
    } finally {
      this.isLoadingTrainingQuestions = false;
      this.cdr.detectChanges();
    }
  }

  saveCurrentTrainingAnswer() {
    if (this.agentTrainingAnswers[this.currentTrainingIndex]) {
      this.agentTrainingAnswers[this.currentTrainingIndex].answer = this.currentTrainingAnswer;
    }
  }

  nextTrainingQuestion() {
    this.saveCurrentTrainingAnswer();
    this.stopTrainingSpeech();
    this.currentTrainingAnswer = '';
    this.isGeneratingTrainingAnswer = false;
    if (this.currentTrainingIndex < this.trainingQuestions.length - 1) {
      this.currentTrainingIndex++;
    }
  }

  skipTrainingQuestion() {
    this.stopTrainingSpeech();
    this.currentTrainingAnswer = '';
    this.isGeneratingTrainingAnswer = false;
    if (this.currentTrainingIndex < this.trainingQuestions.length - 1) {
      this.currentTrainingIndex++;
    }
  }

  async generateTrainingAnswer() {
    const q = this.trainingQuestions[this.currentTrainingIndex];
    if (!q || this.isGeneratingTrainingAnswer) return;
    this.isGeneratingTrainingAnswer = true;
    this.currentTrainingAnswer = '';
    try {
      const response = await fetch(`${this.apiUrl}/generate-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          question: q.question,
          resumeText: this.resumeText,
          jobDescription: this.jobDescription,
          history: [],
          resumeAnchors: this.resumeAnchors,
          domainGlossary: this.domainGlossary,
        }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.token) {
                this.currentTrainingAnswer += payload.token;
                this.cdr.detectChanges();
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      this.toaster.error('Failed to generate answer: ' + err.message);
    } finally {
      this.isGeneratingTrainingAnswer = false;
      this.cdr.detectChanges();
    }
  }

  async activateAgent() {
    this.saveCurrentTrainingAnswer();
    this.stopTrainingSpeech();

    const answered = this.agentTrainingAnswers.filter(a => a.answer.trim());
    if (answered.length === 0) {
      this.skipAgentTraining();
      return;
    }

    this.isBuildingAgentBrain = true;
    try {
      const response = await fetch(`${this.apiUrl}/build-agent-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          trainingAnswers: answered,
          resumeAnchors: this.resumeAnchors
        })
      });
      if (!response.ok) throw new Error('Failed to build agent brain');
      const data = await response.json();
      this.agentBrain = data.agentBrain;
      this.agentActivated = true;
      this.cdr.detectChanges();
    } catch (err: any) {
      this.toaster.error('Failed to build Agent Brain: ' + err.message);
    } finally {
      this.isBuildingAgentBrain = false;
      this.cdr.detectChanges();
    }
  }

  skipAgentTraining() {
    this.stopTrainingSpeech();
    this.setupStep = 'pairing';
    this.enableStealthMode();
  }

  proceedAfterAgent() {
    this.setupStep = 'pairing';
    this.enableStealthMode();
  }


  startTrainingSpeech() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.toaster.error('Speech recognition not supported in this browser. Please type your answer.');
      return;
    }
    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'en-US';

    const baseText = this.currentTrainingAnswer;
    let finalText = baseText;

    this.speechRecognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      this.currentTrainingAnswer = finalText + interim;
      this.cdr.detectChanges();
    };

    this.speechRecognition.onerror = () => {
      this.isTrainingSpeaking = false;
      this.cdr.detectChanges();
    };

    this.speechRecognition.onend = () => {
      if (this.isTrainingSpeaking) {
        try { this.speechRecognition?.start(); } catch {}
      }
    };

    this.isTrainingSpeaking = true;
    this.speechRecognition.start();
  }

  stopTrainingSpeech() {
    if (this.speechRecognition) {
      this.isTrainingSpeaking = false;
      try { this.speechRecognition.stop(); } catch {}
      this.speechRecognition = null;
    }
  }

  get trainingProgress(): number {
    return this.trainingQuestions.length ? Math.round(((this.currentTrainingIndex) / this.trainingQuestions.length) * 100) : 0;
  }

  get answeredCount(): number {
    return this.agentTrainingAnswers.filter(a => a.answer.trim()).length;
  }

  async startInterview() {
    if (!this.jobDescription.trim()) {
      this.toaster.warning('Please enter the Role or Job Description first', '', { timeOut: 3000 });
      return;
    }

    this.setupStep = 'interview';
    this.isInterviewActive = true;
    this.startTimer();

    // Extract company names from resume so Deepgram doesn't mishear them as SAP abbreviations
    const companyNames = this.extractCompanyKeywords(this.resumeAnchors);
    const wsUrl = `${this.webSocketUrl}?sessionId=${this.sessionId}` +
      (companyNames ? `&extraKeywords=${encodeURIComponent(companyNames)}` : '');
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      // Start audio after WebSocket is open so chunks aren't lost
      this.startListening();
    };
    this.ws.onmessage = (e) => this.handleServerMessage(JSON.parse(e.data));
    this.ws.onerror = () => this.toaster.error('WebSocket connection failed — check if backend is running', 'Connection Error', { timeOut: 0 });
    this.ws.onclose = () => console.log('WebSocket closed');
  }

  startListening() {
    if (this.isListening) return;
    this.isListening = true;
    this.startRealtimeAudioCapture();
  }

  stopListening() {
    this.isListening = false;
    this.stopRealtimeAudioCapture();
  }

  async setAudioMode(mode: 'meeting' | 'mic') {
    this.audioMode = mode;
    if (this.isListening) {
      this.stopRealtimeAudioCapture();
      await this.startRealtimeAudioCapture();
    }
    const labels = { meeting: 'From Interview (meeting audio)', mic: 'My Device (microphone)' };
    this.toaster.info(labels[mode], 'Audio Source', { timeOut: 2500 });
    this.cdr.detectChanges();
  }

  async startRealtimeAudioCapture() {
    navigator.mediaDevices.removeEventListener('devicechange', this._deviceChangeHandler);
    navigator.mediaDevices.addEventListener('devicechange', this._deviceChangeHandler);

    try {
      const platform = (window as any).electronAPI?.platform;
      const isWindows = platform === 'win32';
      const streams: MediaStream[] = [];

      if (this.audioMode === 'meeting') {
        // ── "From Interview" mode: capture the meeting's audio output ──
        // Goal: hear what the INTERVIEWER says, not the user's own mic

        if (isWindows && (window as any).electronAPI?.getAudioSources) {
          // Windows: use Electron desktopCapturer to grab system loopback audio
          try {
            const sources = await (window as any).electronAPI.getAudioSources();
            const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
            if (screenSource) {
              const ds = await (navigator.mediaDevices as any).getUserMedia({
                audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screenSource.id } },
                video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screenSource.id, maxWidth: 1, maxHeight: 1 } },
              });
              ds.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop());
              const tracks = ds.getAudioTracks();
              if (tracks.length > 0) {
                streams.push(new MediaStream(tracks));
                console.log('[KrackAI] ✅ Windows system audio captured');
              }
            }
          } catch (e) {
            console.warn('[KrackAI] Windows desktopCapturer failed:', e);
          }
        } else {
          // macOS: use getDisplayMedia which captures system audio natively (Sonoma+)
          // User sees one-time "share screen" prompt — but only audio is used, video is immediately stopped
          try {
            const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
              video: true,   // must request video to get audio on macOS
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            });
            // Stop video tracks immediately — we only want audio
            displayStream.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop());
            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length > 0) {
              streams.push(new MediaStream(audioTracks));
              console.log('[KrackAI] ✅ macOS system audio captured via getDisplayMedia');
            } else {
              console.warn('[KrackAI] getDisplayMedia returned no audio tracks — user may not have enabled "Share audio"');
              this.toaster.warning(
                'No audio captured. When sharing screen, tick "Share audio" checkbox.',
                'Audio Tip', { timeOut: 8000 }
              );
            }
          } catch (e: any) {
            console.warn('[KrackAI] getDisplayMedia failed:', e.message);
            // User explicitly cancelled the share dialog — do NOT silently start the mic
            if (e?.name === 'NotAllowedError') {
              this.toaster.error(
                'Screen audio sharing was cancelled. No audio is being captured. Click START again and choose "Share audio", or switch to "My Device" mode.',
                'Capture Cancelled', { timeOut: 8000 }
              );
              return; // abort — respect the user's cancellation, don't fall back to mic
            }
          }
        }

        // If system audio failed (not a user cancellation), fall back to mic — be explicit
        if (streams.length === 0) {
          this.toaster.warning(
            'Meeting audio unavailable — your MICROPHONE is now active instead. Switch to "My Device" mode if this is intended.',
            'Microphone Active', { timeOut: 7000 }
          );
        }
      }

      // ── "My Device" mic mode — also used as fallback ──
      if (this.audioMode === 'mic' || streams.length === 0) {
        try {
          if ((window as any).electronAPI?.requestAudioPermission) {
            await (window as any).electronAPI.requestAudioPermission();
          }
          const mic = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
          streams.push(mic);
          console.log('[KrackAI] ✅ Microphone captured');
        } catch (micErr) {
          console.warn('[KrackAI] Mic unavailable:', micErr);
        }
      }

      if (streams.length === 0) {
        throw new Error('No audio source available. Please grant microphone or screen recording permission.');
      }

      // ── Wire up AudioContext + ScriptProcessor ──
      // Connect every stream source directly to the same processor — WebAudio mixes them.
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // 2048 samples @ 24kHz = ~85ms chunks — half the latency of 4096 (170ms)
      // for snappier interim transcription, without flooding the WebSocket.
      this.processorNode = this.audioContext.createScriptProcessor(2048, 1, 1);
      this.extraStreams = streams;
      this.stream = streams[0]; // kept for legacy reference / devicechange restart

      for (const s of streams) {
        this.audioContext.createMediaStreamSource(s).connect(this.processorNode);
      }
      this.processorNode.connect(this.audioContext.destination);

      this.processorNode.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // Build base64 in chunks — spreading 8192 bytes into String.fromCharCode
        // can overflow the call stack on some engines. Process 8KB at a time.
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as any);
        }
        const base64 = btoa(binary);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'audio-chunk', audio: base64 }));
        }
      };

    } catch (error: any) {
      this.isListening = false;
      this.toaster.error(
        `Audio error: ${error.message}. Check microphone permission in System Settings → Privacy → Microphone.`,
        'Audio Error', { timeOut: 0 }
      );
      this.cdr.detectChanges();
    }
  }

  private stopRealtimeAudioCapture() {
    navigator.mediaDevices.removeEventListener('devicechange', this._deviceChangeHandler);
    this.processorNode?.disconnect();
    // Closing AudioContext disconnects all source nodes automatically
    this.audioContext?.close();
    // Stop all captured tracks
    this.extraStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));

    this.processorNode = null;
    this.sourceNode = null;
    this.audioContext = null;
    this.stream = null;
    this.extraStreams = [];
  }

  finalTranscription = '';
  interimTranscription = '';
  get currentTranscription() {
    return this.finalTranscription + this.interimTranscription;
  }

  set currentTranscription(val: string) {
    if (val === '') {
      this.finalTranscription = '';
      this.interimTranscription = '';
    }
  }

  handleServerMessage(data: any) {
    switch (data.type) {
      case 'transcription-delta':
        this.interimTranscription = data.text;
        this.cdr.detectChanges();
        break;
      case 'transcription':
        this.finalTranscription += data.text;
        this.interimTranscription = '';
        this.cdr.detectChanges();
        break;
      case 'auto-question':
        if (this.isAutoMode && !this.isGeneratingAnswer) {
          this.answerWithAI(data.text);
        }
        break;
      case 'error':
        alert(`Transcription error: ${data.message}`);
        break;
    }
  }

  async answerWithAI(questionOverride?: string) {
    const transcription = (questionOverride || this.currentTranscription).trim();
    if (!transcription) {
      this.toaster.warning('No question detected yet — speak or wait for transcription', '', { timeOut: 3000 });
      return;
    }
    if (this.isGeneratingAnswer) return;

    // Validate resume is loaded before hitting API
    if (!this.resumeText?.trim()) {
      this.toaster.error('Resume not loaded. Please restart the session and upload your resume.', 'Missing Resume', { timeOut: 5000 });
      return;
    }

    this.isGeneratingAnswer = true;
    // Keep listening during generation — interviewer may ask next question immediately
    // Clear transcription now so new question can accumulate cleanly
    this.currentTranscription = '';

    try {
      const response = await fetch(`${this.apiUrl}/generate-answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          question: transcription,
          resumeText: this.resumeText,
          jobDescription: this.jobDescription,
          history: this.questions.slice(0, 4),
          resumeAnchors: this.resumeAnchors,
          domainGlossary: this.domainGlossary,
          agentBrain: this.agentBrain || undefined,
          prepContext: this.prepContext || undefined,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Server error ${response.status}`;
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      this.addQuestion(transcription, '');
      const targetQuestion = this.questions[0];

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let broadcastTokenCount = 0;

      if (reader) {
        let isDone = false;
        let buffer = '';
        try { while (!isDone) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') {
              if (trimmed === 'data: [DONE]') isDone = true;
              continue;
            }
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const payload = JSON.parse(trimmed.slice(6));
              if (payload.status === 'thinking') {
                this.isThinkingFirstToken = true;
                this.cdr.detectChanges();
              }
              if (payload.token) {
                this.isThinkingFirstToken = false;
                targetQuestion.answer += payload.token;
                broadcastTokenCount++;
                this.cdr.detectChanges();
                // Broadcast every 10 tokens to keep mobile in sync without flooding
                if (broadcastTokenCount % 10 === 0) {
                  if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'broadcast-answer', question: targetQuestion.question, answer: targetQuestion.answer }));
                  }
                  (window as any).electronAPI?.stealthBroadcast?.({ sessionId: this.sessionId, question: targetQuestion.question, answer: targetQuestion.answer });
                }
              }
            } catch {}
          }
        } } finally { reader.cancel().catch(() => {}); }
      }

      // Final broadcast — always send the complete answer
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'broadcast-answer', question: targetQuestion.question, answer: targetQuestion.answer }));
      }
      (window as any).electronAPI?.stealthBroadcast?.({ sessionId: this.sessionId, question: targetQuestion.question, answer: targetQuestion.answer });

    } catch (error: any) {
      this.toaster.error(error.message || 'Failed to generate answer', 'Answer Error', { timeOut: 6000 });
    } finally {
      this.isGeneratingAnswer = false;
      this.isThinkingFirstToken = false;
      this.cdr.detectChanges();
    }
  }

  addQuestion(question: string, answer: string) {
    this.questions.unshift({
      questionNumber: this.questions.length + 1,
      question: question.trim(),
      answer: answer.trim(),
    });
  }

  startTimer() {
    this.elapsedTime = 0;
    this.lowCreditsWarned = false;
    this.timerSubscription = interval(1000).subscribe(() => {
      this.elapsedTime++;

      // Credit countdown enforcement — admins and zero-credit states are exempt
      if (!this.isAdmin && this.remainingMinutes > 0) {
        const creditLimitSeconds = this.remainingMinutes * 60;

        // 5-minute warning — shown once
        if (!this.lowCreditsWarned && this.elapsedTime >= creditLimitSeconds - 300) {
          this.lowCreditsWarned = true;
          this.toaster.warning(
            '5 minutes of interview credits remaining.',
            'Low Credits',
            { timeOut: 8000 }
          );
        }

        // Credits exhausted — force end
        if (this.elapsedTime >= creditLimitSeconds) {
          this.forceEndInterview('Interview credits exhausted. Session saved.', true);
        }
      }
    });
  }

  stopTimer() {
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = undefined;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  private startHeartBeat() {
    // Legacy removed
  }

  private stopHeartbeat() {
    // Legacy removed
  }

  async endInterview() {
    this.wasExplicitlyCompleted = true;
    await this.cleanupAndSave();
    this.router.navigate(['/dashboard']);
  }

  private async forceEndInterview(reason: string, completed: boolean = false) {
    this.wasExplicitlyCompleted = completed;
    this.toaster.warning(reason);
    await this.cleanupAndSave();
    this.router.navigate(['/dashboard']);
  }

  private async cleanupAndSave() {
    this.cleanupBeforeExit();
    await this.saveInterview();
    this.fullCleanup();
  }

  private deductPartialTime() {
    if (this.elapsedTime > 0) {
      // Deduct total minutes used (ceiling — partial minutes count as a full minute)
      const minutesUsed = Math.ceil(this.elapsedTime / 60);
      this.http
        .post(`${this.apiUrl}/deduct-partial`, { minutesUsed })
        .subscribe();
    }
  }

  private cleanupBeforeExit() {
    this.isListening = false;
    this.isInterviewActive = false;
    this.stopTimer();
    this.stopRealtimeAudioCapture();
    this.ws?.close();
    this.stopHeartbeat();
    this.deductPartialTime();
  }

  private fullCleanup() {
    this.ws = null;
    this.questions = [];
    this.currentTranscription = '';
    this.jobDescription = '';
    this.elapsedTime = 0;
    this.resumeUploaded = false;
    this.resumeText = '';
    this.wasExplicitlyCompleted = false;
    this.captures = [];
    this.aiResponse = '';
    this.showPicker = false;
    this.isCapturing = false;
    this.agentBrain = '';
    this.prepContext = '';
    this.isPrepLoading = false;
    this.agentActivated = false;
    this.trainingQuestions = [];
    this.agentTrainingAnswers = [];
    this.currentTrainingIndex = 0;
    this.currentTrainingAnswer = '';
  }

  createInterview() {
    this.saveInterview().catch(() => {});
  }

  private saveInterview(): Promise<void> {
    if (this.questions.length === 0) return Promise.resolve();

    const status = this.wasExplicitlyCompleted ? 'completed' : 'incomplete';
    const interviewInfo: IInterview = {
      date: new Date().toISOString(),
      timeTaken: this.elapsedTime,
      status: status,
      questions: this.questions
        .map((q) => ({
          questionNumber: q.questionNumber,
          question: q.question,
          answer: q.answer,
        }))
        .reverse(),
    };

    return new Promise((resolve) => {
      this.interviewService.createInterview(interviewInfo).subscribe({
        next: (res) => {
          if (res?.message) this.toaster.success('Session saved');
          resolve();
        },
        error: (err) => {
          this.toaster.error(err.message || 'Failed to save interview');
          resolve(); // still resolve so navigation proceeds
        },
      });
    });
  }

  // === SCREEN CAPTURE LOGIC ===

  async captureScreen() {
    if (!this.isInterviewActive) {
      this.toaster.warning('Start an interview first to capture screen');
      return;
    }

    if (this.isCapturing) return;

    this.isCapturing = true;
    this.showPicker = false;
    this.captureSources = [];

    try {
      if ((window as any).electronAPI?.getAudioSources) {
        // Check screen recording permission (macOS) — separate from mic permission
        if ((window as any).electronAPI?.requestScreenPermission) {
          const screenPerm = await (window as any).electronAPI.requestScreenPermission();
          if (!screenPerm?.ok) {
            this.toaster.error(
              screenPerm?.message || 'Screen Recording permission required. Enable KrackAI in System Settings → Privacy → Screen Recording, then restart.',
              'Permission Required', { timeOut: 0 }
            );
            this.isCapturing = false;
            return;
          }
        }

        const sources = await (window as any).electronAPI.getAudioSources();
        if (sources.length === 0) {
          throw new Error('No windows or screens available');
        }

        this.captureSources = sources;
        this.showPicker = true;
      } else {
        // Browser fallback
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        await new Promise((resolve) => setTimeout(resolve, 400));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const preview = canvas.toDataURL('image/png');
          const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), 'image/png')
          );
          this.captures.push({ preview, blob });
          this.toaster.success('Screen captured successfully');
        }

        stream.getTracks().forEach((track) => track.stop());
        video.remove();
        this.isCapturing = false;
      }
    } catch (error: any) {
      this.toaster.error(`Capture failed: ${error.message || error}`);
      this.isCapturing = false;
    }
  }

  async onSourceSelected(source: any) {
    this.showPicker = false;

    try {
      const constraints = {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
          },
        },
      };

      const stream: MediaStream = await (navigator.mediaDevices as any).getUserMedia(constraints);

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      await new Promise((resolve) => setTimeout(resolve, 400));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const preview = canvas.toDataURL('image/png');
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );

      this.captures.push({ preview, blob });
      this.toaster.success(`Captured: ${source.name}`);

      stream.getTracks().forEach((track) => track.stop());
      video.remove();
    } catch (error: any) {
      this.toaster.error(`Failed to capture: ${error.message || error}`);
    } finally {
      this.isCapturing = false;
    }
  }

  cancelCapture() {
    this.showPicker = false;
    this.isCapturing = false;
    this.captureSources = [];
  }

  clearCaptures() {
    this.captures = [];
    this.aiResponse = '';
    this.toaster.info('Captures cleared');
  }

  async sendCaptures() {
    if (this.isSending || this.captures.length === 0) return;
    this.isSending = true;
    this.aiResponse = '';

    try {
      const formData = new FormData();
      this.captures.forEach((cap, index) => {
        formData.append(`image${index}`, cap.blob, `capture${index}.png`);
      });

      const response = await fetch(`${this.apiUrl}/process-captures`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to process captures');
      }

      const data = await response.json();
      const result = data.result?.trim() || 'No analysis returned.';

      let questionTitle = this.defaultCaptureTitle;
      const questionMatch = result.match(/\*\*Question:\*\*\s*([^\n]+)/i);
      if (questionMatch) {
        questionTitle = questionMatch[1].trim();
      }
      this.addQuestion(questionTitle, result);

      this.aiResponse = result;
      this.toaster.success('Code analysis added to interview history');
      this.clearCaptures();
    } catch (error: any) {
      this.toaster.error(`Error: ${error.message}`);
    } finally {
      this.isSending = false;
    }
  }

  copyToClipboard(text: string) {
    // Strip <think> blocks and markdown before copying
    let plain = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    plain = plain.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim();
    navigator.clipboard.writeText(plain).then(() => {
      this.toaster.success('Copied to clipboard', '', { timeOut: 2000 });
    }).catch(() => {
      this.toaster.warning('Copy failed — try selecting and copying manually', '', { timeOut: 3000 });
    });
  }

  copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.toaster.success('Code copied to clipboard', '', { timeOut: 2000 });
    }).catch(() => {
      this.toaster.warning('Copy failed', '', { timeOut: 2000 });
    });
  }

  // Extract and prepare code blocks for Prism highlighting
  extractCodeBlocks(answer: string): { lang: string; code: string; highlighted: string }[] {
    const blocks: { lang: string; code: string; highlighted: string }[] = [];
    const regex = /\`\`\`(\w+)?\s*([\s\S]*?)\`\`\`/g;
    let match;

    while ((match = regex.exec(answer)) !== null) {
      let lang = (match[1] || 'javascript').toLowerCase();
      const code = match[2].trim();

      // Map common aliases
      if (lang === 'js') lang = 'javascript';
      if (lang === 'ts') lang = 'typescript';
      if (lang === 'py') lang = 'python';

      // Escape HTML entities to prevent breaking
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      blocks.push({ lang, code, highlighted: escapedCode });
    }

    return blocks;
  }

  renderText(answer: string): string {
    let text = answer.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>');
    text = text.trim();
    return text || '<span class="text-gray-500 italic">No explanation provided.</span>';
  }

  /**
   * Pulls company names + candidate name from resumeAnchors YAML so they can be
   * sent to Deepgram as proper-noun keywords, preventing misheard abbreviations.
   * e.g. "HP Hood LLC" should never become "HU Hood ALE" again.
   */
  extractCompanyKeywords(anchors: string): string {
    if (!anchors) return '';
    const keywords = new Set<string>();

    // Match: company: "HP Hood LLC" or company: HP Hood LLC
    const companyMatches = anchors.matchAll(/company:\s*["']?([^"'\n\r]+)["']?/gi);
    for (const m of companyMatches) {
      const name = m[1].trim();
      if (name && name !== '{Company Name}') {
        // Add full name and each significant word (3+ chars)
        keywords.add(name);
        name.split(/\s+/).forEach(w => { if (w.length >= 3) keywords.add(w); });
      }
    }

    // Match: name: "John Smith"
    const nameMatch = anchors.match(/name:\s*["']?([^"'\n\r]+)["']?/i);
    if (nameMatch) {
      nameMatch[1].trim().split(/\s+/).forEach(w => { if (w.length >= 3) keywords.add(w); });
    }

    return [...keywords].slice(0, 20).join(','); // Deepgram caps keywords
  }

  backToDashboard() {
    if (!this.isInterviewActive) {
      this.router.navigate(['dashboard']);
      return;
    }

    if (confirm('Are you sure you want to leave? Your progress will be saved as incomplete.')) {
      this.wasExplicitlyCompleted = false;
      this.cleanupAndSave().then(() => this.router.navigate(['dashboard']));
    }
  }

  ngOnDestroy() {
    if (this.isInterviewActive) {
      this.wasExplicitlyCompleted = false;
      this.cleanupAndSave();
    }
    this.stopTimer();
    // Stop speech recognition if still running (prevent mic being held open)
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch {}
      this.speechRecognition = null;
    }
    // Clear stealth countdown interval
    if (this.stealthInterval) {
      clearInterval(this.stealthInterval);
      this.stealthInterval = null;
    }
    // Remove devicechange listener
    navigator.mediaDevices?.removeEventListener('devicechange', this._deviceChangeHandler);
  }

  clearTranscription() {
    this.currentTranscription = '';
  }

  getUserTier() {
    this.authService.getUser().subscribe({
      next: (res) => {
        if (res.user) {
          this.userTier = res.user.tier || 'Free';
          this.remainingMinutes = res.user.remainingMinutes || 0;
          this.isAdmin = res.user.role === 'admin';
        }
      },
      error: (err) => this.toaster.error(err.message),
    });
  }

}
