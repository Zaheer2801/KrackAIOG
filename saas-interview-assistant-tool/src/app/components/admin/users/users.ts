import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth/auth';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

interface PasscodeUser {
  _id: string;
  passcode: string;
  fraudFlag?: boolean;
  label?: string;
  tier?: string;
  remainingMinutes?: number;
  expiresAt?: string | null;
  createdAt: Date;
}

interface AccessRequest {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  duration: string;
  status: string;
  createdAt: Date;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './users.html',
  styleUrl: './users.css',
  providers: [DatePipe],
})
export class UsersComponent implements OnInit {
  passcodes: PasscodeUser[] = [];
  accessRequests: AccessRequest[] = [];
  newPasscode: string = '';
  newLabel: string = '';
  newTier: string = 'free';
  newMinutes: number | null = null;
  newExpiresAt: string = '';
  activeTab: 'passcodes' | 'requests' = 'passcodes';

  today = new Date();

  // Interview history panel
  viewingUser: PasscodeUser | null = null;
  userInterviews: any[] = [];
  expandedInterviewId: string | null = null;
  loadingInterviews = false;

  // Inline edit state
  editingId: string | null = null;
  editLabel: string = '';
  editTier: string = 'free';
  editMinutes: number | null = null;
  editExpiresAt: string = '';

  constructor(public auth: Auth, public toaster: ToastrService, public router: Router, private datePipe: DatePipe) {}

  ngOnInit(): void {
    this.fetchPasscodes();
    this.fetchRequests();
  }

  fetchRequests() {
    this.auth.getAccessRequests().subscribe({
      next: (res) => {
        this.accessRequests = res.requests;
      },
      error: () => this.toaster.error('Failed to load access requests')
    });
  }

  fetchPasscodes() {
    this.auth.getPasscodes().subscribe({
      next: (res) => {
        this.passcodes = res.passcodes;
      },
      error: (err) => {
        this.toaster.error('Failed to load passcodes');
      }
    });
  }

  generatePasscode() {
    if (!this.newPasscode.trim()) {
      this.toaster.warning('Please enter a passcode string to create.');
      return;
    }
    
    this.auth.createPasscode(this.newPasscode, {
      label: this.newLabel || undefined,
      tier: this.newTier || 'free',
      remainingMinutes: this.newMinutes != null ? this.newMinutes : undefined,
      expiresAt: this.newExpiresAt || null,
    }).subscribe({
      next: () => {
        this.toaster.success('Passcode created');
        this.newPasscode = '';
        this.newLabel = '';
        this.newTier = 'free';
        this.newMinutes = null;
        this.newExpiresAt = '';
        this.fetchPasscodes();
      },
      error: (err) => this.toaster.error(err.error?.message || 'Failed to create')
    });
  }

  generateRandom() {
    this.newPasscode = 'TEAM-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  deletePasscode(id: string) {
    if (confirm('Are you sure you want to delete this access code? User history will be wiped out.')) {
      this.auth.deletePasscode(id).subscribe({
        next: () => {
          this.toaster.success('Passcode deleted');
          this.fetchPasscodes();
        },
        error: () => this.toaster.error('Failed to delete')
      });
    }
  }

  isExpired(expiresAt: string | null | undefined): boolean {
    if (!expiresAt) return false;
    return new Date(expiresAt) < this.today;
  }

  startEdit(p: PasscodeUser) {
    this.editingId = p._id;
    this.editLabel = p.label || '';
    this.editTier = p.tier || 'free';
    this.editMinutes = p.remainingMinutes ?? null;
    this.editExpiresAt = p.expiresAt ? p.expiresAt.substring(0, 10) : '';
  }

  cancelEdit() {
    this.editingId = null;
  }

  saveEdit(id: string) {
    this.auth.updatePasscode(id, {
      label: this.editLabel,
      tier: this.editTier,
      remainingMinutes: this.editMinutes ?? 0,
      expiresAt: this.editExpiresAt || null,
    }).subscribe({
      next: () => {
        this.toaster.success('Updated successfully');
        this.editingId = null;
        this.fetchPasscodes();
      },
      error: (err) => this.toaster.error(err.error?.message || 'Failed to update')
    });
  }

