const client=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.key);
const select=document.getElementById('festivalSelect'), assignee=document.getElementById('assignedTo');
document.getElementById('deadline').min=new Date().toISOString().slice(0,10);
document.getElementById('posterFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;const message=document.getElementById('taskMessage');if(file.size>10*1024*1024){message.textContent='Poster must be 10 MB or smaller.';e.target.value='';return}if(!['image/','application/pdf'].some(type=>file.type.startsWith(type))){message.textContent='Upload an image or PDF poster.';e.target.value='';return}const {data:{user}}=await client.auth.getUser();if(!user)return;const path=`${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const upload=await client.storage.from('posters').upload(path,file,{upsert:false});if(upload.error){message.textContent=upload.error.message;return}document.getElementById('posterUrl').value=client.storage.from('posters').getPublicUrl(path).data.publicUrl;message.textContent='Poster uploaded.'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
  const session=await client.auth.getSession();
  if(!session.data.session){
    document.getElementById('taskList').innerHTML='<p class="empty">Please sign in from the dashboard to view poster tasks.</p>';
    document.getElementById('newTask').disabled=true;
    return;
  }
  const [festivals,profiles]=await Promise.all([client.from('festivals').select('id,name').order('event_date'),client.from('team_profiles').select('id,full_name,email,role').order('full_name')]);
  select.innerHTML=(festivals.data||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
  assignee.innerHTML='<option value="">Unassigned</option>'+(profiles.data||[]).map(x=>`<option value="${x.id}">${esc(x.full_name||x.email)}${x.role?` · ${esc(x.role)}`:''}</option>`).join('');
  const currentProfile=(profiles.data||[]).find(x=>x.id===session.data.session.user.id);
  if(currentProfile?.role==='designer'){const button=document.getElementById('newTask');button.disabled=true;button.title='Only admins and coordinators can create tasks';}
  const result=await client.from('poster_tasks').select('id,deadline,status,assigned_to,poster_url,notes,festivals(name),team_profiles(full_name,email,role)').order('deadline'), today=new Date().toISOString().slice(0,10);
  const rows=result.data||[];
  const counts={pending:0,ongoing:0,done:0,overdue:0};
  rows.forEach(x=>{const s=x.status!=='done'&&x.deadline&&x.deadline<today?'overdue':x.status;if(counts[s]!==undefined)counts[s]++});
  let summary=document.getElementById('taskSummary');
  if(!summary){summary=document.createElement('p');summary.id='taskSummary';summary.className='task-summary';document.querySelector('.panel-heading')?.appendChild(summary)}
  summary.textContent=`${counts.pending} pending · ${counts.ongoing} ongoing · ${counts.done} done · ${counts.overdue} overdue`;
  document.getElementById('taskList').innerHTML=rows.length?rows.map(x=>{const status=x.status!=='done'&&x.deadline&&x.deadline<today?'overdue':x.status,member=x.team_profiles?.full_name||x.team_profiles?.email||'Unassigned',role=x.team_profiles?.role;return `<div class="task-row"><div><strong>${esc(x.festivals?.name||'Festival')}</strong><small>${x.deadline||'No deadline'}${x.notes?` · ${esc(x.notes)}`:''}</small></div><div>${esc(member)}${role?`<small>${esc(role)}</small>`:''}</div><div>${x.poster_url?`<a href="${esc(x.poster_url)}" target="_blank" rel="noopener">Open poster</a>`:'No poster link'}</div><select class="task-status ${status}" data-id="${x.id}"><option value="pending" ${status==='pending'?'selected':''}>pending</option><option value="ongoing" ${status==='ongoing'?'selected':''}>ongoing</option><option value="done" ${status==='done'?'selected':''}>done</option><option value="overdue" ${status==='overdue'?'selected':''}>overdue</option></select></div>`}).join(''):'<p class="empty">No tasks yet.</p>';
}
document.getElementById('newTask').onclick=()=>document.getElementById('taskFormPanel').hidden=!document.getElementById('taskFormPanel').hidden;
document.getElementById('taskForm').onsubmit=async e=>{e.preventDefault();const record={festival_id:select.value,deadline:document.getElementById('deadline').value,poster_url:document.getElementById('posterUrl').value||null,notes:document.getElementById('taskNotes').value.trim()||null,status:'pending',assigned_to:assignee.value||null};const result=await client.from('poster_tasks').insert(record);document.getElementById('taskMessage').textContent=result.error?result.error.message:'Task saved';if(!result.error){e.target.reset();load()}};
document.addEventListener('change',async e=>{if(e.target.matches('.task-status')){await client.from('poster_tasks').update({status:e.target.value,updated_at:new Date().toISOString()}).eq('id',e.target.dataset.id);load()}});
load();
const filter=document.createElement('select');
filter.id='statusFilter';
filter.setAttribute('aria-label','Filter tasks');
filter.innerHTML='<option value="all">All statuses</option><option value="pending">Pending</option><option value="ongoing">Ongoing</option><option value="done">Done</option><option value="overdue">Overdue</option>';
document.querySelector('.panel-heading')?.appendChild(filter);
filter.onchange=()=>{const q=(document.getElementById('taskSearch')?.value||'').toLowerCase();document.querySelectorAll('.task-status').forEach(s=>{const row=s.closest('.task-row');row.hidden=(filter.value!=='all'&&!s.classList.contains(filter.value))||(q&&!row.textContent.toLowerCase().includes(q))})};
const search=document.createElement('input');
search.id='taskSearch';
search.placeholder='Search tasks';
search.setAttribute('aria-label','Search tasks');
document.querySelector('.panel-heading')?.appendChild(search);
search.oninput=()=>{const q=search.value.toLowerCase();document.querySelectorAll('#taskList .task-row').forEach(row=>{const status=row.querySelector('.task-status');row.hidden=!row.textContent.toLowerCase().includes(q)||(filter.value!=='all'&&!status.classList.contains(filter.value))})};
