/* eslint-disable security/detect-non-literal-fs-filename, no-console */
/**
 * OAuth2 setup helper for Google Ads MCP Server.
 *
 * Usage: bun run scripts/setup-oauth.ts
 *
 * Prerequisites:
 * 1. Create OAuth2 Desktop credentials at https://console.cloud.google.com
 * 2. Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env
 *
 * This script will:
 * 1. Open browser for Google consent
 * 2. Start a local server to capture the authorization code
 * 3. Exchange code for refresh token
 * 4. Save refresh token to .env
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const envPath = resolve(import.meta.dirname, '../.env');

function loadEnv(): Map<string, string> {
  const env = new Map<string, string>();
  if (!existsSync(envPath)) {
    // Copy from .env.example
    const examplePath = resolve(import.meta.dirname, '../.env.example');
    if (existsSync(examplePath)) {
      writeFileSync(envPath, readFileSync(examplePath, 'utf-8'));
    }
  }
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }
      env.set(trimmed.slice(0, eqIndex).trim(), trimmed.slice(eqIndex + 1).trim());
    }
  }
  return env;
}

function saveEnvValue(key: string, value: string): void {
  let content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  writeFileSync(envPath, content);
}

const REDIRECT_PORT = 8089;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

async function main(): Promise<void> {
  const env = loadEnv();
  const clientId = env.get('GOOGLE_ADS_CLIENT_ID');
  const clientSecret = env.get('GOOGLE_ADS_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env');
    console.error('1. Go to https://console.cloud.google.com > APIs & Services > Credentials');
    console.error('2. Create OAuth 2.0 Client ID (type: Desktop App)');
    console.error('3. Add client_id and client_secret to .env');
    process.exit(1);
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\nOpening browser for Google OAuth2 consent...\n');
  console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

  // Open browser
  const { platform } = process;
  const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  const { exec } = await import('node:child_process');
  exec(`${openCmd} "${authUrl.toString()}"`);

  // Wait for callback
  const code = await new Promise<string>((resolve) => {
    const srv = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${REDIRECT_PORT}`);
      const authCode = url.searchParams.get('code');

      if (authCode) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');
        srv.close();
        resolve(authCode);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization failed</h1><p>No code received.</p>');
      }
    });
    srv.listen(REDIRECT_PORT);
    console.log(`Listening on http://localhost:${REDIRECT_PORT} for OAuth callback...\n`);
  });

  console.log('Exchanging authorization code for refresh token...');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error(`Token exchange failed: ${error}`);
    process.exit(1);
  }

  const { AuthCodeTokenResponseSchema } = await import('../src/schemas.js');
  const tokens = AuthCodeTokenResponseSchema.parse(await tokenResponse.json());

  if (!tokens.refresh_token) {
    console.error('No refresh token received. Try revoking access and running again.');
    process.exit(1);
  }

  saveEnvValue('GOOGLE_ADS_REFRESH_TOKEN', tokens.refresh_token);

  console.log('\nRefresh token saved to .env');
  console.log('\nSetup complete! Remaining steps:');
  console.log('1. Add your GOOGLE_ADS_DEVELOPER_TOKEN to .env');
  console.log('2. Add your GOOGLE_ADS_CUSTOMER_ID to .env');
  console.log('3. Restart Claude Code to load the MCP server');
}

main().catch(console.error);
