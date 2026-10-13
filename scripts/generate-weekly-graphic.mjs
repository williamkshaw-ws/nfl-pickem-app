import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Weekly Post Graphic Generator for PocketPicks Socials
 * 
 * Takes an authentic screenshot from the app and frames it inside
 * a branded, high-resolution 1080x1080 graphic with stadium glow,
 * customizable header (headline, kickoff, alert pill), window frame,
 * and bottom call-to-action button.
 * 
 * Usage:
 *   node scripts/generate-weekly-graphic.mjs [options]
 * 
 * Examples:
 *   node scripts/generate-weekly-graphic.mjs --week 7 --headline "Lock In Your Week 7 Picks!"
 *   node scripts/generate-weekly-graphic.mjs --screenshot ./my-screenshot.png --out public/week7.png
 */

export async function generateWeeklyGraphic({
  week = 6,
  headline = null,
  subtitle = null,
  pillText = 'THURSDAY DEADLINE REMINDER',
  screenshotPath = null,
  outputPath = null
} = {}) {
  const defaultScreenshot = path.resolve(process.cwd(), 'public', 'pocketpicks-my-picks.png');
  const inputScreenshot = screenshotPath || defaultScreenshot;
  const targetOutput = outputPath || path.resolve(process.cwd(), 'public', 'pocketpicks-weekly-graphic.png');

  if (!fs.existsSync(inputScreenshot)) {
    throw new Error(`Screenshot not found at: ${inputScreenshot}`);
  }

  const finalHeadline = headline || `Lock In Your Week ${week} Picks!`;
  const finalSubtitle = subtitle || `TNF kicks off at 8:15 PM ET • Don't miss the lock deadline`;

  const bgWidth = 1080;
  const bgHeight = 1080;

  // 1. Process screenshot: resize cleanly to fit the card frame (width = 720)
  const screenTargetW = 720;
  const meta = await sharp(inputScreenshot).metadata();
  const screenTargetH = Math.round((screenTargetW / meta.width) * meta.height);

  // Add smooth rounded corners to the screenshot
  const roundedCornersMask = Buffer.from(
    `<svg width="${screenTargetW}" height="${screenTargetH}">
      <rect x="0" y="0" width="${screenTargetW}" height="${screenTargetH}" rx="18" ry="18" fill="#ffffff" />
    </svg>`
  );

  const roundedScreenshot = await sharp(inputScreenshot)
    .resize(screenTargetW, screenTargetH, { kernel: 'lanczos3' })
    .composite([{ input: roundedCornersMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Layout calculations
  const cardTop = 195;
  const cardPaddingTop = 46;
  const cardPaddingBottom = 16;
  const cardHeight = screenTargetH + cardPaddingTop + cardPaddingBottom;
  const cardWidth = 756;
  const cardLeft = (bgWidth - cardWidth) / 2; // 162
  const screenLeft = (bgWidth - screenTargetW) / 2; // 180
  const screenTop = cardTop + cardPaddingTop;

  // 2. Base SVG template with glowing background, header, window frame, and CTA footer
  const svg = `
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

    <linearGradient id="emeraldBtn" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="0%" stop-color="#059669" />
    </linearGradient>

    <filter id="phoneShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="28" flood-color="#000000" flood-opacity="0.8" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${bgWidth}" height="${bgHeight}" fill="url(#bgGrad)" />

  <!-- Stadium Ambient Lights -->
  <circle cx="540" cy="110" r="420" fill="url(#glowTop)" />

  <!-- Subtle Turf Yard Lines -->
  <g stroke="#1e293b" stroke-width="1.5" opacity="0.3">
    <line x1="0" y1="200" x2="1080" y2="200" />
    <line x1="0" y1="540" x2="1080" y2="540" />
    <line x1="0" y1="880" x2="1080" y2="880" />
    <line x1="200" y1="0" x2="200" y2="1080" />
    <line x1="880" y1="0" x2="880" y2="1080" />
  </g>

  <!-- ========================================== -->
  <!-- HEADER SECTION -->
  <!-- ========================================== -->

  <!-- Top Alert Pill -->
  <g transform="translate(365, 34)">
    <rect x="0" y="0" width="350" height="36" rx="18" fill="#451a03" stroke="#f59e0b" stroke-width="1.5" />
    <circle cx="20" cy="18" r="5" fill="#f59e0b" />
    <text x="36" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="900" fill="#fbbf24" letter-spacing="1.5">${pillText}</text>
  </g>

  <!-- Main Headline with Crisp SVG Football -->
  <g transform="translate(540, 114)">
    <text x="-24" y="0" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" letter-spacing="-1">
      ${finalHeadline}
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
    ${finalSubtitle}
  </text>

  <!-- ========================================== -->
  <!-- PHONE / BROWSER CARD FRAME -->
  <!-- ========================================== -->
  <g transform="translate(${cardLeft}, ${cardTop})" filter="url(#phoneShadow)">
    <rect x="0" y="0" width="${cardWidth}" height="${cardHeight}" rx="28" fill="url(#cardGrad)" stroke="#334155" stroke-width="2" />
    
    <!-- App Window Header Bar -->
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

  <!-- ========================================== -->
  <!-- BOTTOM BRAND & CALL TO ACTION -->
  <!-- ========================================== -->
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

  // 3. Composite base SVG + rounded screenshot
  const baseImgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  await sharp(baseImgBuffer)
    .composite([
      {
        input: roundedScreenshot,
        top: screenTop,
        left: screenLeft
      }
    ])
    .png()
    .toFile(targetOutput);

  console.log(`Generated graphic successfully -> ${targetOutput}`);
  return targetOutput;
}

// CLI handler
if (process.argv[1]?.endsWith('generate-weekly-graphic.mjs')) {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week') parsed.week = parseInt(args[++i], 10);
    else if (args[i] === '--headline') parsed.headline = args[++i];
    else if (args[i] === '--subtitle') parsed.subtitle = args[++i];
    else if (args[i] === '--pill') parsed.pillText = args[++i];
    else if (args[i] === '--screenshot') parsed.screenshotPath = args[++i];
    else if (args[i] === '--out') parsed.outputPath = args[++i];
  }

  generateWeeklyGraphic(parsed)
    .then(p => {
      console.log(`Done! Image ready at ${p}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
