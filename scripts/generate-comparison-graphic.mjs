import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function generateComparisonGraphic(outputPath = null) {
  const targetOutput = outputPath || path.resolve(process.cwd(), 'public', 'pocketpicks-vs-legacy.png');

  const width = 1080;
  const height = 1080;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Background Gradient -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="50%" stop-color="#0b1329" />
        <stop offset="100%" stop-color="#030712" />
      </linearGradient>

      <!-- Emerald Glow Gradient -->
      <radialGradient id="topGlow" cx="50%" cy="0%" r="65%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="bottomGlow" cx="50%" cy="100%" r="50%">
        <stop offset="0%" stop-color="#065f46" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#065f46" stop-opacity="0" />
      </radialGradient>

      <!-- Card Background -->
      <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#111c33" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#0b1325" stop-opacity="0.95" />
      </linearGradient>

      <!-- Row Red tint -->
      <linearGradient id="legacyBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.04" />
      </linearGradient>

      <!-- Row Green tint -->
      <linearGradient id="pocketBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.06" />
      </linearGradient>
    </defs>

    <!-- Main Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
    <rect width="${width}" height="${height}" fill="url(#topGlow)" />
    <rect width="${width}" height="${height}" fill="url(#bottomGlow)" />

    <!-- Subtle Grid Lines -->
    <g opacity="0.06" stroke="#ffffff" stroke-width="1">
      <line x1="0" y1="270" x2="${width}" y2="270" />
      <line x1="0" y1="540" x2="${width}" y2="540" />
      <line x1="0" y1="810" x2="${width}" y2="810" />
      <line x1="270" y1="0" x2="270" y2="${height}" />
      <line x1="540" y1="0" x2="540" y2="${height}" />
      <line x1="810" y1="0" x2="810" y2="${height}" />
    </g>

    <!-- Header Section -->
    <g transform="translate(540, 75)" text-anchor="middle">
      <!-- Pill Badge -->
      <rect x="-140" y="0" width="280" height="36" rx="18" fill="#064e3b" stroke="#10b981" stroke-width="1.5" />
      <text x="0" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="900" fill="#34d399" letter-spacing="2">THE NFL PICK'EM STANDARD</text>

      <!-- Headline -->
      <text x="0" y="78" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-1">
        Legacy Sites vs. <tspan fill="#34d399">PocketPicks™</tspan>
      </text>

      <!-- Subtitle -->
      <text x="0" y="112" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="500" fill="#94a3b8">
        Why traditional office pool platforms are frustrating your players
      </text>
    </g>

    <!-- Table Container Card -->
    <rect x="60" y="215" width="960" height="740" rx="24" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="2" />

    <!-- Column Headers -->
    <g transform="translate(60, 215)">
      <rect x="0" y="0" width="960" height="60" rx="24" fill="#090d18" opacity="0.6" />
      <line x1="0" y1="60" x2="960" y2="60" stroke="#1e293b" stroke-width="1.5" />

      <!-- Left Column: Legacy Sites -->
      <text x="240" y="38" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="900" fill="#f87171" letter-spacing="1">
        ✕ TRADITIONAL / LEGACY SITES
      </text>

      <!-- Divider line between columns -->
      <line x1="480" y1="0" x2="480" y2="740" stroke="#1e293b" stroke-width="1.5" />

      <!-- Right Column: PocketPicks -->
      <text x="720" y="38" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="900" fill="#34d399" letter-spacing="1">
        ✓ POCKETPICKS™
      </text>
    </g>

    <!-- Row 1: Mobile UI & Ads (Y: 275 - 435, H: 160) -->
    <g transform="translate(60, 275)">
      <!-- Left side (Red) -->
      <rect x="15" y="12" width="450" height="136" rx="16" fill="url(#legacyBg)" stroke="#ef4444" stroke-opacity="0.3" stroke-width="1" />
      <text x="35" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#fca5a5">Overbloated &amp; Glitchy Mobile</text>
      <text x="35" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">Buries pools under sportsbook banners, auto-play</text>
      <text x="35" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">videos, and broken mobile drag-and-drop</text>
      <text x="35" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#f87171" font-weight="600">Requires horizontal pinch-to-zoom</text>

      <!-- Right side (Green) -->
      <rect x="495" y="12" width="450" height="136" rx="16" fill="url(#pocketBg)" stroke="#10b981" stroke-opacity="0.4" stroke-width="1.5" />
      <text x="515" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#34d399">100% Ad-Free Mobile-First PWA</text>
      <text x="515" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">Sleek midnight dark mode, blazing-fast 1-tap</text>
      <text x="515" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">picks, and zero annoying popups or ads</text>
      <text x="515" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#34d399" font-weight="700">Native app feel on iPhone &amp; Android</text>

      <line x1="0" y1="160" x2="960" y2="160" stroke="#1e293b" stroke-width="1" />
    </g>

    <!-- Row 2: Lockout Rules & Reminders (Y: 435 - 595, H: 160) -->
    <g transform="translate(60, 435)">
      <!-- Left side (Red) -->
      <rect x="15" y="12" width="450" height="136" rx="16" fill="url(#legacyBg)" stroke="#ef4444" stroke-opacity="0.3" stroke-width="1" />
      <text x="35" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#fca5a5">All-Or-Nothing Week Lockout</text>
      <text x="35" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">Miss Thursday kickoff? Locked out of the whole</text>
      <text x="35" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">week. No automated reminders leads to heavy</text>
      <text x="35" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#f87171" font-weight="600">midseason player dropouts</text>

      <!-- Right side (Green) -->
      <rect x="495" y="12" width="450" height="136" rx="16" fill="url(#pocketBg)" stroke="#10b981" stroke-opacity="0.4" stroke-width="1.5" />
      <text x="515" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#34d399">Game-by-Game Locks + Auto Nudges</text>
      <text x="515" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">Games lock individually at their respective kickoffs.</text>
      <text x="515" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">Automated emails alert players 2h before kickoff</text>
      <text x="515" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#34d399" font-weight="700">Nobody misses a Sunday again</text>

      <line x1="0" y1="160" x2="960" y2="160" stroke="#1e293b" stroke-width="1" />
    </g>

    <!-- Row 3: Visibility & Scoring (Y: 595 - 755, H: 160) -->
    <g transform="translate(60, 595)">
      <!-- Left side (Red) -->
      <rect x="15" y="12" width="450" height="136" rx="16" fill="url(#legacyBg)" stroke="#ef4444" stroke-opacity="0.3" stroke-width="1" />
      <text x="35" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#fca5a5">Hidden Picks &amp; Lagging Scores</text>
      <text x="35" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">Difficult to see what competitors picked once</text>
      <text x="35" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">kickoff starts. Scores lag behind live action</text>
      <text x="35" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#f87171" font-weight="600">Tiebreakers are opaque and confusing</text>

      <!-- Right side (Green) -->
      <rect x="495" y="12" width="450" height="136" rx="16" fill="url(#pocketBg)" stroke="#10b981" stroke-opacity="0.4" stroke-width="1.5" />
      <text x="515" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#34d399">Real-Time Matrix &amp; Live ESPN Feed</text>
      <text x="515" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">Full side-by-side pick matrix unlocks instantly at</text>
      <text x="515" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">kickoff so you know who to root against in real-time</text>
      <text x="515" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#34d399" font-weight="700">Clear 3-tier tiebreaker resolution</text>

      <line x1="0" y1="160" x2="960" y2="160" stroke="#1e293b" stroke-width="1" />
    </g>

    <!-- Row 4: Pricing & Commissioner Tools (Y: 755 - 915, H: 160) -->
    <g transform="translate(60, 755)">
      <!-- Left side (Red) -->
      <rect x="15" y="12" width="450" height="136" rx="16" fill="url(#legacyBg)" stroke="#ef4444" stroke-opacity="0.3" stroke-width="1" />
      <text x="35" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#fca5a5">Paywalls &amp; Per-Head Fees</text>
      <text x="35" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">Bait commissioners with "free trials" then lock</text>
      <text x="35" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">pools behind steep per-member paywalls</text>
      <text x="35" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#f87171" font-weight="600">Zero dues or Venmo payment tracking</text>

      <!-- Right side (Green) -->
      <rect x="495" y="12" width="450" height="136" rx="16" fill="url(#pocketBg)" stroke="#10b981" stroke-opacity="0.4" stroke-width="1.5" />
      <text x="515" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#34d399">100% Free Forever + Dues Tracker</text>
      <text x="515" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">Unlimited members with zero paywalls. Built-in</text>
      <text x="515" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#cbd5e1">commissioner ledger to track dues paid &amp; owed</text>
      <text x="515" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#34d399" font-weight="700">Commissioner override controls included</text>
    </g>

    <!-- Bottom Footer Bar -->
    <g transform="translate(540, 1005)" text-anchor="middle">
      <rect x="-240" y="-28" width="480" height="46" rx="23" fill="#059669" stroke="#10b981" stroke-width="1.5" />
      <text x="0" y="2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="0.5">
        Run Your League 100% Free &#8594; pocketpicks.app
      </text>
    </g>
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .png({ quality: 100 })
    .toFile(targetOutput);

  console.log(`Comparison graphic created at: ${targetOutput}`);
  return targetOutput;
}

if (process.argv[1]?.endsWith('generate-comparison-graphic.mjs')) {
  generateComparisonGraphic()
    .then((out) => console.log('Done:', out))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
