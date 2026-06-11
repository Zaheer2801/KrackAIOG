import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Auth, IUser } from '../../services/auth/auth';
import { IInterview, InterviewService } from '../../services/interview/interview';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  passcode!: string;
  abbrev!: string;
  recentSessions: IInterview[] = [];
  monthlySessionsCount!: number;
  user!: IUser;

  constructor(
    private router: Router,
    private authService: Auth,
    private interviewService: InterviewService,
    private toaster: ToastrService
  ) {}

  ngOnInit(): void {
    this.getUser();
    this.getInterviews();
  }

  onLogout() {
    this.authService.logout();
  }

  getUser() {
    const userInfo = this.authService.getUserInfo();
    if (userInfo) {
      this.passcode = userInfo.passcode;
      this.abbrev = userInfo.passcode.substring(0, 2).toUpperCase();
      this.user = userInfo;
    }
  }

  startInterview() {
    this.router.navigate(['interview']);
  }

  getInterviews() {
    const limit = 5;
    const page = 1;
    this.interviewService.fetchInterviews(limit, page).subscribe({
      next: (response) => {
        if (response) {
          this.recentSessions = response.interviews;
          this.monthlySessionsCount = response.monthlyCount;
        }
      },
      error: (error) => {
        this.toaster.error(error.message);
      },
    });
  }

  formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const hrsStr = hrs.toString().padStart(2, '0');
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');

    return `${hrsStr}:${minsStr}:${secsStr}`;
  }
}
