export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(200).json({ ok: false, note: 'Resend not configured' });

  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid JSON' });

  const { name, email, archetype, variant, tagline, identity, fingerprint, growth, contradictions_count, shareUrl } = body;

  const fingerprintHTML = (fingerprint || []).map(f => `
    <tr>
      <td style="padding:8px 12px;color:#c9a96e;font-family:monospace;font-size:13px;">${f.label}</td>
      <td style="padding:8px 12px;color:#ffffff;font-family:sans-serif;font-size:13px;">${f.pole}</td>
      <td style="padding:8px 12px;color:#9d93e8;font-family:monospace;font-size:13px;text-align:right;">${Math.round((f.score || f.deviation || 0) * 10)}%</td>
    </tr>
  `).join('');

  // Growth entries are {title, text, practice} objects since Phase 8; older payloads hold strings.
  const growthHTML = (growth || []).map((g, i) => `
    <div style="margin-bottom:16px;padding:16px;background:rgba(157,147,232,0.08);border-left:3px solid #7c6fd4;border-radius:4px;">
      <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Growth Edge ${i + 1}${(g && typeof g === 'object' && g.title) ? ' · ' + g.title : ''}</div>
      <div style="color:#e8e6f0;font-family:sans-serif;font-size:14px;line-height:1.6;">${(g && typeof g === 'object') ? `${g.text || ''}${g.practice ? '<br><br><em>Try this: ' + g.practice + '</em>' : ''}` : g}</div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Phil OS Report</title>
</head>
<body style="margin:0;padding:0;background:#08061a;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:40px;">
    <div style="font-family:monospace;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:4px;">PHIL/OS</div>
    <div style="color:#c9a96e;font-family:monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Philosophical Operating System</div>
  </div>

  <!-- Greeting -->
  <div style="margin-bottom:32px;">
    <p style="color:#e8e6f0;font-size:16px;line-height:1.6;margin:0 0 8px 0;">Hey ${name},</p>
    <p style="color:#a09cb8;font-size:14px;line-height:1.6;margin:0;">Here is your complete Phil OS report. Keep this email — it is your permanent record.</p>
  </div>

  <!-- Archetype -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Your Archetype</div>
    <div style="color:#ffffff;font-size:26px;font-weight:700;margin-bottom:4px;">${archetype}</div>
    <div style="color:#c9a96e;font-size:14px;font-family:monospace;margin-bottom:16px;">${variant}</div>
    <div style="color:#e8e6f0;font-size:15px;line-height:1.7;font-style:italic;border-left:2px solid #c9a96e;padding-left:16px;">${tagline}</div>
  </div>

  <!-- Identity -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Who You Are</div>
    <div style="color:#e8e6f0;font-size:14px;line-height:1.8;">${(identity || '').replace(/\n/g, '<br><br>')}</div>
  </div>

  <!-- Fingerprint -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Philosophical Fingerprint</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <th style="padding:8px 12px;text-align:left;color:#555;font-family:monospace;font-size:11px;font-weight:400;">AXIS</th>
        <th style="padding:8px 12px;text-align:left;color:#555;font-family:monospace;font-size:11px;font-weight:400;">POSITION</th>
        <th style="padding:8px 12px;text-align:right;color:#555;font-family:monospace;font-size:11px;font-weight:400;">STRENGTH</th>
      </tr>
      ${fingerprintHTML}
    </table>
  </div>

  <!-- Growth -->
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:28px;margin-bottom:24px;">
    <div style="color:#9d93e8;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">Growth Edges</div>
    ${growthHTML}
  </div>

  ${contradictions_count > 0 ? `
  <!-- Contradictions -->
  <div style="background:rgba(224,120,74,0.08);border:1px solid rgba(224,120,74,0.3);border-radius:8px;padding:20px;margin-bottom:24px;">
    <div style="color:#e0784a;font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Philosophical Tensions Detected</div>
    <div style="color:#a09cb8;font-size:14px;line-height:1.6;">Your report identified <strong style="color:#e0784a;">${contradictions_count} tension${contradictions_count > 1 ? 's' : ''}</strong> in your belief system. View the full analysis in your report.</div>
  </div>
  ` : ''}

  ${shareUrl ? `
  <!-- Share URL -->
  <div style="margin-bottom:24px;padding:16px 20px;background:rgba(201,169,110,0.06);border:1px solid rgba(201,169,110,0.25);border-radius:8px;">
    <div style="font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a96e;margin-bottom:8px;">Your shareable report link</div>
    <a href="${shareUrl}" style="font-family:monospace;font-size:12px;color:#e8c97a;word-break:break-all;text-decoration:none;">${shareUrl}</a>
    <p style="color:#a09cb8;font-size:12px;margin-top:8px;margin-bottom:0;">Anyone with this link can view your full report, including your scores and archetype, without signing in. Only share it with people you trust.</p>
  </div>
  ` : ''}

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:40px;">
    <a href="${shareUrl || 'https://philos-jade.vercel.app'}" style="display:inline-block;background:#c9a96e;color:#08061a;font-family:monospace;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:14px 32px;border-radius:4px;text-decoration:none;">VIEW YOUR FULL REPORT</a>
    <p style="color:#555;font-size:12px;margin-top:16px;">philos-jade.vercel.app</p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:24px;text-align:center;">
    <div style="color:#444;font-family:monospace;font-size:11px;letter-spacing:2px;">PHIL/OS · thelifepm.com</div>
    <p style="color:#333;font-size:11px;margin-top:8px;">You received this because you completed the Phil OS assessment.<br>156 questions · 34 belief axes · your archetype.</p>
  </div>

</div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Phil OS <andre@thelifepm.com>',
        to: email,
        subject: `${name}, your Phil OS report — ${archetype}`,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Resend error:', text);
      return res.status(200).json({ ok: false, note: text });
    }

    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error('Email error:', e.message);
    return res.status(200).json({ ok: false, error: e.message });
  }
}
