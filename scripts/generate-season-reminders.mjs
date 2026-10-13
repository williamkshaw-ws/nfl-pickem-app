import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { postToBuffer, bufferRequest } from './buffer-post.mjs';

const publicDir = path.resolve(process.cwd(), 'public');

async function fetchLogoBase64(url) {
  if (!url) return '';
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
  } catch (err) {
    console.error('Failed to fetch logo:', url, err.message);
    return '';
  }
}

export async function fetchWeekGames(week) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=2026`;
  const res = await fetch(url);
  const data = await res.json();
  const events = data.events || [];

  const parsed = events.map(e => {
    const comp = e.competitions[0];
    const away = comp.competitors.find(c => c.homeAway === 'away');
    const home = comp.competitors.find(c => c.homeAway === 'home');
    return {
      date: new Date(e.date),
      away: {
        id: away.team.id,
        name: away.team.displayName,
        abbrev: away.team.abbreviation,
        logo: away.team.logo,
        record: away.records?.[0]?.summary || '3-2'
      },
      home: {
        id: home.team.id,
        name: home.team.displayName,
        abbrev: home.team.abbreviation,
        logo: home.team.logo,
        record: home.records?.[0]?.summary || '3-2'
      }
    };
  });

  parsed.sort((a, b) => a.date - b.date);
  return parsed;
}

export async function createWeeklyGraphic(week) {
  console.log(`Generating graphic for Week ${week}...`);
  const games = await fetchWeekGames(week);
  if (games.length < 2) {
    throw new Error(`Insufficient games found for Week ${week}`);
  }

  const g1 = games[0]; // Thursday kickoff
  const g2 = games[1]; // Next game (Sunday morning / early afternoon)

  const [g1AwayLogo, g1HomeLogo, g2AwayLogo, g2HomeLogo] = await Promise.all([
    fetchLogoBase64(g1.away.logo),
    fetchLogoBase64(g1.home.logo),
    fetchLogoBase64(g2.away.logo),
    fetchLogoBase64(g2.home.logo)
  ]);

  const g1TimeStr = 'Thu 8:15 PM';
  const g2TimeStr = 'Sun 9:30 AM';

  const cardW = 720;
  const cardH = 674;

  // 1. In-app dark mode card SVG
  const innerCardSvg = `
