import { Routes } from '@angular/router';
import { UsersComponent } from './components/admin/users/users';
import { Dashboard } from './components/dashboard/dashboard';
import { Interview } from './components/interview/interview';
import { Login } from './components/login/login';
import { Support } from './components/support/support';
import { authGuard } from './services/guards/auth-guard';
import { remainingTimeGuard } from './services/guards/time-guard';
import { Notfound } from './components/notfound/notfound';
import { Myinterviews } from './components/myinterviews/myinterviews';
import { StealthComponent } from './components/stealth/stealth';
import { Pricing } from './components/pricing/pricing';

export const routes: Routes = [
  { path: '', component: Login },
  { path: 'login', component: Login },
  { path: 'stealth/:sessionId', component: StealthComponent },
  { path: '404', component: Notfound },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'interview', component: Interview, canActivate: [authGuard, remainingTimeGuard] },
  { path: 'myinterviews', component: Myinterviews, canActivate: [authGuard] },
  { path: 'support', component: Support, canActivate: [authGuard] },
  { path: 'pricing', component: Pricing, canActivate: [authGuard] },
  { path: 'admin', component: UsersComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '404' },
];
