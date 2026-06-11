import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
})
export class HeaderComponent {
  protectionEnabled = true;

  constructor(private router: Router) { }

  async onToggle(): Promise<void> {
    if (!window.electronAPI) {
      this.protectionEnabled = !this.protectionEnabled;
      return;
    }
    try {
      const state = await window.electronAPI.toggleProtection(!this.protectionEnabled);
      this.protectionEnabled = state;
    } catch (err) {
      console.error('Failed to toggle screen protection:', err);
    }
  }

  onLogoClick(): void {
    this.router.navigate(['dashboard']);
  }

  onOpacityChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10) / 100;

    // Set root CSS variables for granular background opacity levels
    document.documentElement.style.setProperty('--app-opacity', value.toString());
    document.documentElement.style.setProperty('--app-opacity-90', (value * 0.9).toString());
    document.documentElement.style.setProperty('--app-opacity-80', (value * 0.8).toString());
    document.documentElement.style.setProperty('--app-opacity-40', (value * 0.4).toString());
    document.documentElement.style.setProperty('--app-opacity-20', (value * 0.2).toString());
    document.documentElement.style.setProperty('--app-opacity-10', (value * 0.1).toString());
    document.documentElement.style.setProperty('--app-opacity-05', (value * 0.05).toString());
  }
}
