import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { HttpClient } from '@angular/common/http';

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  image?: string;
  summary?: string;
}

interface FactOfTheDay {
  text: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterOutlet, CommonModule, CardModule, DividerModule, TagModule, ButtonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly title = signal('Super Bowl Sunday Checker');
  protected readonly currentYear = signal(new Date().getFullYear());
  protected readonly sidebarExpanded = signal(false);
  
  private intervalId: number | null = null;
  
  // RSS state
  protected readonly espnItems = signal<RssItem[]>([]);
  protected readonly coldWireItems = signal<RssItem[]>([]);
  protected readonly nytItems = signal<RssItem[]>([]);
  protected readonly rssLoading = signal(false);
  
  // News state for infinite scroll
  protected readonly allNewsItems = signal<RssItem[]>([]);
  protected readonly displayedNewsCards = signal<RssItem[]>([]);
  protected readonly isLoadingMore = signal(false);
  protected readonly currentIndex = signal(0);
  protected readonly itemsPerPage = signal(6);
  
  // Fact of the day
  protected readonly factOfTheDay = signal<FactOfTheDay>({ text: 'The Super Bowl is the most-watched television event in the United States each year.' });
  
  // Super Bowl status
  protected readonly isSuperBowlSunday = signal(false);
  protected readonly timeUntilNext = signal<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  
  // Sidebar links for NFL/Super Bowl fans
  protected readonly sidebarLinks = [
    { label: 'NFL', url: 'https://www.nfl.com' },
    { label: 'ESPN', url: 'https://www.espn.com/nfl/' },
    { label: 'NFL Network', url: 'https://www.nfl.com/network/' },
    { label: 'Super Bowl', url: 'https://www.nfl.com/super-bowl/' },
    { label: 'Fantasy', url: 'https://fantasy.nfl.com' },
    { label: 'Tickets', url: 'https://www.ticketmaster.com/superbowl' },
    { label: 'Pro Bowl', url: 'https://www.nfl.com/pro-bowl/' },
    { label: 'NFL Shop', url: 'https://www.nflshop.com' }
  ];
  
  // Super Bowl dates (typically second Sunday in February)
  private superBowlDates = [
    new Date(2026, 1, 8),  // Super Bowl LX
    new Date(2027, 1, 14),  // Super Bowl LXI
    new Date(2028, 1, 13),  // Super Bowl LXII
    new Date(2029, 1, 11),  // Super Bowl LXIII
    new Date(2030, 1, 10)   // Super Bowl LXIV
  ];
  
  // Facts of the day
  private facts = [
    { text: 'The Super Bowl is the most-watched television event in the United States each year.' },
    { text: 'The first Super Bowl was played on January 15, 1967, between the Green Bay Packers and Kansas City Chiefs.' },
    { text: 'Super Bowl Sunday is the second-largest day for food consumption in the United States, after Thanksgiving.' },
    { text: 'The Vince Lombardi Trophy is named after the legendary Green Bay Packers coach who won the first two Super Bowls.' },
    { text: 'The Super Bowl halftime show has featured some of the biggest names in music, from Michael Jackson to Beyoncé.' },
    { text: 'The term "Super Bowl" was coined by Lamar Hunt, owner of the Kansas City Chiefs, after seeing his kids play with a "Super Ball."' },
    { text: 'The Super Bowl is the only NFL game where the coin toss is performed by a special guest, often a celebrity or military hero.' },
    { text: 'The first Super Bowl had an attendance of 61,946 people, while modern Super Bowls can hold over 70,000 fans.' },
    { text: 'The Super Bowl trophy weighs 7 pounds and is made of sterling silver.' },
    { text: 'Super Bowl commercials are some of the most expensive advertising slots, costing millions of dollars for just 30 seconds.' }
  ];
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    this.updateSuperBowlStatus();
    this.loadRssFeeds();
    this.loadFactOfTheDay();
    
