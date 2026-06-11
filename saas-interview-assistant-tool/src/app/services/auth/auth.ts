import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Observable, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';

export interface IUser {
  passcode: string;
  role: 'user' | 'admin';
  deviceFingerprint?: string;
  fraudFlag?: boolean;
  tier?: string;
  remainingMinutes?: number;
}

export interface Ilogin {
  passcode: string;
  client_fp?: string;
}

export interface IJwtPayload {
  exp: number;
  passcode: string;
  role: 'user' | 'admin';
}

export interface IUserLoginResponse {
  message: string;
  user: IUser;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  apiUrl = environment.apiUrl;

  login(loginInfo: Ilogin): Observable<IUserLoginResponse> {
    if (!loginInfo.client_fp) {
      loginInfo.client_fp = this.getClientFingerprint();
    }
    return this.http
      .post<IUserLoginResponse>(`${this.apiUrl}/login`, loginInfo)
      .pipe(catchError((error) => this.handleError(error)));
  }

  getClientFingerprint(): string {
    let fp = localStorage.getItem('client_fp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('client_fp', fp);
    }
    return fp;
  }

  getUser(): Observable<{ message: string; user: IUser }> {
    return this.http
      .get<{ message: string; user: IUser }>(`${this.apiUrl}/user`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  isAuthenticated() {
    const token = localStorage.getItem('token');
    if (!token) {
      return false;
    }
    try {
      const decoded: IJwtPayload = jwtDecode(token);
      const isExpired = decoded.exp * 1000 < Date.now();
      if (isExpired) {
        localStorage.removeItem('token');
        return false;
      }
      return true;
    } catch (error) {
      localStorage.removeItem('token');
      return false;
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.router.navigate(['login']);
  }

  public handleError(error: HttpErrorResponse) {
    if (error.status === 401) {
      this.router.navigate(['login']);
    }
    let errorMsg = 'An unknown error occurred!';
    if (error.error) {
      if (error.error.message) {
        errorMsg = error.error.message;
      }
    }
    return throwError(() => error);
  }

  // Admin Methods
  getPasscodes(): Observable<{ passcodes: any[] }> {
    return this.http
      .get<{ passcodes: any[] }>(`${this.apiUrl}/admin/passcodes`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  createPasscode(passcode: string, opts?: { label?: string; tier?: string; remainingMinutes?: number; expiresAt?: string | null }): Observable<any> {
    return this.http
      .post<any>(`${this.apiUrl}/admin/passcodes`, { passcode, ...opts })
      .pipe(catchError((error) => this.handleError(error)));
  }

  updatePasscode(id: string, data: { label?: string; tier?: string; remainingMinutes?: number; expiresAt?: string | null }): Observable<any> {
    return this.http
      .put<any>(`${this.apiUrl}/admin/passcodes/${id}`, data)
      .pipe(catchError((error) => this.handleError(error)));
  }

  deletePasscode(id: string): Observable<any> {
    return this.http
      .delete<any>(`${this.apiUrl}/admin/passcodes/${id}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  // Access Requests
  createAccessRequest(requestData: any): Observable<any> {
    return this.http
      .post<any>(`${environment.apiUrl}/access-request`, requestData)
      .pipe(catchError((error) => this.handleError(error)));
  }

  getAccessRequests(): Observable<{ requests: any[] }> {
    return this.http
      .get<{ requests: any[] }>(`${environment.apiUrl}/admin/access-requests`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  approveAccessRequest(id: string): Observable<any> {
    return this.http
      .post<any>(`${environment.apiUrl}/admin/access-requests/${id}/approve`, {})
      .pipe(catchError((error) => this.handleError(error)));
  }

  rejectAccessRequest(id: string): Observable<any> {
    return this.http
      .post<any>(`${environment.apiUrl}/admin/access-requests/${id}/reject`, {})
      .pipe(catchError((error) => this.handleError(error)));
  }

  getAdminUserInterviews(userId: string): Observable<{ interviews: any[] }> {
    return this.http
      .get<{ interviews: any[] }>(`${this.apiUrl}/admin/users/${userId}/interviews`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  public getUserInfo(): IUser | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const decoded: IJwtPayload = jwtDecode(token);
      return {
        passcode: decoded.passcode,
        role: decoded.role,
      };
    } catch (error) {
      return null;
    }
  }
}
