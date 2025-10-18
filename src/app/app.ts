import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  source?: string;
  imageUrl?: string;
  summary?: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, CardModule, DividerModule, TagModule, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('Super Bowl Sunday Checker');
  protected readonly currentYear = signal(new Date().getFullYear());
  
  private intervalId: number | null = null;
  
  // RSS state
  protected readonly espnItems = signal<RssItem[]>([]);
  protected readonly coldWireItems = signal<RssItem[]>([]);
  protected readonly nytItems = signal<RssItem[]>([]);
  protected readonly wapoItems = signal<RssItem[]>([]);
  protected readonly rssLoading = signal<boolean>(false);
  protected readonly rssError = signal<string | null>(null);

  // Infinite scroll state
  private allNewsItems = signal<RssItem[]>([]);
  protected readonly displayedNewsCards = signal<RssItem[]>([]);
  protected readonly isLoadingMore = signal<boolean>(false);
  private currentIndex = 0;
  private readonly itemsPerPage = 6;

  // Combined list for ticker (duplicated for seamless scroll)
  protected readonly tickerBaseItems = computed(() => {
    const merged = [
      ...this.espnItems(),
      ...this.coldWireItems(),
      ...this.nytItems(),
      ...this.wapoItems()
    ];
    // sort by pubDate if available
    const withTime = merged.map(i => ({
      ...i,
      _ts: i.pubDate ? Date.parse(i.pubDate) || 0 : 0
    }));
    withTime.sort((a, b) => b._ts - a._ts);
    return withTime.map(({ _ts, ...rest }) => rest).slice(0, 30);
  });
  protected readonly tickerItems = computed(() => {
    const base = this.tickerBaseItems();
    return base.length ? [...base, ...base] : [];
  });
  
  // Build complete news list prioritizing items with images
  private buildAllNewsItems(): void {
    const merged = [
      ...this.espnItems(),
      ...this.coldWireItems(),
      ...this.nytItems(),
      ...this.wapoItems()
    ];
    if (!merged.length) {
      this.allNewsItems.set([]);
      return;
    }

    type WithTs = RssItem & { _ts: number };
    const withTime: WithTs[] = merged.map(i => ({
      ...i,
      _ts: i.pubDate ? Date.parse(i.pubDate) || 0 : 0
    }));

    // Separate items with and without images
    const withImages = withTime.filter(i => !!i.imageUrl);
    const withoutImages = withTime.filter(i => !i.imageUrl);

    // Sort each group by time desc
    withImages.sort((a, b) => b._ts - a._ts);
    withoutImages.sort((a, b) => b._ts - a._ts);

    // Combine: images first, then non-images
    const all = [...withImages, ...withoutImages];
    this.allNewsItems.set(all.map(({ _ts, ...rest }) => rest));
    
    // Load initial batch
    this.currentIndex = 0;
    this.loadMoreNews();
  }
  
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
  
  // Obscure and historically odd NFL/American football facts with sources
  private footballFacts = [
    { text: "In 1943, due to WWII shortages, the Eagles and Steelers merged for one season as the 'Steagles'.", url: "https://en.wikipedia.org/wiki/Steagles" },
    { text: "The 1992 Bills–49ers 'No Punt Game' had zero punts; Buffalo won 34–31 at Candlestick Park.", url: "https://en.wikipedia.org/wiki/No_Punt_Game" },
    { text: "The 1968 'Heidi Game' cut away from Jets–Raiders with 1:05 left; Oakland scored twice to win 43–32.", url: "https://en.wikipedia.org/wiki/Heidi_Game" },
    { text: "In the 1982 'Snowplow Game', a work‑release prisoner used a tractor to clear a spot for the Patriots’ game‑winning field goal in a 3–0 win over the Dolphins.", url: "https://en.wikipedia.org/wiki/Snowplow_Game" },
    { text: "The 1978 'Holy Roller' play led to a rule: only the fumbling player may advance a fumble in the last two minutes or on fourth down.", url: "https://en.wikipedia.org/wiki/Holy_Roller_(American_football)" },
    { text: "The 1981 AFC title 'Freezer Bowl' (Bengals–Chargers) had a wind chill near −59°F, the coldest in NFL history.", url: "https://en.wikipedia.org/wiki/Freezer_Bowl" },
    { text: "In the 1934 'Sneakers Game', the Giants switched to basketball sneakers on ice and upset the undefeated Bears 30–13.", url: "https://en.wikipedia.org/wiki/1934_NFL_Championship_Game" },
    { text: "Regular‑season sudden‑death overtime began in 1974; before that, ties stood in the regular season.", url: "https://en.wikipedia.org/wiki/1974_NFL_season#Rule_changes" },
    { text: "The NFL added the two‑point conversion in 1994—decades after the AFL used it.", url: "https://en.wikipedia.org/wiki/1994_NFL_season#Rule_changes" },
    { text: "Stickum (the super‑sticky substance) was banned in 1981, largely due to Raiders CB Lester Hayes’ use of it.", url: "https://en.wikipedia.org/wiki/Stickum#American_football" },
    { text: "The 'tuck rule' was abolished in 2013 after years of controversy about forward arm movement.", url: "https://en.wikipedia.org/wiki/Tuck_rule" },
    { text: "In 2015, extra points moved back to a 33‑yard kick to make PATs less automatic.", url: "https://en.wikipedia.org/wiki/2015_NFL_season#Rule_changes" },
    { text: "A 'fair‑catch kick' is still legal: after a fair catch, a team may try a free kick for three points from the spot of the catch.", url: "https://en.wikipedia.org/wiki/Fair_catch_kick" },
    { text: "During the 1987 players’ strike, teams used replacements for three games; Washington’s replacements went 3–0 and helped springboard a Super Bowl run.", url: "https://en.wikipedia.org/wiki/1987_NFL_season#Players'_strike" },
    { text: "Officials deliberated under police protection before ruling the 1972 'Immaculate Reception' a touchdown.", url: "https://en.wikipedia.org/wiki/Immaculate_Reception" },
    { text: "In 1970, Saints kicker Tom Dempsey hit a then‑record 63‑yard field goal with a modified shoe.", url: "https://en.wikipedia.org/wiki/Tom_Dempsey#NFL_career" },
    { text: "The 1972 Dolphins completed the only perfect season in NFL history (17–0).", url: "https://en.wikipedia.org/wiki/1972_Miami_Dolphins_season" },
    { text: "For night games before 1956, the NFL used white footballs; then the league switched to dark balls with white stripes for visibility.", url: "https://en.wikipedia.org/wiki/American_football_(ball)#Construction_and_markings" },
    { text: "Special 'K‑balls' for kicks were introduced in 1999 to curb ball doctoring; kickers must use brand‑new, officiating‑prepared balls.", url: "https://en.wikipedia.org/wiki/K_ball" },
    { text: "The 1970 draft’s first overall pick was decided by a coin toss the Steelers won—they selected Terry Bradshaw.", url: "https://en.wikipedia.org/wiki/1970_NFL_Draft" },
    { text: "The 1925 Pottsville Maroons had their NFL title stripped over a territorial‑rights dispute after a barnstorming game in Philadelphia.", url: "https://en.wikipedia.org/wiki/Pottsville_Maroons#1925_NFL_championship_controversy" },
    { text: "In 1944, the Cardinals and Steelers merged as 'Card‑Pitt' due to WWII; they went 0–10.", url: "https://en.wikipedia.org/wiki/Card-Pitt" },
    { text: "The 1932 NFL championship was moved indoors to Chicago Stadium on a shortened field, prompting the introduction of hash marks and the modern title game.", url: "https://en.wikipedia.org/wiki/1932_NFL_Playoff_Game" },
    { text: "The 1940 NFL title game ended 73–0 (Bears over Redskins), the most lopsided championship in league history.", url: "https://en.wikipedia.org/wiki/1940_NFL_Championship_Game" },
    { text: "The 1958 'Greatest Game' (Colts–Giants) was the first NFL championship decided in sudden‑death overtime and supercharged the sport’s popularity.", url: "https://en.wikipedia.org/wiki/1958_NFL_Championship_Game" },
    { text: "The 1960 Eagles are the only team to beat a Vince Lombardi Packers squad in the postseason (NFL Championship).", url: "https://en.wikipedia.org/wiki/1960_NFL_Championship_Game" },
    { text: "Super Bowl I was officially the AFL–NFL World Championship Game; face value tickets were $12.", url: "https://en.wikipedia.org/wiki/Super_Bowl_I" },
    { text: "Chuck Howley (Cowboys) is the only Super Bowl MVP from a losing team (SB V).", url: "https://en.wikipedia.org/wiki/Super_Bowl_Most_Valuable_Player_Award#Winners" },
    { text: "Super Bowl VII featured Garo Yepremian’s infamous botched pass; Miami still completed the perfect season.", url: "https://en.wikipedia.org/wiki/Super_Bowl_VII" },
    { text: "'Ghost to the Post' (1977) was a legendary Raiders double‑OT playoff win keyed by TE Dave Casper’s deep catch.", url: "https://en.wikipedia.org/wiki/Ghost_to_the_Post" },
    { text: "The longest NFL game lasted 82:40 (double OT): Dolphins 27, Chiefs 24, on Christmas Day 1971.", url: "https://en.wikipedia.org/wiki/1971%E2%80%9372_NFL_playoffs#AFC:_Miami_Dolphins_27,_Kansas_City_Chiefs_24_(2OT)" },
    { text: "The 1976 expansion Buccaneers went 0–14; they didn’t win until their second season.", url: "https://en.wikipedia.org/wiki/1976_Tampa_Bay_Buccaneers_season" },
    { text: "The Seahawks played in the NFC in 1976, moved to the AFC in 1977, and returned to the NFC in 2002 realignment.", url: "https://en.wikipedia.org/wiki/Seattle_Seahawks#Conference_alignment" },
    { text: "The 'Mel Blount Rule' emphasis in 1978 (illegal contact after 5 yards) helped open the passing game.", url: "https://en.wikipedia.org/wiki/Illegal_contact_(American_football)" },
    { text: "In 1972, the NFL moved hash marks closer to the center, dramatically changing run/pass geometry and scoring.", url: "https://en.wikipedia.org/wiki/Hash_mark_(sports)#American_football" },
    { text: "In 1974, goalposts moved to the end line and regular‑season sudden‑death overtime was introduced; kickoffs moved from the 40 to the 35.", url: "https://en.wikipedia.org/wiki/1974_NFL_season#Rule_changes" },
    { text: "The 1988 'Fog Bowl' playoff game saw visibility at Soldier Field drop so low TV cameras could barely follow the action.", url: "https://en.wikipedia.org/wiki/Fog_Bowl" },
    { text: "The term 'Hail Mary' entered NFL lore after Roger Staubach’s 1975 playoff TD to Drew Pearson vs. Minnesota.", url: "https://en.wikipedia.org/wiki/Hail_Mary_pass#Origin" },
    { text: "Marshawn Lynch’s 2011 playoff 'Beast Quake' run was powerful enough to register on a local seismograph in Seattle.", url: "https://en.wikipedia.org/wiki/Beast_Quake" },
    { text: "The 2000 'Music City Miracle' featured a controversial but legal lateral on a kickoff that propelled the Titans past the Bills.", url: "https://en.wikipedia.org/wiki/Music_City_Miracle" },
    { text: "The Saints began Super Bowl XLIV’s second half with surprise onside kick 'Ambush'—and won the title.", url: "https://en.wikipedia.org/wiki/Super_Bowl_XLIV#Second_half" },
    { text: "Rams 54, Chiefs 51 (2018) is the highest‑scoring Monday Night Football game ever; both teams topped 50 in regulation.", url: "https://en.wikipedia.org/wiki/2018_Los_Angeles_Rams_season#Week_11:_vs._Kansas_City_Chiefs" },
    { text: "In 2016, the league moved touchbacks on kickoffs to the 25 to discourage returns.", url: "https://en.wikipedia.org/wiki/2016_NFL_season#Rule_changes" },
    { text: "Kickoffs were moved from the 30 back to the 35‑yard line in 2011 to reduce high‑speed collisions.", url: "https://en.wikipedia.org/wiki/2011_NFL_season#Rule_changes" },
    { text: "The playoffs expanded to 14 teams in 2020; in 2022, postseason OT rules were changed to guarantee both teams a possession.", url: "https://en.wikipedia.org/wiki/2022_NFL_season#Rule_changes" },
    { text: "In 1993, the NFL briefly used two bye weeks per team before reverting to one.", url: "https://en.wikipedia.org/wiki/1993_NFL_season" },
    { text: "The 2002 realignment created eight divisions of four teams and added the Houston Texans as the 32nd franchise.", url: "https://en.wikipedia.org/wiki/2002_NFL_season#Realignment" },
    { text: "The 1969 Chiefs were the last AFL champions and then won Super Bowl IV before the merger.", url: "https://en.wikipedia.org/wiki/1969_Kansas_City_Chiefs_season" },
    { text: "The 1982 strike shortened the season to 9 games and produced a 16‑team 'Super Bowl Tournament' playoff bracket.", url: "https://en.wikipedia.org/wiki/1982_NFL_season" },
    { text: "William 'The Refrigerator' Perry scored a TD in Super Bowl XX; Hall‑of‑Famer Walter Payton did not.", url: "https://en.wikipedia.org/wiki/Super_Bowl_XX#Game_summary" },
    { text: "In 1963, stars Paul Hornung and Alex Karras were suspended a full season for gambling.", url: "https://en.wikipedia.org/wiki/Paul_Hornung#Gambling_suspension" },
    { text: "In 1946, the Los Angeles Rams signed Kenny Washington and Woody Strode, reintegrating the NFL after WWII.", url: "https://en.wikipedia.org/wiki/Kenny_Washington_(American_football)#Los_Angeles_Rams" },
    { text: "The 1950 Cleveland Browns jumped from the AAFC and won the NFL title in their first NFL season.", url: "https://en.wikipedia.org/wiki/1950_Cleveland_Browns_season" },
    { text: "The Patriots’ 2007 'Spygate' scandal cost them a first‑round pick and large fines.", url: "https://en.wikipedia.org/wiki/Spygate" },
    { text: "'Deflategate' (2015) led to a four‑game suspension for Tom Brady and forfeited draft picks for New England.", url: "https://en.wikipedia.org/wiki/Deflategate" },
    { text: "'Bountygate' (2012) led to season‑long suspensions for Saints coaches and major penalties for the team.", url: "https://en.wikipedia.org/wiki/New_Orleans_Saints_bounty_scandal" },
    { text: "Calvin Johnson’s 2010 'process of the catch' play and Dez Bryant’s 2014 playoff 'no‑catch' spurred major catch‑rule overhauls.", url: "https://en.wikipedia.org/wiki/Calvin_Johnson_rule" },
    { text: "The NFL moved to a 17‑game regular season in 2021, the first change since 1978’s jump to 16.", url: "https://en.wikipedia.org/wiki/2021_NFL_season" },
    { text: "The 2008 Lions and 2017 Browns were the first teams to finish 0–16 in a season.", url: "https://en.wikipedia.org/wiki/Winless_season_(NFL)#0%E2%80%9316" },
    { text: "'4th‑and‑26' (2004) saw the Eagles convert a do‑or‑die 26‑yard first down vs. Green Bay en route to a playoff win.", url: "https://en.wikipedia.org/wiki/4th_and_26" },
    { text: "Super Bowl LI (2017) is the only Super Bowl to go to overtime; the Patriots overcame a 28–3 deficit.", url: "https://en.wikipedia.org/wiki/Super_Bowl_LI" },
    { text: "The 1984 Colts’ midnight move from Baltimore to Indianapolis used a fleet of Mayflower trucks to avoid seizure by Maryland officials.", url: "https://en.wikipedia.org/wiki/Baltimore_Colts_relocation_to_Indianapolis" },
    { text: "The 1952 Dallas Texans folded midseason; their assets seeded the modern Baltimore Colts (1953).", url: "https://en.wikipedia.org/wiki/1952_Dallas_Texans_(NFL)" },
    { text: "The Raiders have relocated multiple times: Oakland to Los Angeles (1982), back to Oakland (1995), then to Las Vegas (2020).", url: "https://en.wikipedia.org/wiki/Las_Vegas_Raiders#Franchise_history" },
    { text: "Monday Night Football debuted in 1970 (Browns 31, Jets 21), reshaping sports television.", url: "https://en.wikipedia.org/wiki/Monday_Night_Football#Early_history_(1970%E2%80%931973)" },
    { text: "Dan Marino’s 48 TD passes in 1984 stood as a single‑season record until 2004.", url: "https://en.wikipedia.org/wiki/Dan_Marino#NFL_records" },
    { text: "The 1937 Championship saw rookie QB Sammy Baugh throw for 335 yards—a staggering total for the era.", url: "https://en.wikipedia.org/wiki/1937_NFL_Championship_Game" },
    { text: "In 1982’s 'Epic in Miami', TE Kellen Winslow battled heat and cramps to post 166 yards, a TD, a blocked FG, and the game‑saving FG block in OT.", url: "https://en.wikipedia.org/wiki/Epic_in_Miami" }
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
  
  // Fact of the day - randomly selected based on current date
  protected readonly factOfTheDay = computed(() => {
    const today = this.currentDate();
    // Create a seed from the current date (year + month + day)
    const seed = today.getFullYear() * 10000 + today.getMonth() * 100 + today.getDate();
    // Use seed to deterministically select a fact for this day
    const index = seed % this.footballFacts.length;
    return this.footballFacts[index];
  });
  
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Update time every second for countdown
    this.intervalId = window.setInterval(() => {
      const now = new Date();
      this.currentDate.set(now);
      this.currentYear.set(now.getFullYear());
    }, 1000);

    // Fetch RSS feeds on load
    this.loadRssFeeds();
  }
  
  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private loadRssFeeds() {
    this.rssLoading.set(true);
    this.rssError.set(null);
    // Use relative proxy paths to avoid CORS both in dev and prod
    const requests = {
      espn: this.http.get<string>('/api/rss/espn', { responseType: 'text' as 'json' }),
      cold: this.http.get<string>('/api/rss/coldwire', { responseType: 'text' as 'json' }),
      nyt: this.http.get<string>('/api/rss/nyt', { responseType: 'text' as 'json' }),
      wapo: this.http.get<string>('/api/rss/wapo', { responseType: 'text' as 'json' })
    };

    forkJoin(requests).subscribe({
      next: ({ espn, cold, nyt, wapo }) => {
        this.espnItems.set(this.parseRss(espn, 'ESPN'));
        this.coldWireItems.set(this.parseRss(cold, 'The Cold Wire'));
        this.nytItems.set(this.parseRss(nyt, 'NYT'));
        this.wapoItems.set(this.parseRss(wapo, 'Washington Post'));
      },
      error: () => {
        this.rssError.set('Failed to load news feeds');
        this.rssLoading.set(false);
      },
      complete: () => this.rssLoading.set(false)
    });
  }

  // Minimal RSS XML parser good enough for typical feeds
  private parseRss(xmlString: string, source: string): RssItem[] {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'application/xml');
      const items = Array.from(doc.querySelectorAll('item'));
      return items.slice(0, 8).map((item) => ({
        title: (item.querySelector('title')?.textContent || '').trim(),
        link: (item.querySelector('link')?.textContent || '').trim(),
        pubDate: (item.querySelector('pubDate')?.textContent || '').trim(),
        source,
        imageUrl: this.extractImageUrl(item),
        summary: this.extractSummary(item)
      })).filter(i => i.title && i.link && this.isLikelyEnglish(`${i.title} ${i.summary || ''}`));
    } catch {
      return [];
    }
  }

  private extractImageUrl(item: Element): string | undefined {
    // enclosure tag
    const enclosure = item.querySelector('enclosure');
    const enclosureUrl = enclosure?.getAttribute('url');
    const enclosureType = enclosure?.getAttribute('type') || '';
    if (enclosureUrl && enclosureType.startsWith('image')) return enclosureUrl;

    // media:content / media:thumbnail (namespace may be preserved or escaped)
    const mediaContent = item.getElementsByTagName('media:content')[0] || item.querySelector('media\\:content');
    const mediaThumb = item.getElementsByTagName('media:thumbnail')[0] || item.querySelector('media\\:thumbnail');
    const mediaUrl = mediaContent?.getAttribute?.('url') || mediaThumb?.getAttribute?.('url');
    if (mediaUrl) return mediaUrl;

    // content:encoded may include HTML with images
    const contentEncodedEl = item.getElementsByTagName('content:encoded')[0] || item.querySelector('content\\:encoded');
    const contentHtml = contentEncodedEl?.textContent || '';
    const fromContent = this.findImgInHtml(contentHtml);
    if (fromContent) return fromContent;

    // description often has inline image
    const descriptionHtml = item.querySelector('description')?.textContent || '';
    const fromDesc = this.findImgInHtml(descriptionHtml);
    if (fromDesc) return fromDesc;

    return undefined;
  }

  private findImgInHtml(html: string): string | undefined {
    if (!html) return undefined;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const img = doc.querySelector('img');
      const src = img?.getAttribute('src') || img?.getAttribute('data-src');
      return src || undefined;
    } catch {
      return undefined;
    }
  }

  private isLikelyEnglish(text: string): boolean {
    if (!text) return false;
    const cleaned = text.replace(/https?:\/\/\S+/g, '');
    const asciiMatches = cleaned.match(/[\x20-\x7E]/g) || [];
    const ratio = asciiMatches.length / Math.max(cleaned.length, 1);
    if (ratio < 0.85) return false;
    const lower = cleaned.toLowerCase();
    const spanishStop = [' el ', ' la ', ' los ', ' las ', ' de ', ' que ', ' en ', ' un ', ' una ', ' y ', ' con ', ' por ', ' para ', ' del ', ' al '];
    let hits = 0;
    for (const w of spanishStop) {
      if (lower.includes(w)) hits++;
      if (hits >= 4) return false;
    }
    return true;
  }

  private extractSummary(item: Element): string | undefined {
    // Try <content:encoded> first for richer text
    const contentEl = item.getElementsByTagName('content:encoded')[0] || item.querySelector('content\\:encoded');
    const descriptionEl = item.querySelector('description');
    const raw = (contentEl?.textContent || descriptionEl?.textContent || '').trim();
    if (!raw) return undefined;
    const text = this.htmlToPlainText(raw);
    if (!text) return undefined;
    return this.truncate(text, 200);
  }

  private htmlToPlainText(html: string): string {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const text = (doc.body?.textContent || doc.documentElement?.textContent || '').replace(/\s+/g, ' ').trim();
      return text;
    } catch {
      // fallback: strip tags crudely
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const cut = text.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }

  private getDailySeed(): number {
    const today = this.currentDate();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  }

  private seededShuffle<T>(array: T[], seed: number): T[] {
    const result = array.slice();
    let rand = this.mulberry32(seed);
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  private mulberry32(seed: number): () => number {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  protected formatDateOnly(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return '';
    }
  }
}