  copyLink(passcode: string) {
    const url = `${window.location.origin}/login?code=${passcode}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toaster.success('Share Magic Link copied to clipboard!');
    });
  }

  viewHistory(p: PasscodeUser) {
    if (this.viewingUser?._id === p._id) {
      this.viewingUser = null;
      this.userInterviews = [];
      return;
    }
    this.viewingUser = p;
    this.loadingInterviews = true;
    this.userInterviews = [];
    this.expandedInterviewId = null;
    this.auth.getAdminUserInterviews(p._id).subscribe({
      next: (res) => { this.userInterviews = res.interviews; this.loadingInterviews = false; },
      error: () => { this.toaster.error('Failed to load interviews'); this.loadingInterviews = false; }
    });
  }

  toggleAdminInterview(id: string) {
    this.expandedInterviewId = this.expandedInterviewId === id ? null : id;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  downloadInterviewPDF(interview: any) {
    const date = this.datePipe.transform(interview.date, 'mediumDate') || interview.date;
    const duration = this.formatTime(interview.timeTaken);
    const rows = (interview.questions || []).map((q: any) => `
      <div class="question-block">
        <div class="q-label">Q${q.questionNumber}</div>
        <div class="q-text">${(q.question||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        <div class="a-text">${(q.answer||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
      </div>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KrackAI — ${date}</title>
<style>body{font-family:-apple-system,sans-serif;color:#1d1d1f;padding:40px;max-width:860px;margin:0 auto}
.header{border-bottom:2px solid #0071e3;padding-bottom:20px;margin-bottom:32px}
.header h1{font-size:26px;font-weight:700;color:#0071e3}.header .meta{font-size:13px;color:#6b7280;margin-top:6px}
.question-block{margin-bottom:32px;padding-bottom:28px;border-bottom:1px solid #e5e7eb}
.q-label{font-size:11px;font-weight:700;color:#0071e3;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.q-text{font-size:16px;font-weight:700;color:#1d1d1f;margin-bottom:12px;line-height:1.5}
.a-text{font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
@media print{body{padding:20px}}</style></head><body>
<div class="header"><h1>KrackAI Interview — ${this.viewingUser?.label || this.viewingUser?.passcode}</h1>
<div class="meta">${date} · Duration: ${duration} · Status: ${interview.status} · ${(interview.questions||[]).length} question(s)</div></div>
${rows}<div class="footer">Generated by KrackAI · Confidential</div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) { win.onload = () => { win.print(); URL.revokeObjectURL(url); }; }
  }

  downloadInterviewDOC(interview: any) {
    const date = this.datePipe.transform(interview.date, 'mediumDate') || interview.date;
    const rows = (interview.questions || []).map((q: any) =>
      `Q${q.questionNumber}: ${q.question}\n\n${q.answer}\n\n-----------------------------------------------------------\n`).join('\n');
    const content = `KrackAI Interview — ${this.viewingUser?.label || this.viewingUser?.passcode}\nDate: ${date}  |  Duration: ${this.formatTime(interview.timeTaken)}  |  Status: ${interview.status}\n===========================================================\n\n${rows}\nGenerated by KrackAI — Confidential`;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `KrackAI-${this.viewingUser?.passcode}-${date}.doc`; a.click();
    URL.revokeObjectURL(url);
  }

  logout() {
    this.auth.logout();
  }

  approveRequest(id: string) {
    this.auth.approveAccessRequest(id).subscribe({
      next: (res) => {
        this.toaster.success('Request approved, passcode generated!');
        const req = this.accessRequests.find(r => r._id === id);
        if (req) req.status = 'approved';
        this.fetchPasscodes(); // Refresh passcodes list
      },
      error: (err) => this.toaster.error(err.error?.message || 'Failed to approve request')
    });
  }

  rejectRequest(id: string) {
    if (!confirm('Are you sure you want to reject this request?')) return;
    this.auth.rejectAccessRequest(id).subscribe({
      next: () => {
        this.toaster.success('Request rejected');
        const req = this.accessRequests.find(r => r._id === id);
        if (req) req.status = 'rejected';
      },
      error: () => this.toaster.error('Failed to reject request')
    });
  }
}
