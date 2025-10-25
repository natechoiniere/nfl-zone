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
  source: string;
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
  private loadedFeedsCount = 0;
  private totalFeedsCount = 3;
  
  // News state for infinite scroll
  protected readonly allNewsItems = signal<RssItem[]>([]);
  protected readonly displayedNewsCards = signal<RssItem[]>([]);
  protected readonly isLoadingMore = signal(false);
  protected readonly currentIndex = signal(0);
  protected readonly itemsPerPage = signal(12);
  
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
    this.loadedFeedsCount = 0; // Reset counter
    
    console.log('Starting to load RSS feeds...');
    
    // ESPN NFL RSS
    this.http.get('/api/rss/espn', { responseType: 'text' }).subscribe({
      next: (data) => {
        console.log('ESPN RSS feed loaded successfully');
        this.onFeedLoaded(data, 'espn');
      },
      error: (error) => {
        console.error('ESPN RSS feed error:', error);
        this.onFeedError('espn');
      }
    });
    
    // Cold Wire NFL RSS
    this.http.get('/api/rss/coldwire', { responseType: 'text' }).subscribe({
      next: (data) => {
        console.log('ColdWire RSS feed loaded successfully');
        this.onFeedLoaded(data, 'The Cold Wire');
      },
      error: (error) => {
        console.error('ColdWire RSS feed error:', error);
        this.onFeedError('The Cold Wire');
      }
    });
    
    // NYT Sports RSS
    this.http.get('/api/rss/nyt', { responseType: 'text' }).subscribe({
      next: (data) => {
        console.log('NYT RSS feed loaded successfully');
        this.onFeedLoaded(data, 'nyt');
      },
      error: (error) => {
        console.error('NYT RSS feed error:', error);
        this.onFeedError('nyt');
      }
    });
  }
  
  private onFeedLoaded(data: string, source: string): void {
    try {
      console.log(`${source} RSS data length:`, data.length);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');
      console.log(`${source} found ${items.length} items in RSS feed`);
      
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
        
        
        // Extract summary from description - try multiple methods
        let summary = '';
        
        // Try to get text from description, removing HTML tags
        if (description) {
          // Remove HTML tags and get clean text
          let cleanText = description.replace(/<[^>]*>/g, '').trim();
          
          // Decode HTML entities
          const textarea = document.createElement('textarea');
          textarea.innerHTML = cleanText;
          cleanText = textarea.value;
          
          // If we have clean text, take the first part (up to 200 characters)
          if (cleanText) {
            summary = cleanText.length > 200 ? cleanText.substring(0, 200) + '...' : cleanText;
          }
        }
        
        // Include items - skip English filtering for The Cold Wire
        if (source === 'The Cold Wire') {
          // Include all ColdWire items without English filtering
          parsedItems.push({
            title: title,
            link,
            pubDate,
            description,
            image: image || undefined,
            summary,
            source: source
          });
        } else {
          // Apply English filtering for other sources
          const isEnglish = this.isEnglishText(title + ' ' + description);
          if (isEnglish) {
            parsedItems.push({
              title: title,
              link,
              pubDate,
              description,
              image: image || undefined,
              summary,
              source: source
            });
          } else {
            console.log(`Filtered out non-English item from ${source}:`, title);
          }
        }
      });
      
      console.log(`${source} parsed ${parsedItems.length} valid items after filtering - UPDATED CODE`);
      if (parsedItems.length > 0) {
        console.log(`First item from ${source}:`, parsedItems[0].title, 'Source:', parsedItems[0].source);
      }
      
      // Update the appropriate signal
      console.log(`Loaded ${parsedItems.length} items from ${source}`);
      switch (source) {
        case 'espn':
          this.espnItems.set(parsedItems);
          break;
        case 'The Cold Wire':
          this.coldWireItems.set(parsedItems);
          break;
        case 'nyt':
          this.nytItems.set(parsedItems);
          break;
      }
      
    } catch (error) {
      console.error(`Error parsing ${source} RSS:`, error);
    }
    
    // Increment loaded feeds counter
    this.loadedFeedsCount++;
    
    // Build all news items only when all feeds have loaded
    if (this.loadedFeedsCount >= this.totalFeedsCount) {
      this.buildAllNewsItems();
      this.rssLoading.set(false);
    }
  }
  
  private onFeedError(source: string): void {
    console.error(`Error loading ${source} RSS feed`);
    this.loadedFeedsCount++;
    
    // Build all news items only when all feeds have loaded
    if (this.loadedFeedsCount >= this.totalFeedsCount) {
      this.buildAllNewsItems();
      this.rssLoading.set(false);
    }
  }
  
  private isEnglishText(text: string): boolean {
    // Simple check for English text - look for common English words/patterns
    const englishPattern = /^(?!.*[ñáéíóúüç]).*$/;
    return englishPattern.test(text);
  }
  
  
  private buildAllNewsItems(): void {
    const espnItems = this.espnItems();
    const coldWireItems = this.coldWireItems();
    const nytItems = this.nytItems();
    
    console.log(`Building news items - ESPN: ${espnItems.length}, ColdWire: ${coldWireItems.length}, NYT: ${nytItems.length}`);
    
    // Combine all items from all sources
    const allItems = [
      ...espnItems,
      ...coldWireItems,
      ...nytItems
    ];
    
    console.log(`Total items before sorting: ${allItems.length}`);
    
    // Sort by images first (items with images prioritized), then by date (most recent first)
    const sortedItems = allItems.sort((a, b) => {
      const aHasImage = a.image && a.image.trim() !== '';
      const bHasImage = b.image && b.image.trim() !== '';
      
      // First, prioritize items with images
      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;
      
      // If both have images or both don't have images, sort by date (most recent first)
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      
      return dateB - dateA;
    });
    
    // Debug: Show source distribution
    const sourceCounts = sortedItems.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Source distribution after sorting:', sourceCounts);
    
    // Count items with images
    const itemsWithImages = sortedItems.filter(item => item.image && item.image.trim() !== '');
    console.log(`Items with images: ${itemsWithImages.length}, Items without images: ${sortedItems.length - itemsWithImages.length}`);
    
    // Debug: Show first few items after sorting to confirm image prioritization
    if (sortedItems.length > 0) {
      console.log('First 5 items after sorting (images first, then recency):');
      sortedItems.slice(0, 5).forEach((item, index) => {
        const hasImage = item.image && item.image.trim() !== '';
        console.log(`${index + 1}. ${item.title} (${item.source}) - Has Image: ${hasImage} - ${item.pubDate}`);
      });
    }
    
    this.allNewsItems.set(sortedItems);
    
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
    
    console.log(`Loading more news: startIndex=${startIndex}, endIndex=${endIndex}, newItems=${newItems.length}`);
    if (newItems.length > 0) {
      console.log(`First new item:`, newItems[0].title, 'Source:', newItems[0].source);
    }
    
    this.displayedNewsCards.update(current => [...current, ...newItems]);
    this.currentIndex.set(endIndex);
    
    this.isLoadingMore.set(false);
  }
  
  protected onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 200; // Load more when 200px from bottom
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - threshold) {
      this.loadMoreNews();
    }
  }
  
  private loadFactOfTheDay(): void {
    const randomFact = this.facts[Math.floor(Math.random() * this.facts.length)];
    this.factOfTheDay.set(randomFact);
  }
  
  protected formatDateOnly(dateString: string): string {
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    return formatted;
  }
  
  protected toggleSidebar(): void {
    this.sidebarExpanded.update((v: boolean) => !v);
  }
}
