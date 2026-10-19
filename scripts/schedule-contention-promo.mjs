import { bufferRequest, getChannels } from './buffer-post.mjs';

async function scheduleContentionPromo() {
  const channels = await getChannels();
  const twitterChannel = channels.find(c => c.service === 'twitter');
  const instagramChannel = channels.find(c => c.service === 'instagram');

  if (!twitterChannel || !instagramChannel) {
    throw new Error('Missing connected Twitter or Instagram channel in Buffer');
  }

  // Scheduled for Tuesday, Oct 20, 2026 at 10:30 AM EDT (14:30 UTC)
  const dueAt = '2026-10-20T14:30:00.000Z';

  const twitterImgUrl = 'https://raw.githubusercontent.com/williamkshaw-ws/nfl-pickem-app/main/public/pocketpicks-contention-tw.jpg';
  const instagramImgUrl = 'https://raw.githubusercontent.com/williamkshaw-ws/nfl-pickem-app/main/public/pocketpicks-contention-ig.jpg';

  const tweet1Text = `Week 6 reminded us why we love football:
⚡️ Walk-off FG in London
⚡️ Carolina stunning Philly
⚡️ Cleveland taking down Baltimore

If your pool leaderboard looked like a roller coaster Sunday afternoon, you shouldn't have to break out a spreadsheet to see if you can still win.`;

  const tweet2Text = `PocketPicks runs elimination math live after every whistle:

🎯 Spot who’s in contention vs. eliminated
📊 Filter active threats instantly
⏱️ 3-tier tiebreakers built right in

See why pool commissioners are switching 👉 pocketpicks.app

#NFL #NFLPickem #FantasyFootball`;

  const instagramText = `Walk-off field goals, upset wins, and Sunday chaos. Week 6 shook up almost every pool in America. 🏈💥

The worst part of managing or playing in a traditional pick’em pool? Doing mental gymnastics at 7 PM Sunday trying to calculate:
"Can I still catch 1st place if the underdog covers on Monday night?"

With PocketPicks, you never have to wonder. 

Our real-time Pick Matrix mathematically calculates contention after every final score:
🏆 Leader tracked live
🟢 Contenders clearly highlighted with real paths to win
🔴 Mathematically eliminated players separated automatically
⏱️ Deep tiebreakers (closest to final score + Monday night total) resolved instantly

Whether you're running Pick’em, Super Bowl Squares, or Playoff Brackets—upgrade your pool experience.

📲 Link in bio to explore leagues or set up your pool at pocketpicks.app!

.
.
.
#NFL #NFLPicks #PickemPool #FootballPool #Week6 #FantasyFootball #NFLSunday #SundayNightFootball #FootballSunday #SuperBowlSquares #SportsTech #PocketPicks`;

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            status
            dueAt
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const results = {};

  // 1. Schedule Twitter / 𝕏 Post
  console.log(`Scheduling Twitter post for ${dueAt}...`);
  const twitterInput = {
    channelId: twitterChannel.id,
    text: tweet1Text,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt,
    needsApproval: false,
    assets: [
      {
        image: {
          url: twitterImgUrl
        }
      }
    ],
    metadata: {
      twitter: {
        thread: [
          {
            text: tweet2Text
          }
        ]
      }
    }
  };

  const twRes = await bufferRequest(mutation, { input: twitterInput });
  if (twRes?.createPost?.message) {
    console.error('Twitter schedule failed:', twRes.createPost.message);
    results.twitter = { success: false, error: twRes.createPost.message };
  } else {
    console.log('✓ Twitter post scheduled successfully! ID:', twRes?.createPost?.post?.id);
    results.twitter = { success: true, post: twRes?.createPost?.post };
  }

  // 2. Schedule Instagram Post
  console.log(`Scheduling Instagram post for ${dueAt}...`);
  const igInput = {
    channelId: instagramChannel.id,
    text: instagramText,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt,
    needsApproval: false,
    assets: [
      {
        image: {
          url: instagramImgUrl
        }
      }
    ],
    metadata: {
      instagram: {
        type: 'post',
        shouldShareToFeed: true
      }
    }
  };

  const igRes = await bufferRequest(mutation, { input: igInput });
  if (igRes?.createPost?.message) {
    console.error('Instagram schedule failed:', igRes.createPost.message);
    results.instagram = { success: false, error: igRes.createPost.message };
  } else {
    console.log('✓ Instagram post scheduled successfully! ID:', igRes?.createPost?.post?.id);
    results.instagram = { success: true, post: igRes?.createPost?.post };
  }

  console.log('\nScheduling summary:', JSON.stringify(results, null, 2));
  return results;
}

scheduleContentionPromo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Scheduling failed:', err);
    process.exit(1);
  });
