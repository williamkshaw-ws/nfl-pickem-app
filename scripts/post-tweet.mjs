import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function buildOAuthHeader(method, url, consumerKey, consumerSecret, token, tokenSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: token,
    oauth_version: '1.0'
  };

  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');

  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  oauthParams.oauth_signature = signature;

  const authHeaderParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`);

  return `OAuth ${authHeaderParts.join(', ')}`;
}

export async function postTweet(text) {
  if (!text || !text.trim()) {
    throw new Error('Tweet text cannot be empty');
  }

  const env = getEnvVars();
  const endpoint = 'https://api.twitter.com/2/tweets';
  
  const authHeader = buildOAuthHeader(
    'POST',
    endpoint,
    env.TWITTER_API_KEY,
    env.TWITTER_API_SECRET,
    env.TWITTER_ACCESS_TOKEN,
    env.TWITTER_ACCESS_TOKEN_SECRET
  );

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: text.trim() })
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to post tweet: ${res.status} ${JSON.stringify(json)}`);
  }

  console.log(`Tweet posted successfully! ID: ${json.data.id}`);
  console.log(`URL: https://x.com/pocketpicksapp/status/${json.data.id}`);
  return json.data;
}

// CLI usage: node scripts/post-tweet.mjs "Your tweet message"
if (process.argv[1]?.endsWith('post-tweet.mjs')) {
  const tweetText = process.argv.slice(2).join(' ');
  if (!tweetText) {
    console.error('Usage: node scripts/post-tweet.mjs "Your tweet text here"');
    process.exit(1);
  }
  postTweet(tweetText)
    .then((data) => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
