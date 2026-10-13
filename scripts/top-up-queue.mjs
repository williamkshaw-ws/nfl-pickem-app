import fs from 'fs';
import path from 'path';
import { scheduleWeekReminder } from './generate-season-reminders.mjs';

const logPath = path.resolve(process.cwd(), 'scripts', 'scheduled-season-log.json');

export async function topUpBufferQueue() {
  if (!fs.existsSync(logPath)) {
    console.error('Log file not found at:', logPath);
    return;
  }

  const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
  const now = new Date();

  // Count how many scheduled weeks have not yet passed
  const pendingWeeks = Object.entries(log.scheduledWeeks).filter(([_, info]) => {
    return new Date(info.dueAt) > now;
  });

  console.log(`Currently pending weeks in queue: ${pendingWeeks.length}/10`);

  // If there are free slots and remaining weeks to schedule
  while (pendingWeeks.length < 10 && log.remainingWeeks.length > 0) {
    const nextWeek = log.remainingWeeks.shift();
    console.log(`\nAvailable queue slot found! Scheduling Week ${nextWeek}...`);
    try {
      const res = await scheduleWeekReminder(nextWeek);
      const post = res[0]?.post;
      log.scheduledWeeks[nextWeek.toString()] = {
        dueAt: post?.dueAt || 'scheduled',
        matchup: `Week ${nextWeek}`
      };
      pendingWeeks.push([nextWeek.toString(), log.scheduledWeeks[nextWeek.toString()]]);
      console.log(`Successfully scheduled Week ${nextWeek}!`);
    } catch (err) {
      console.error(`Failed to schedule Week ${nextWeek}:`, err.message);
      // Put it back
      log.remainingWeeks.unshift(nextWeek);
      break;
    }
  }

  log.updatedAt = new Date().toISOString();
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log('Season schedule log updated successfully!');
}

if (process.argv[1]?.endsWith('top-up-queue.mjs')) {
  topUpBufferQueue()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
