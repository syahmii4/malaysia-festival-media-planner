const FESTIVAL_SCHEMA = { type: 'object', properties: { festivals: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, event_date: { type: ['string', 'null'] }, date_status: { type: 'string', enum: ['confirmed', 'estimated', 'awaiting_announcement'] }, location: { type: 'string' }, source_url: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } }, required: ['name', 'description', 'event_date', 'date_status', 'location', 'source_url', 'confidence'], propertyOrdering: ['name', 'description', 'event_date', 'date_status', 'location', 'source_url', 'confidence'] } } }, required: ['festivals'], propertyOrdering: ['festivals'] };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
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
    const startedAt = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_DISCOVERY_MODEL || 'gemini-3.5-flash-lite'}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `Suggest important Malaysian public, cultural, religious, and community festivals in ${year}. Use your best available knowledge and prefer official Malaysian sources. Return only events relevant to a Malaysia-based media team. Do not invent dates. If an official date is not announced, use null and date_status awaiting_announcement. Include a likely official source URL for every candidate, but mark uncertain dates as estimated or awaiting_announcement. Exclude ordinary weekly markets and generic observances.` }] }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema: FESTIVAL_SCHEMA } }) });
    const body = await response.json();
    console.error('Gemini diagnostic:', { httpStatus: response.status, errorStatus: body.error?.status, errorMessage: body.error?.message, retryInfo: body.error?.details?.filter(item => item['@type']?.includes('RetryInfo')), durationMs: Date.now() - startedAt });
    if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: 'Gemini API request failed', details: body.error?.message || 'Unknown error' });
    const text = body.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || '{"festivals":[]}';
    return res.status(200).json(JSON.parse(text));
  } catch (error) { return res.status(500).json({ error: error.message || 'Discovery failed.' }); }
}