<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="appBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="100%" stop-color="#050b18" />
    </linearGradient>
    <linearGradient id="gameCardBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#091326" />
      <stop offset="100%" stop-color="#060c18" />
    </linearGradient>
  </defs>

  <rect width="${cardW}" height="${cardH}" fill="url(#appBg)" />

  <text x="32" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff">Week ${week} Picks</text>
  <text x="32" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="500" fill="#94a3b8">Picking as <tspan font-weight="700" fill="#ffffff">Joe</tspan></text>

  <!-- Survivor Status Banner -->
  <g transform="translate(32, 94)">
    <rect x="0" y="0" width="656" height="110" rx="18" fill="#02141c" stroke="#064e3b" stroke-width="1.5" />
    
    <g transform="translate(18, 18)">
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="140" height="36" rx="18" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
        <circle cx="20" cy="18" r="9" fill="none" stroke="#f97316" stroke-width="2" />
        <circle cx="20" cy="18" r="4.5" fill="none" stroke="#f97316" stroke-width="1.5" />
        <circle cx="20" cy="18" r="1.5" fill="#f97316" />
        <text x="38" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#ffffff" letter-spacing="1">SURVIVOR</text>
      </g>

      <g transform="translate(152, 0)">
        <rect x="0" y="0" width="180" height="36" rx="18" fill="#062d22" stroke="#10b981" stroke-width="1.2" />
        <circle cx="20" cy="18" r="4.5" fill="#10b981" />
        <text x="34" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#10b981" letter-spacing="1">YOU ARE ALIVE</text>
      </g>

      <g transform="translate(344, 0)">
        <rect x="0" y="0" width="200" height="36" rx="18" fill="#0b172a" stroke="#1e293b" stroke-width="1" />
        <path d="M16 11 L24 8 L32 11 L32 19 C32 24 24 28 24 28 C24 28 16 24 16 19 Z" fill="none" stroke="#94a3b8" stroke-width="1.5" />
        <text x="38" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94a3b8"><tspan font-weight="800" fill="#ffffff">4</tspan> of 5 survivors alive</text>
      </g>
    </g>

    <g transform="translate(20, 72)">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#f59e0b" stroke-width="1.8" />
      <line x1="12" y1="7" x2="12" y2="12" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" />
      <line x1="12" y1="12" x2="16" y2="12" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round" />
      <text x="28" y="16" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#94a3b8">Next kickoff: <tspan font-weight="800" fill="#ffffff">${g1TimeStr}</tspan></text>
    </g>
  </g>

  <!-- GAME 1 CARD -->
  <g transform="translate(32, 222)">
    <rect x="0" y="0" width="656" height="200" rx="18" fill="url(#gameCardBg)" stroke="#1e3a5f" stroke-width="1.5" />
    <g transform="translate(18, 14)">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="#64748b" stroke-width="1.4" />
      <line x1="8" y1="4.5" x2="8" y2="8" stroke="#64748b" stroke-width="1.4" />
      <line x1="8" y1="8" x2="11" y2="8" stroke="#64748b" stroke-width="1.4" />
      <text x="22" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#94a3b8">${g1TimeStr}</text>
    </g>
    <line x1="0" y1="36" x2="656" y2="36" stroke="#132742" stroke-width="1" />

    <g transform="translate(18, 48)">
      <rect x="0" y="0" width="46" height="46" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <image href="${g1AwayLogo}" x="5" y="5" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
      <text x="58" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff">${g1.away.name}</text>
      <text x="58" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">${g1.away.record}</text>
    </g>

    <line x1="18" y1="110" x2="638" y2="110" stroke="#132742" stroke-width="1" />

    <g transform="translate(18, 122)">
      <rect x="0" y="0" width="46" height="46" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <image href="${g1HomeLogo}" x="5" y="5" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
      <text x="58" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff">${g1.home.name}</text>
      <text x="58" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">${g1.home.record}</text>

      <g transform="translate(420, 8)">
        <rect x="0" y="0" width="135" height="36" rx="10" fill="#ea580c" />
        <circle cx="18" cy="18" r="8" fill="none" stroke="#ffffff" stroke-width="1.8" />
        <circle cx="18" cy="18" r="4" fill="none" stroke="#ffffff" stroke-width="1.4" />
        <circle cx="18" cy="18" r="1.5" fill="#ffffff" />
        <text x="34" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ffffff">Survivor</text>
      </g>

      <g transform="translate(570, 11)">
        <circle cx="15" cy="15" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
        <path d="M9 15 L13 19 L21 11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>
  </g>

  <!-- GAME 2 CARD -->
  <g transform="translate(32, 442)">
    <rect x="0" y="0" width="656" height="200" rx="18" fill="url(#gameCardBg)" stroke="#1e3a5f" stroke-width="1.5" />
    <g transform="translate(18, 14)">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="#64748b" stroke-width="1.4" />
      <line x1="8" y1="4.5" x2="8" y2="8" stroke="#64748b" stroke-width="1.4" />
      <line x1="8" y1="8" x2="11" y2="8" stroke="#64748b" stroke-width="1.4" />
      <text x="22" y="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#94a3b8">${g2TimeStr}</text>
    </g>
    <line x1="0" y1="36" x2="656" y2="36" stroke="#132742" stroke-width="1" />

    <g transform="translate(18, 48)">
      <rect x="0" y="0" width="46" height="46" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <image href="${g2AwayLogo}" x="5" y="5" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
      <text x="58" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff">${g2.away.name}</text>
      <text x="58" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">${g2.away.record}</text>

      <g transform="translate(385, 8)">
        <rect x="0" y="0" width="170" height="36" rx="10" fill="#0f1d33" stroke="#ea580c" stroke-width="1.2" />
        <circle cx="18" cy="18" r="8" fill="none" stroke="#ea580c" stroke-width="1.8" />
        <circle cx="18" cy="18" r="4" fill="none" stroke="#ea580c" stroke-width="1.4" />
        <circle cx="18" cy="18" r="1.5" fill="#ea580c" />
        <text x="34" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#ea580c">Make Survivor</text>
      </g>

      <g transform="translate(570, 11)">
        <circle cx="15" cy="15" r="14" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
        <path d="M9 15 L13 19 L21 11" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </g>
    </g>

    <line x1="18" y1="110" x2="638" y2="110" stroke="#132742" stroke-width="1" />

    <g transform="translate(18, 122)">
      <rect x="0" y="0" width="46" height="46" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
      <image href="${g2HomeLogo}" x="5" y="5" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
      <text x="58" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#ffffff">${g2.home.name}</text>
      <text x="58" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#64748b">${g2.home.record}</text>
    </g>
  </g>
