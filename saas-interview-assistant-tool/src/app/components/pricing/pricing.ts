import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { Back } from '../shared/back/back';

interface PricingPlan {
  priceId: string;
  label: string;
  minutes: number;
  price: string;
  features: string[];
  recommended: boolean;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, Back],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css',
})
export class Pricing implements OnInit {
  isLoading: { [key: string]: boolean } = {};

  plans: PricingPlan[] = [
    {
      priceId: 'price_1SjFBJFZ79d2YXeIwfCf9zb5',
      label: 'Starter',
      minutes: 60,
      price: '',
      features: ['60 minutes of AI coaching', 'Real-time transcription', 'Resume-grounded answers', 'Stealth mobile mode'],
      recommended: false,
    },
    {
      priceId: 'price_1SjFCMFZ79d2YXeIbHoPAvU5',
      label: 'Pro',
      minutes: 120,
      price: '',
      features: ['120 minutes of AI coaching', 'Real-time transcription', 'Resume-grounded answers', 'Stealth mobile mode', 'Screen capture analysis'],
      recommended: true,
    },
    {
      priceId: 'price_1SjFCwFZ79d2YXeIQKvjLo3d',
      label: 'Elite',
      minutes: 180,
      price: '',
      features: ['180 minutes of AI coaching', 'Real-time transcription', 'Resume-grounded answers', 'Stealth mobile mode', 'Screen capture analysis', 'Priority support'],
      recommended: false,
    },
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
    private toaster: ToastrService
  ) {}

  ngOnInit(): void {}

  purchase(plan: PricingPlan) {
    if (this.isLoading[plan.priceId]) return;
    this.isLoading[plan.priceId] = true;

    this.http
      .post<{ url: string }>(`${environment.apiUrl}/create-checkout-session`, {
        priceId: plan.priceId,
      })
      .subscribe({
        next: (res) => {
          this.isLoading[plan.priceId] = false;
          if (!res.url) {
            this.toaster.error('Could not create checkout session.');
            return;
          }
          // Electron: open in system browser via IPC
          if ((window as any).electronAPI?.openExternal) {
            (window as any).electronAPI.openExternal(res.url);
          } else {
            // Web fallback
            window.location.href = res.url;
          }
        },
        error: (err) => {
          this.isLoading[plan.priceId] = false;
          const msg = err?.error?.error || err?.message || 'Checkout failed.';
          this.toaster.error(msg);
        },
      });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
