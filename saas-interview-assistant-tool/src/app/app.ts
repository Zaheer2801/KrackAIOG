import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from "./components/header/header";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  isSharing = false;
  showGuide = false;

  ngOnInit() {
    if (!localStorage.getItem('krackai_guide_shown')) {
      // Small delay so the app has time to render first
      setTimeout(() => { this.showGuide = true; }, 800);
    }
  }

  dismissGuide() {
    localStorage.setItem('krackai_guide_shown', '1');
    this.showGuide = false;
  }

  toggleSharing() {
    this.isSharing = !this.isSharing;
  }
}
