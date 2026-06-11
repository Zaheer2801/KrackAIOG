import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Auth } from '../../services/auth/auth';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  mode: 'login' | 'request' = 'login';
  loginForm!: FormGroup;
  requestForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: Auth,
    private toaster: ToastrService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      passcode: ['', [Validators.required]],
    });

    this.requestForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required]],
      duration: ['30', [Validators.required]],
    });

    this.route.queryParams.subscribe(params => {
      if (params['code']) {
        this.loginForm.patchValue({ passcode: params['code'] });
        setTimeout(() => this.onSubmit(), 500);
      }
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          if (response) {
            localStorage.setItem('token', response.token);
            if (response.user.role === 'admin') {
              this.router.navigate(['admin']).then(() => {
                this.toaster.info("Admin Access Granted");
              });
            } else {
              this.router.navigate(['dashboard']).then(() => {
                this.toaster.info("Access Granted");
              });
            }
          }
        },
        error: (error) => {
          this.toaster.error(error.error?.message || error.message || "Invalid Passcode");
        },
      });
    } else {
      Object.keys(this.loginForm.controls).forEach((key) => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  onRequestSubmit() {
    if (this.requestForm.valid) {
      this.authService.createAccessRequest(this.requestForm.value).subscribe({
        next: () => {
          this.toaster.success("Request submitted successfully!");
          this.mode = 'login';
          this.requestForm.reset({ duration: '30' });
        },
        error: (error) => {
          this.toaster.error(error.error?.message || "Failed to submit request.");
        }
      });
    } else {
      Object.keys(this.requestForm.controls).forEach((key) => {
        this.requestForm.get(key)?.markAsTouched();
      });
    }
  }
}
