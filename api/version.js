export const config = { maxDuration: 10 };

// QA/debug infrastructure only - not instrument-governed content.
// Returns build/deployment identity read fresh from Vercel's runtime env vars
// on every request, so it can never drift from what is actually deployed.
// Requires "Enable access to System Environment Variables" in the Vercel
// project settings - if commitSha comes back "unknown", check that setting
// before assuming this code is wrong.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const fullSha = process.env.VERCEL_GIT_COMMIT_SHA || '';

  return res.status(200).json({
    build: {
      commitSha: fullSha ? fullSha.slice(0, 7) : 'unknown',
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || 'unknown',
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'unknown',
      environment: process.env.VERCEL_ENV || 'unknown',
      checkedAt: new Date().toISOString(),
    },
  });
}
