export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ ok: true, note: 'Supabase not configured' });
  }

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  // Split responses out — rest goes to completions table
  const { responses, ...completionData } = body;

  try {
    // Save completion — return=representation so we get the id back
    const completionResponse = await fetch(`${supabaseUrl}/rest/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(completionData),
    });

    if (!completionResponse.ok) {
      const text = await completionResponse.text();
      console.error('Supabase completions error:', text);
      return res.status(200).json({ ok: false, note: text });
    }

    const completionRows = await completionResponse.json();
    const completionId = completionRows[0]?.id;

    // Save responses if present and we have a completion id
    if (completionId && responses && responses.length > 0) {
      const responseRows = responses.map(r => ({
        ...r,
        completion_id: completionId
      }));

      const responsesResponse = await fetch(`${supabaseUrl}/rest/v1/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(responseRows),
      });

      if (!responsesResponse.ok) {
        const text = await responsesResponse.text();
        // Log but don't fail — completion is already saved
        console.error('Supabase responses error:', text);
      }
    }

    return res.status(200).json({ ok: true, completion_id: completionId });

  } catch (e) {
    console.error('Capture error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
