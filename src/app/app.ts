import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('Super Bowl Sunday Checker');
  protected readonly currentYear = signal(new Date().getFullYear());
  
  private intervalId: number | null = null;
  
  // Super Bowl dates (typically second Sunday in February)
  private superBowlDates = [
    new Date(2026, 1, 8),  // Super Bowl LX
    new Date(2027, 1, 14),  // Super Bowl LXI
    new Date(2028, 1, 13),  // Super Bowl LXII
    new Date(2029, 1, 11),
    new Date(2030, 1, 10),
    new Date(2031, 1, 9),
    new Date(2032, 1, 8),
    new Date(2033, 1, 13),
    new Date(2034, 1, 12),
    new Date(2035, 1, 11),
    new Date(2036, 1, 10),
    new Date(2037, 1, 8)
  ];
  
  protected readonly currentDate = signal(new Date());
  
  protected readonly isSuperBowlSunday = computed(() => {
    const today = this.currentDate();
    return this.superBowlDates.some(date => 
      this.isSameDay(today, date)
    );
  });
  
  protected readonly nextSuperBowl = computed(() => {
    const today = this.currentDate();
    return this.superBowlDates.find(date => date > today) || null;
  });
  
  protected readonly timeUntilNext = computed(() => {
    const next = this.nextSuperBowl();
    if (!next) return null;
    
    const now = this.currentDate();
    const diff = next.getTime() - now.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { days, hours, minutes, seconds };
  });
  
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  ngOnInit() {
    // Update time every second for countdown
    this.intervalId = window.setInterval(() => {
      const now = new Date();
      this.currentDate.set(now);
      this.currentYear.set(now.getFullYear());
    }, 1000);
  }
  
  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
