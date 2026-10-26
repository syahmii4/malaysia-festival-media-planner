const FESTIVAL_SCHEMA = { type: 'object', additionalProperties: false, properties: { festivals: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, description: { type: 'string' }, event_date: { type: ['string', 'null'] }, date_status: { type: 'string', enum: ['confirmed', 'estimated', 'awaiting_announcement'] }, location: { type: 'string' }, source_url: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['name', 'description', 'event_date', 'date_status', 'location', 'source_url', 'confidence'] } } }, required: ['festivals'] };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured.' });
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!token || !process.env.SUPABASE_URL || !supabaseKey) return res.status(401).json({ error: 'Sign in is required.' });
    const userResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } });
    const user = await userResponse.json();
    if (!userResponse.ok || !user.id) return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    const profileResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/team_profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } });
    const profiles = await profileResponse.json();
    if (!profiles[0] || !['admin', 'coordinator'].includes(profiles[0].role)) return res.status(403).json({ error: 'Only admins and coordinators can discover festivals.' });
    const year = Number(req.body?.year) || new Date().getUTCFullYear() + 1;
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_DISCOVERY_MODEL || 'gpt-4.1-mini', tools: [{ type: 'web_search_preview' }], input: `Find important Malaysian public, cultural, religious, and community festivals in ${year}. Use authoritative sources and return only events relevant to a Malaysia-based media team. Do not invent dates. If an official date is not announced, use null and date_status awaiting_announcement. Include one direct source URL for every candidate. Exclude ordinary weekly markets and generic observances.`, text: { format: { type: 'json_schema', name: 'malaysia_festivals', strict: true, schema: FESTIVAL_SCHEMA } } }) });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: body.error?.message || 'Discovery request failed.' });
    return res.status(200).json(JSON.parse(body.output_text || '{"festivals":[]}'));
  } catch (error) { return res.status(500).json({ error: error.message || 'Discovery failed.' }); }
}