</svg>
`;

  // Render the inner card with rounded corners
  const innerCardBuffer = await sharp(Buffer.from(innerCardSvg)).png().toBuffer();
  const roundedCardMask = Buffer.from(
    `<svg width="${cardW}" height="${cardH}">
      <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="18" ry="18" fill="#ffffff" />
    </svg>`
  );
  const roundedCard = await sharp(innerCardBuffer)
    .composite([{ input: roundedCardMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 2. Full 1080x1080 social template
  const bgWidth = 1080;
  const bgHeight = 1080;
  const cardTop = 195;
  const cardPaddingTop = 46;
  const cardPaddingBottom = 16;
  const cardTotalH = cardH + cardPaddingTop + cardPaddingBottom;
  const cardTotalW = 756;
  const cardLeft = (bgWidth - cardTotalW) / 2;
  const screenLeft = (bgWidth - cardW) / 2;
  const screenTop = cardTop + cardPaddingTop;

  const fullSvg = `
<svg width="${bgWidth}" height="${bgHeight}" viewBox="0 0 ${bgWidth} ${bgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="45%" stop-color="#0b132b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>

    <linearGradient id="glowTop" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#080c14" />
    </linearGradient>

    <filter id="phoneShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="#000000" flood-opacity="0.8" />
    </filter>
  </defs>

  <rect width="${bgWidth}" height="${bgHeight}" fill="url(#bgGrad)" />
  <circle cx="540" cy="110" r="420" fill="url(#glowTop)" />

  <g stroke="#1e293b" stroke-width="1.5" opacity="0.3">
    <line x1="0" y1="200" x2="1080" y2="200" />
    <line x1="0" y1="540" x2="1080" y2="540" />
    <line x1="0" y1="880" x2="1080" y2="880" />
    <line x1="200" y1="0" x2="200" y2="1080" />
    <line x1="880" y1="0" x2="880" y2="1080" />
  </g>

  <!-- Top Alert Pill -->
  <g transform="translate(365, 34)">
    <rect x="0" y="0" width="350" height="36" rx="18" fill="#451a03" stroke="#f59e0b" stroke-width="1.5" />
    <circle cx="20" cy="18" r="5" fill="#f59e0b" />
    <text x="36" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#fbbf24" letter-spacing="1.5">THURSDAY DEADLINE REMINDER</text>
  </g>

  <!-- Headline -->
  <g transform="translate(540, 114)">
    <text x="-24" y="0" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-1">
      Lock In Your Week ${week} Picks!
    </text>
    <g transform="translate(295, -28) rotate(35) scale(0.9)">
      <ellipse cx="0" cy="0" rx="24" ry="14" fill="#92400e" stroke="#fde68a" stroke-width="1.5" />
      <line x1="-12" y1="0" x2="12" y2="0" stroke="#ffffff" stroke-width="2" />
      <line x1="-8" y1="-5" x2="-8" y2="5" stroke="#ffffff" stroke-width="1.5" />
      <line x1="-3" y1="-5" x2="-3" y2="5" stroke="#ffffff" stroke-width="1.5" />
      <line x1="2" y1="-5" x2="2" y2="5" stroke="#ffffff" stroke-width="1.5" />
      <line x1="7" y1="-5" x2="7" y2="5" stroke="#ffffff" stroke-width="1.5" />
      <path d="M-18 -8 Q-16 0 -18 8" stroke="#ffffff" stroke-width="1.5" fill="none" />
      <path d="M18 -8 Q16 0 18 8" stroke="#ffffff" stroke-width="1.5" fill="none" />
    </g>
  </g>

  <text x="540" y="152" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="600" fill="#94a3b8" letter-spacing="-0.2">
    TNF kicks off at 8:15 PM ET • Don&apos;t miss the lock deadline
  </text>

  <!-- Window Frame -->
  <g transform="translate(${cardLeft}, ${cardTop})" filter="url(#phoneShadow)">
    <rect x="0" y="0" width="${cardTotalW}" height="${cardTotalH}" rx="28" fill="url(#cardGrad)" stroke="#334155" stroke-width="2" />
    <g transform="translate(24, 16)">
      <circle cx="6" cy="10" r="5" fill="#ef4444" opacity="0.8" />
      <circle cx="22" cy="10" r="5" fill="#f59e0b" opacity="0.8" />
      <circle cx="38" cy="10" r="5" fill="#10b981" opacity="0.8" />
      <g transform="translate(190, 0)">
        <rect x="0" y="0" width="320" height="22" rx="11" fill="#1e293b" stroke="#334155" stroke-width="1" />
        <circle cx="16" cy="11" r="3.5" fill="#10b981" />
        <text x="30" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#94a3b8">pocketpicks.app/league/picks</text>
      </g>
    </g>
  </g>

  <!-- Bottom CTA -->
  <g transform="translate(162, 952)">
    <rect x="0" y="0" width="756" height="74" rx="20" fill="#064e3b" stroke="#10b981" stroke-width="1.8" />
    <text x="378" y="32" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="1">SUBMIT YOUR PICKS BEFORE KICKOFF</text>
    <text x="378" y="56" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#a7f3d0">100% Free • Live ESPN Scoring • Play at pocketpicks.app</text>
  </g>

  <text x="540" y="1056" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#64748b" letter-spacing="1">
    @pocketpicksapp • pocketpicks.app
  </text>
