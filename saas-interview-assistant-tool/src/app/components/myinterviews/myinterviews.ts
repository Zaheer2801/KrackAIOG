import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastrService } from 'ngx-toastr';
import { RouterLink } from '@angular/router';

interface Question {
  questionNumber: number;
  question: string;
  answer: string;
}

interface InterviewSummary {
  _id: string;
  date: string;
  timeTaken: number;
  status: 'completed' | 'incomplete';
}

interface InterviewDetail extends InterviewSummary {
  questions: Question[];
}

interface PaginatedResponse {
  interviews: InterviewSummary[];
  pagination: {
    page: number;
    limit: number | null;
    total: number;
    totalPages: number;
  };
}

@Component({
  selector: 'app-past-interviews',
  templateUrl: './myinterviews.html',
  styleUrls: ['./myinterviews.css'],
  standalone: true,
  imports: [CommonModule, DatePipe,RouterLink],
  providers: [DatePipe],
})
export class Myinterviews implements OnInit {
  interviews: InterviewSummary[] = [];
  expandedInterview: InterviewDetail | null = null;
  loading = false;
  currentPage = 1;
  totalPages = 1;
  totalInterviews = 0;
  limit = 10;

  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient, private toastr: ToastrService) {}

  ngOnInit() {
    this.loadInterviews(this.currentPage);
  }

  loadInterviews(page: number) {
    this.loading = true;
    this.currentPage = page;
    this.expandedInterview = null;

    this.http.get<PaginatedResponse>(`${this.apiUrl}/interviews?page=${page}&limit=${this.limit}`).subscribe({
      next: (res) => {
        this.interviews = res.interviews;
        this.totalInterviews = res.pagination.total;
        this.totalPages = res.pagination.totalPages;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load interviews');
        this.loading = false;
      },
    });
  }

  toggleInterview(interviewId: string) {
    if (this.expandedInterview?._id === interviewId) {
      this.expandedInterview = null;
      return;
    }

    this.http.get<{ interview: InterviewDetail }>(`${this.apiUrl}/interview/${interviewId}`).subscribe({
      next: (res) => {
        this.expandedInterview = res.interview;
      },
      error: () => {
        this.toastr.error('Failed to load interview details');
      },
    });
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.loadInterviews(page);
    }
  }

  downloadPDF(interview: InterviewDetail) {
    const date = new DatePipe('en-US').transform(interview.date, 'mediumDate') || interview.date;
    const duration = this.formatTime(interview.timeTaken);

    const rows = interview.questions.map((q, i) => `
      <div class="question-block">
        <div class="q-label">Q${q.questionNumber}</div>
        <div class="q-text">${this.escapeHtml(q.question)}</div>
        <div class="a-text">${this.escapeHtml(q.answer)}</div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KrackAI Interview — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; background: #fff; padding: 40px; max-width: 860px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0071e3; padding-bottom: 20px; margin-bottom: 32px; }
    .header h1 { font-size: 26px; font-weight: 700; color: #0071e3; letter-spacing: -0.5px; }
    .header .meta { font-size: 13px; color: #6b7280; margin-top: 6px; }
    .question-block { margin-bottom: 32px; padding-bottom: 28px; border-bottom: 1px solid #e5e7eb; }
    .question-block:last-child { border-bottom: none; }
    .q-label { font-size: 11px; font-weight: 700; color: #0071e3; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
    .q-text { font-size: 16px; font-weight: 700; color: #1d1d1f; margin-bottom: 12px; line-height: 1.5; }
    .a-text { font-size: 14px; color: #374151; line-height: 1.8; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>KrackAI Interview Session</h1>
    <div class="meta">${date} &nbsp;·&nbsp; Duration: ${duration} &nbsp;·&nbsp; Status: ${interview.status} &nbsp;·&nbsp; ${interview.questions.length} question(s)</div>
  </div>
  ${rows}
  <div class="footer">Generated by KrackAI &nbsp;·&nbsp; Confidential</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.onload = () => {
        win.print();
        URL.revokeObjectURL(url);
      };
    }
  }

  downloadDOC(interview: InterviewDetail) {
    const date = new DatePipe('en-US').transform(interview.date, 'mediumDate') || interview.date;
    const duration = this.formatTime(interview.timeTaken);

    const rows = interview.questions.map((q) => `
Q${q.questionNumber}: ${q.question}

${q.answer}

-----------------------------------------------------------
`).join('\n');

    const content = `KrackAI Interview Session
Date: ${date}  |  Duration: ${duration}  |  Status: ${interview.status}  |  Questions: ${interview.questions.length}
===========================================================

${rows}
Generated by KrackAI — Confidential`;

    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KrackAI-Interview-${date}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