    // Update countdown every second
    this.intervalId = window.setInterval(() => {
      this.updateSuperBowlStatus();
    }, 1000);
  }
  
  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
  
  private updateSuperBowlStatus(): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Check if today is Super Bowl Sunday
    const isSuperBowl = this.superBowlDates.some(date => {
      const superBowlDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      return superBowlDate.getTime() === today.getTime();
    });
    
    this.isSuperBowlSunday.set(isSuperBowl);
    
    if (!isSuperBowl) {
      // Find next Super Bowl
      const nextSuperBowl = this.superBowlDates.find(date => date > now);
      if (nextSuperBowl) {
        const timeDiff = nextSuperBowl.getTime() - now.getTime();
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        this.timeUntilNext.set({ days, hours, minutes, seconds });
      }
    }
  }
  
  private loadRssFeeds(): void {
    this.rssLoading.set(true);
    
    // ESPN NFL RSS
    this.http.get('/api/rss/espn', { responseType: 'text' }).subscribe({
      next: (data) => this.onFeedLoaded(data, 'espn'),
      error: () => this.rssLoading.set(false)
    });
    
    // Cold Wire NFL RSS
    this.http.get('/api/rss/coldwire', { responseType: 'text' }).subscribe({
      next: (data) => this.onFeedLoaded(data, 'coldwire'),
      error: () => this.rssLoading.set(false)
    });
    
    // NYT Sports RSS
    this.http.get('/api/rss/nyt', { responseType: 'text' }).subscribe({
      next: (data) => this.onFeedLoaded(data, 'nyt'),
      error: () => this.rssLoading.set(false)
    });
  }
  
  private onFeedLoaded(data: string, source: string): void {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');
      const parsedItems: RssItem[] = [];
      
      items.forEach(item => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const contentEncoded = item.querySelector('content\\:encoded, encoded')?.textContent || '';
        
        // Extract image from media tags, content:encoded, or description
        let image = '';
        
        // Try media:content tag first
        const mediaContent = item.querySelector('media\\:content');
        if (mediaContent) {
          image = mediaContent.getAttribute('url') || '';
        }
        
        // Try content:encoded for img tags
        if (!image && contentEncoded) {
          const imgMatch = contentEncoded.match(/<img[^>]+src="([^"]+)"/);
          if (imgMatch) {
            image = imgMatch[1];
          }
        }
        
        // Try description for img tags
        if (!image && description) {
          const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
          if (imgMatch) {
            image = imgMatch[1];
          }
        }
        
        // Extract summary from description
        const summaryMatch = description.match(/<p[^>]*>(.*?)<\/p>/);
        const summary = summaryMatch ? summaryMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        
        // Only include items in English (images are optional)
        if (this.isEnglishText(title + ' ' + description)) {
          parsedItems.push({
            title,
            link,
            pubDate,
            description,
            image: image || '/logo.png', // Use site logo as fallback
            summary
          });
        }
      });
      
      // Update the appropriate signal
      switch (source) {
        case 'espn':
          this.espnItems.set(parsedItems);
          break;
        case 'coldwire':
          this.coldWireItems.set(parsedItems);
          break;
        case 'nyt':
          this.nytItems.set(parsedItems);
          break;
      }
      
      // Build all news items for infinite scroll
      this.buildAllNewsItems();
      
    } catch (error) {
      console.error(`Error parsing ${source} RSS:`, error);
    }
    
    this.rssLoading.set(false);
  }
  
  private isEnglishText(text: string): boolean {
    // Simple check for English text - look for common English words/patterns
    const englishPattern = /^(?!.*[ñáéíóúüç]).*$/;
    return englishPattern.test(text);
  }
  
  private buildAllNewsItems(): void {
    const allItems = [
      ...this.espnItems(),
      ...this.coldWireItems(),
      ...this.nytItems()
    ];
    
    // Filter for items with images and prioritize them
    const itemsWithImages = allItems.filter(item => item.image);
    const itemsWithoutImages = allItems.filter(item => !item.image);
    
    // Combine with images first, then without images
    const prioritizedItems = [...itemsWithImages, ...itemsWithoutImages];
    
    this.allNewsItems.set(prioritizedItems);
    
    // Reset displayed items and load initial batch
    this.displayedNewsCards.set([]);
    this.currentIndex.set(0);
    this.loadMoreNews();
  }
  
  protected loadMoreNews(): void {
    if (this.isLoadingMore()) return;
    
    this.isLoadingMore.set(true);
    
    const startIndex = this.currentIndex();
    const endIndex = startIndex + this.itemsPerPage();
    const newItems = this.allNewsItems().slice(startIndex, endIndex);
    
    this.displayedNewsCards.update(current => [...current, ...newItems]);
    this.currentIndex.set(endIndex);
    
    this.isLoadingMore.set(false);
  }
  
  protected onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 100) {
      this.loadMoreNews();
    }
  }
  
  private loadFactOfTheDay(): void {
    const randomFact = this.facts[Math.floor(Math.random() * this.facts.length)];
    this.factOfTheDay.set(randomFact);
  }
  
  protected formatDateOnly(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  protected toggleSidebar(): void {
    this.sidebarExpanded.update((v: boolean) => !v);
  }
}