</svg>
`;

  const fullBaseBuffer = await sharp(Buffer.from(fullSvg)).png().toBuffer();
  const outputPath = path.join(publicDir, `pocketpicks-week-${week}.png`);

  await sharp(fullBaseBuffer)
    .composite([
      {
        input: roundedCard,
        top: screenTop,
        left: screenLeft
      }
    ])
    .png()
    .toFile(outputPath);

  console.log(`Successfully generated Week ${week} graphic -> ${outputPath}`);
  return {
    outputPath,
    g1,
    g2
  };
}

// Kickoff date helper to get scheduled dueAt ISO time (Thursday 6:00 PM Eastern)
export function getThursdayScheduledDate(gameDate) {
  // gameDate is e.g. Friday 00:15 UTC (Thursday 8:15 PM ET)
  // We want Thursday 6:00 PM Eastern on that same Thursday!
  const d = new Date(gameDate);
  // Subtract 2 hours and 15 minutes from game kickoff to hit Thursday 6:00 PM ET
  const scheduledTimeMs = d.getTime() - (2 * 60 + 15) * 60 * 1000;
  return new Date(scheduledTimeMs).toISOString();
}

export function buildCaptions(week, g1) {
  const matchupText = `${g1.away.name} at ${g1.home.name}`;
  
  const twitterText = `🚨 Week ${week} Kickoff Reminder! 🚨

${matchupText} kicks off tonight at 8:15 PM ET!

Lock in your Week ${week} picks and make your Survivor selection before kickoff!

👉 https://pocketpicks.app

#NFL #NFLPickem #TNF`;

  const instagramText = `🚨 WEEK ${week} DEADLINE REMINDER 🚨

Thursday Night Football kicks off tonight with ${matchupText} at 8:15 PM ET! 🏈

Don't leave points on the table:
✅ Pick straight-up winners for every matchup
✅ Lock in your weekly Survivor / Eliminator team
✅ Set your tiebreaker score
✅ Hit save before Thursday kickoff locks!

100% free with real-time ESPN scoring all weekend long.

👉 Head to the link in our bio to submit your picks: pocketpicks.app

.
.
.
#NFL #TNF #ThursdayNightFootball #NFLPickem #FantasyFootball #SurvivorPool #FootballSeason #SportsTech #NFLWeekly #NFLSunday`;

  return { twitterText, instagramText };
}
