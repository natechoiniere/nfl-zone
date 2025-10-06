import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DockModule } from 'primeng/dock';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, CardModule, DividerModule, TagModule, ButtonModule, DockModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('Super Bowl Sunday Checker');
  protected readonly currentYear = signal(new Date().getFullYear());
  
  private intervalId: number | null = null;
  
  // Dock items for NFL/Super Bowl fans
  protected readonly dockItems = [
    {
      label: 'NFL',
      icon: 'pi pi-globe',
      command: () => window.open('https://www.nfl.com', '_blank')
    },
    {
      label: 'ESPN',
      icon: 'pi pi-chart-line',
      command: () => window.open('https://www.espn.com/nfl/', '_blank')
    },
    {
      label: 'NFL Network',
      icon: 'pi pi-video',
      command: () => window.open('https://www.nfl.com/network/', '_blank')
    },
    {
      label: 'Super Bowl',
      icon: 'pi pi-star',
      command: () => window.open('https://www.nfl.com/super-bowl/', '_blank')
    },
    {
      label: 'Fantasy',
      icon: 'pi pi-users',
      command: () => window.open('https://fantasy.nfl.com', '_blank')
    },
    {
      label: 'Tickets',
      icon: 'pi pi-ticket',
      command: () => window.open('https://www.ticketmaster.com/nfl-tickets/x1', '_blank')
    },
    {
      label: 'Pro Bowl',
      icon: 'pi pi-shield',
      command: () => window.open('https://www.nfl.com/pro-bowl/', '_blank')
    },
    {
      label: 'NFL Shop',
      icon: 'pi pi-shopping-cart',
      command: () => window.open('https://www.nflshop.com', '_blank')
    }
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
  
  // Large list of football fun facts
  private footballFacts = [
    "The first Super Bowl was played on January 15, 1967, between the Green Bay Packers and Kansas City Chiefs.",
    "The Vince Lombardi Trophy is made of sterling silver and weighs 7 pounds.",
    "Super Bowl Sunday is the second-largest day for food consumption in the U.S., after Thanksgiving.",
    "The NFL's huddle was invented by a deaf quarterback to prevent the other team from reading his sign language.",
    "The longest field goal in NFL history is 66 yards by Justin Tucker in 2021.",
    "The average lifespan of an NFL football is only one game.",
    "NFL footballs are manufactured in Ada, Ohio by Wilson Sporting Goods.",
    "Each Super Bowl team gets 108 footballs for practice leading up to the game.",
    "The New England Patriots have appeared in 11 Super Bowls, the most of any team.",
    "Tom Brady has won 7 Super Bowl championships, more than any player in history.",
    "The first televised NFL game was between the Brooklyn Dodgers and Philadelphia Eagles in 1939.",
    "The average NFL player's career lasts only about 3.3 years.",
    "An NFL football field is exactly 100 yards from goal line to goal line.",
    "The Pittsburgh Steelers have won 6 Super Bowl titles, tied for the most in NFL history.",
    "The halftime show performer doesn't get paid for the Super Bowl performance.",
    "Over 1.4 billion chicken wings are consumed during Super Bowl weekend.",
    "The Dallas Cowboys are worth over $8 billion, making them the most valuable NFL franchise.",
    "Referees in the NFL can make up to $200,000 per year.",
    "The Green Bay Packers are the only publicly-owned team in the NFL.",
    "NFL cheerleaders typically earn between $75-$150 per game.",
    "The Super Bowl ring can cost up to $36,500 each to produce.",
    "Americans eat roughly 11 million pounds of potato chips on Super Bowl Sunday.",
    "The first indoor Super Bowl was played in 1968 at the Louisiana Superdome... wait, that's wrong! It was in 2002 at the Louisiana Superdome (Super Bowl XXXVI was indoors at the Superdome in New Orleans).",
    "Actually, the first indoor Super Bowl was Super Bowl XII in 1978 at the Louisiana Superdome.",
    "A regulation NFL football is 11 inches long and weighs about 14-15 ounces.",
    "The fastest recorded NFL quarterback throw is 60 mph.",
    "NFL helmets are replaced every 10 years for safety reasons.",
    "The NFL draft was first held in 1936.",
    "Super Bowl commercials can cost up to $7 million for 30 seconds.",
    "The San Francisco 49ers have won 5 Super Bowl championships.",
    "The average NFL game lasts about 3 hours and 12 minutes.",
    "Only 8 teams have never appeared in a Super Bowl.",
    "The Pro Football Hall of Fame is located in Canton, Ohio.",
    "An NFL team can have up to 53 players on its active roster.",
    "The NFL season typically runs from September to early February.",
    "The New York Jets were the first AFL team to win a Super Bowl in 1969.",
    "Joe Montana has 4 Super Bowl rings and was MVP 3 times.",
    "The coldest NFL game ever played was -13°F in 1967 (the Ice Bowl).",
    "NFL goal posts are 18 feet 6 inches apart.",
    "The NFL was founded in 1920 as the American Professional Football Association.",
    "A touchdown is worth 6 points in American football.",
    "The quarterback is often considered the most important position in football.",
    "NFL players must wear specific protective equipment including helmets, shoulder pads, and mouthguards.",
    "The coin toss winner at the Super Bowl gets to choose whether to kick or receive.",
    "Each NFL team plays 17 regular season games as of 2021.",
    "The Super Bowl trophy is named after legendary coach Vince Lombardi.",
    "Brett Favre holds the record for most consecutive starts by an NFL quarterback with 297 games.",
    "The Buffalo Bills lost 4 consecutive Super Bowls from 1991-1994.",
    "NFL teams can challenge up to 2 plays per game via instant replay.",
    "The average weight of an NFL offensive lineman is over 300 pounds.",
    "Randy Moss holds the record for most receiving touchdowns in a rookie season with 17.",
    "The wildcat formation became popular in the NFL in 2008.",
    "Jerry Rice is widely considered the greatest wide receiver of all time.",
    "The NFL salary cap for 2024 is approximately $255 million per team.",
    "Super Bowl LI in 2017 featured the largest comeback in Super Bowl history (Patriots overcame 28-3 deficit).",
    "The average speed of an NFL running back is about 20 mph.",
    "NFL teams employ over 100 staff members including coaches, trainers, and support personnel.",
    "The forward pass was legalized in 1906, revolutionizing the game.",
    "Walter Payton rushed for 16,726 yards in his legendary career.",
    "The NFL uses a playoff system with 14 teams qualifying each year.",
    "Super Bowl rings are customized for each team and typically have over 100 diamonds.",
    "The Red Zone refers to the area inside the opponent's 20-yard line.",
    "NFL coaches can earn salaries exceeding $10 million per year.",
    "The NFL combine tests prospects on 40-yard dash, bench press, vertical jump, and more.",
    "Lambeau Field in Green Bay is one of the most iconic stadiums in the NFL.",
    "The 12th man refers to the fans and their impact on the game.",
    "NFL teams study thousands of hours of game film to prepare for opponents.",
    "The NFL has 32 teams divided into two conferences: AFC and NFC.",
    "Each conference has 4 divisions: North, South, East, and West.",
    "The Super Bowl is always played on a Sunday in early February.",
    "NFL footballs are brown and made of cowhide leather.",
    "The quarterback's cadence at the line can include real and fake signals.",
    "A safety is worth 2 points and is one of the rarest plays in football.",
    "The NFL has strict rules about player celebrations and taunting.",
    "Peyton Manning holds the record for most career passing touchdowns with 539.",
    "The tackle is the most common play in football.",
    "NFL players go through extensive physical training during the offseason.",
    "The Immaculate Reception is one of the most famous plays in NFL history.",
    "Concussion protocols have become increasingly important in the modern NFL.",
    "The NFL draft order is determined by the previous season's standings (worst teams pick first).",
    "Super Bowl Sunday is unofficially a national holiday in the United States.",
    "The Hail Mary is a desperation pass thrown into the end zone as time expires.",
    "NFL kickers have made field goals from over 60 yards multiple times in history.",
    "The tight end position combines aspects of both offensive line and receiver.",
    "NFL teams can franchise tag one player per year to prevent free agency.",
    "The NFL has expanded internationally with games played in London and Mexico City.",
    "Defensive coordinators are responsible for calling defensive plays.",
    "The run-pass option (RPO) has become increasingly popular in modern offenses.",
    "NFL players are required to wear league-approved cleats during games.",
    "The two-minute warning is a built-in timeout near the end of each half.",
    "Overtime rules in the NFL have evolved to make the game more fair.",
    "The NFL shield logo is one of the most recognizable sports logos in the world.",
    "Training camp begins in late July for most NFL teams.",
    "The preseason consists of 3 games before the regular season starts.",
    "NFL teams can trade draft picks and players with other teams.",
    "The black college All-Star game was an important precursor to NFL integration.",
    "NFL Films has documented professional football since 1962.",
    "The NFL Network provides 24/7 coverage of the league.",
    "Red zone efficiency is a key statistic for evaluating offensive performance.",
    "The nickel defense uses 5 defensive backs instead of the standard 4.",
    "Quarterbacks study defensive formations to identify coverages before the snap.",
    "The NFL uses a complex point system to determine draft compensation for lost free agents.",
    "Weather can have a significant impact on outdoor NFL games.",
    "The shotgun formation places the quarterback 5-7 yards behind the center.",
    "NFL teams have extensive medical staffs to treat and prevent injuries."
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
