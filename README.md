# Gridiron Clash — NFL Weekly Pick'em League

A full-stack, responsive web application built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS** that lets you and your friends pick weekly NFL games straight-up, battle for weekly winner crowns using your custom **3-Tier Tiebreaker system**, and track cumulative picks for the overall season championship!

---

## 🏈 Key Features

### 1. Weekly Straight-Up Picks
- View all matchups for each NFL week with official team logos, records, betting lines, and game times.
- Interactive picking interface: click any team to lock in your pick with visual feedback.
- Completed games display final scores, highlight winning teams, and mark your picks as **Correct (+1)** or **Incorrect**.

### 2. 3-Tier Weekly Tiebreaker System
When two or more players tie with the most correct picks in a week, the weekly winner is determined using your exact 3-tier hierarchy:
1. **Tier 1 — Combined Total Points**: Closest to the designated game's actual combined score ($|\text{Predicted Total} - \text{Actual Total}|$).
2. **Tier 2 — Closest to Home Team Score**: If still tied on Tier 1, closest to the actual home team's points ($|\text{Predicted Home} - \text{Actual Home}|$).
3. **Tier 3 — Closest to Away Team Score**: If still tied on Tier 2, closest to the actual away team's points ($|\text{Predicted Away} - \text{Actual Away}|$).
*(If still tied after all 3 tiers, players are officially crowned co-winners).*

- **Auto-Calculated Total**: As you type your predicted Home and Away scores in the Tiebreaker Card, the app automatically calculates and displays the Combined Total in real time!

### 3. Weekly Leaderboard & Celebration Spotlight
- **Winner Spotlight**: Highlights the week's champion with their win percentage and celebratory confetti!
- **Tiebreaker Explanation**: Clearly displays *why* the winner edged out the runner-up (e.g. *"Won on Tier 1: Total Points diff: ±2 vs ±5"* or *"Tied on Total Points! Won on Tier 2: Home Team score diff: ±1 vs ±2"*).
- **Tiebreaker Metrics Table**: Displays predicted scores and exact delta values for Tier 1, Tier 2, and Tier 3 for every player.

### 4. Overall Season Standings & Championship Podium
- Tracks cumulative correct picks across all completed weeks.
- **Season Podium**: Top 3 season leaders featured with 🥇 Gold, 🥈 Silver, and 🥉 Bronze championship cards.
- **Cumulative Record**: Total correct picks, season accuracy percentage, and number of weekly titles won (e.g. 🏆 2 Weekly Titles).
- **Weekly Performance History**: Week-by-week badges showing individual scores and winner trophies.

### 5. Head-to-Head Pick Matrix
- Visual grid comparing all players side-by-side for every single matchup.
- Color-coded chips (Green check for correct, Red cross for incorrect, neutral for upcoming).
- Displays each player's tiebreaker predictions in the right-hand column.

### 6. Live ESPN NFL Sync + Commissioner Sandbox Hub
- **Sync with ESPN API**: Click **"Sync ESPN"** to fetch live schedules, scores, quarter clocks, and team logos directly from ESPN's public endpoints.
- **Commissioner Control Room**:
  - **Simulate Week Scores**: Instantly generate realistic scores for pending games to test weekly winners and tiebreaker rankings without waiting for Sunday.
  - **Manual Score Override**: Adjust any team's score, mark games as final, or designate which game serves as the tiebreaker.
  - **Toggle Kickoff Lock**: Enable or disable locking picks when games begin.
  - **Reset Week / Reset League**: Easily clear scores or restore demo seed data.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your web browser.

### 3. Build for Production
```bash
npm run build
npm start
```

---

## 🛠️ Project Structure

```
├── data/
│   └── league.json           # Persistent database for settings, users, games, and picks
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/        # Score simulation, game overrides, league reset
│   │   │   ├── league/       # Weekly results and season standings endpoint
│   │   │   ├── picks/        # Weekly picks and tiebreaker submission
│   │   │   ├── sync/         # Live ESPN scoreboard sync
│   │   │   └── users/        # Player profiles and active switcher
│   │   ├── globals.css       # Tailwind CSS styles
│   │   ├── layout.tsx        # App layout and metadata
│   │   └── page.tsx          # Main interactive dashboard
│   ├── components/
│   │   ├── Header.tsx            # League banner, week selector, profile switcher
│   │   ├── NavigationTabs.tsx    # Tab navigation (Picks, Weekly, Season, Matrix, Admin)
│   │   ├── WeeklyPicks.tsx       # Matchup cards & 3-Tier tiebreaker input
│   │   ├── WeeklyLeaderboard.tsx # Winner podium, confetti, tiebreaker breakdown
│   │   ├── OverallStandings.tsx  # Season cumulative championship leaderboard
│   │   ├── PickMatrix.tsx        # Side-by-side player pick comparison grid
│   │   └── CommissionerHub.tsx   # Commissioner controls, simulations, settings
│   ├── lib/
│   │   ├── espn.ts           # ESPN API integration and mock schedule generator
│   │   ├── scoring.ts        # Pure 3-Tier tiebreaker math and season standings engine
│   │   └── storage.ts        # Persistent JSON database with atomic file writes
│   └── types/
│       └── nfl.ts            # TypeScript definitions for teams, games, picks, and results
```
