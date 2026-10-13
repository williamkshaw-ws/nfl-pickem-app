import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');

function getEnvVars() {
  const content = fs.readFileSync(envPath, 'utf-8');
  const vars = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[match[1]] = val;
    }
  }
  return vars;
}

export async function bufferRequest(query, variables = {}) {
  const env = getEnvVars();
  const apiKey = env.BUFFER_API_KEY;
  if (!apiKey) throw new Error('Missing BUFFER_API_KEY in .env.local');

  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Buffer API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function getChannels() {
  const accountData = await bufferRequest(`
    query GetOrganizations {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);

  const orgId = accountData?.account?.organizations?.[0]?.id;
  if (!orgId) throw new Error('No organization found in Buffer account');

  const channelData = await bufferRequest(`
    query GetChannels($input: ChannelsInput!) {
      channels(input: $input) {
        id
        name
        service
      }
    }
  `, { input: { organizationId: orgId } });

  return channelData?.channels || [];
}

export async function postToBuffer({ text, channels = ['all'], mode = 'shareNow', mediaUrl = null }) {
  const allChannels = await getChannels();
  const targetChannels = allChannels.filter(c => channels.includes('all') || channels.includes(c.service));

  if (targetChannels.length === 0) {
    throw new Error(`No connected channels matching: ${channels.join(', ')}`);
  }

  const results = [];

  for (const channel of targetChannels) {
    console.log(`Publishing to ${channel.service} (@${channel.name})...`);

    const mutation = `
      mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess {
            post {
              id
              text
              status
            }
          }
          ... on MutationError {
            message
          }
        }
      }
    `;

    const input = {
      channelId: channel.id,
      text: text.trim(),
      schedulingType: 'automatic',
      mode: mode,
      needsApproval: false
    };

    if (mediaUrl) {
      input.assets = [
        {
          image: {
            url: mediaUrl
          }
        }
      ];
    }

    if (channel.service === 'instagram') {
      input.metadata = {
        instagram: {
          type: 'post',
          shouldShareToFeed: true
        }
      };
    }

    const res = await bufferRequest(mutation, { input });
    const postRes = res?.createPost;

    if (postRes?.message) {
      console.error(`Failed on ${channel.service}: ${postRes.message}`);
      results.push({ channel: channel.service, success: false, error: postRes.message });
    } else {
      console.log(`Successfully published to ${channel.service}! Post ID: ${postRes?.post?.id}`);
      results.push({ channel: channel.service, success: true, post: postRes?.post });
    }
  }

  return results;
}

// CLI usage:
// node scripts/buffer-post.mjs "Post text" "https://optional.url/image.png" "all|twitter|instagram"
if (process.argv[1]?.endsWith('buffer-post.mjs')) {
  const text = process.argv[2];
  const mediaUrl = process.argv[3] || null;
  const channelArg = process.argv[4] || 'all';

  if (!text) {
    console.error('Usage: node scripts/buffer-post.mjs "Post text" [mediaUrl] [channel: all|twitter|instagram]');
    process.exit(1);
  }

  const channels = channelArg === 'all' ? ['all'] : channelArg.split(',');

  postToBuffer({ text, channels, mode: 'shareNow', mediaUrl })
    .then(r => {
      console.log('Results summary:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
