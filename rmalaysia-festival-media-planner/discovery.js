const discoveryButton = document.getElementById('discoverFestivals');
if (discoveryButton) discoveryButton.onclick = async () => {
  const year = Number(prompt('Discover festivals for which year?', String(new Date().getFullYear() + 1)));
  if (!year || year < 2020 || year > 2100) return;
  discoveryButton.disabled = true; discoveryButton.textContent = 'Researching…';
  try {
    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    if (!sessionData.session) throw new Error('Sign in as a coordinator or admin first.');
    const result = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ year }) });
    const body = await result.json(); if (!result.ok) throw new Error(body.error || 'Discovery failed.');
    const chosen = (body.festivals || []).filter(item => confirm(`${item.name}\n${item.event_date || 'Date not announced'} · ${item.location}\nConfidence: ${item.confidence}\nSource: ${item.source_url}\n\nAdd this festival?`));
    if (!chosen.length || !window.supabaseClient) return;
    const rows = chosen.map(({ name, description, event_date, date_status, location, source_url }) => ({ name, description, event_date, date_status, location, source_url, ai_discovered: true }));
    const { error } = await window.supabaseClient.from('festivals').insert(rows); if (error) throw error;
    alert(`${chosen.length} festival${chosen.length === 1 ? '' : 's'} added for review.`); loadFestivals(); loadStats();
  } catch (error) { alert(error.message); } finally { discoveryButton.disabled = false; discoveryButton.textContent = 'Discover festivals'; }
};
