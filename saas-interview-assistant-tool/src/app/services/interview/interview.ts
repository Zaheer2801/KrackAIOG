import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { Auth } from '../auth/auth';
import { environment } from '../../../environments/environment';

export interface ISavedQuestion {
  questionNumber: number;
  question: string;
  answer: string;
}

export interface IInterview {
  _id?: string;
  date: string;
  timeTaken: number;
  status: 'completed' | 'incomplete';
  questions: ISavedQuestion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ICreateInterviewResponse {
  message: string;
  interviewId: string;
}

export interface IFetchInterviewsResponse {
  message: string;
  interviews: IInterview[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  monthlyCount: number;
}

export interface IDeleteInterviewResponse {
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class InterviewService {
  constructor(private http: HttpClient, private authService: Auth) {}
  apiUrl = environment.apiUrl;

  createInterview(interviewInfo: IInterview): Observable<ICreateInterviewResponse> {
    return this.http
      .post<ICreateInterviewResponse>(`${this.apiUrl}/interview`, interviewInfo)
      .pipe(catchError((error) => this.authService.handleError(error)));
  }

  fetchInterviews(limit?: number, page?: number): Observable<IFetchInterviewsResponse> {
    let params = new HttpParams();

    if (limit !== undefined && limit !== null && limit > 0) {
      params = params.set('limit', limit.toString());
    }

    if (page !== undefined && page !== null && page > 0) {
      params = params.set('page', page.toString());
    }

    return this.http
      .get<IFetchInterviewsResponse>(`${this.apiUrl}/interviews`, { params })
      .pipe(catchError((error) => this.authService.handleError(error)));
  }

  deleteInterview(id: string): Observable<IDeleteInterviewResponse> {
    return this.http
      .delete<IDeleteInterviewResponse>(`${this.apiUrl}/interview/${id}`)
      .pipe(catchError((error) => this.authService.handleError(error)));
  }
}
