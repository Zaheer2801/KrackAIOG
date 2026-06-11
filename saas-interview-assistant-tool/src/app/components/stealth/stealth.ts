import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stealth',
  templateUrl: './stealth.html',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    /* Pitch black background */
    :host {
      display: block;
      min-height: 100vh;
      background-color: #000; 
      color: #e5e5e5;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    /* Remove default scrolling, handle internally */
    .stealth-container {
      height: 100vh;
      width: 100vw;
      padding: 1.5rem;
      overflow-y: auto;
      box-sizing: border-box;
      font-size: 1.25rem;
      line-height: 1.6;
    }
  `]
})
export class StealthComponent implements OnInit, OnDestroy {
  sessionId!: string;
  ws: WebSocket | null = null;
  transcription: string = '';
  answers: { q: string; a: string }[] = [];
  isConnected = false;

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.sessionId = params.get('sessionId') || '';
      if (this.sessionId) {
        this.connectWS();
      }
    });

    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').catch((err: any) => console.log('Wake Lock error:', err));
    }
  }

  ngOnDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  }

  connectWS() {
    const wsUrl = `${environment.websockerUrl}?sessionId=${this.sessionId}&stealth=true`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.cdr.detectChanges();
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.cdr.detectChanges();
      setTimeout(() => this.connectWS(), 3000);
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'broadcast-answer') {
          this.answers = [{
            q: data.question || '',
            a: this.stripHtml(data.answer) || ''
          }, ...this.answers];
          this.cdr.detectChanges();
        }
      } catch (err) {}
    };
  }

  stripHtml(html: string) {
    try {
      let tmp = document.createElement('DIV');
      let processed = (html || '').replace(/\*\*(.*?)\*\*/g, '$1');
      processed = processed.replace(/- /g, '\n• ');
      processed = processed.replace(/```[\s\S]*?```/g, '\n[Code Block Removed for Stealth]\n');
      tmp.innerHTML = processed;
      return tmp.textContent || tmp.innerText || '';
    } catch {
      return html || '';
    }
  }
}
