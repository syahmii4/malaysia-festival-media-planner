const sampleFestivals=[
  {icon:'🪔',name:'Deepavali',date:'8 November 2026',detail:'National celebration · Poster deadline 18 Oct',status:'ongoing',label:'Ongoing'},
  {icon:'🌙',name:'Ramadan',date:'Expected February 2027',detail:'Islamic calendar · Planning soon',status:'pending',label:'Pending'},
  {icon:'🧧',name:'Chinese New Year',date:'6 February 2027',detail:'National celebration · Poster deadline 23 Jan',status:'pending',label:'Pending'},
  {icon:'☪️',name:'Aidiladha',date:'Expected May 2027',detail:'Islamic calendar · Awaiting official date',status:'pending',label:'Pending'}
];
const monthLabel=document.querySelector('.topbar .eyebrow');
if(monthLabel) monthLabel.textContent=new Intl.DateTimeFormat('en-MY',{month:'long',year:'numeric'}).format(new Date()).toUpperCase();
const festivalSection=document.querySelector('.festivals');
if(festivalSection) festivalSection.id='festivals';
const icons=['🪔','🌙','🧧','☪️','🎉','🌺'];
const supabaseClient = window.supabase && window.SUPABASE_CONFIG
  ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key)
  : null;
window.supabaseClient = supabaseClient;

function renderFestivals(festivals){
  document.getElementById('festivalList').innerHTML=festivals.map((f,i)=>{
    const eventDate=f.event_date ? new Date(f.event_date+'T00:00:00').toLocaleDateString('en-MY',{day:'numeric',month:'long',year:'numeric'}) : (f.date || 'Date to be announced');
    const status=(f.status || f.task_status || 'pending').toLowerCase();
    const label=status.charAt(0).toUpperCase()+status.slice(1);
    return `<div class="festival-row"><div class="festival-icon">${f.icon || icons[i%icons.length]}</div><div class="festival-info"><strong>${f.name}</strong><span>${eventDate} · ${f.location || f.detail || 'Malaysia-wide'}</span></div><span class="status ${status}">${label}</span></div>`;
  }).join('');
}

async function loadFestivals(){
  renderFestivals(sampleFestivals);
  if(!supabaseClient) return;
  const {data,error}=await supabaseClient.from('festivals').select('id,name,event_date,location,date_status').order('event_date',{ascending:true}).limit(8);
  if(!error && data && data.length){
    // Keep demo entries visible while the database is being populated.
    const remoteNames=new Set(data.map(item=>item.name.toLowerCase()));
    const demoOnly=sampleFestivals.filter(item=>!remoteNames.has(item.name.toLowerCase()));
    renderFestivals([...data,...demoOnly]);
  }
}
loadFestivals();
async function loadStats(){
  if(!supabaseClient) return;
  const today=new Date().toISOString().slice(0,10), end=new Date(Date.now()+90*86400000).toISOString().slice(0,10), yearStart=`${new Date().getFullYear()}-01-01`;
  const [upcoming,ongoing,completed]=await Promise.all([
    supabaseClient.from('festivals').select('id',{count:'exact',head:true}).gte('event_date',today).lte('event_date',end),
    supabaseClient.from('poster_tasks').select('id',{count:'exact',head:true}).eq('status','ongoing'),
    supabaseClient.from('poster_tasks').select('id',{count:'exact',head:true}).eq('status','done').gte('updated_at',yearStart)
  ]);
  const stats=document.querySelectorAll('.stats .stat strong');
  if(stats[0]) stats[0].textContent=upcoming.count??0;
  if(stats[1]) stats[1].textContent=ongoing.count??0;
  if(stats[2]) stats[2].textContent=completed.count??0;
}
loadStats();
async function loadDeadlines(){
  if(!supabaseClient) return;
  const {data,error}=await supabaseClient.from('poster_tasks').select('deadline,status,festivals(name),team_profiles(full_name,email)').not('deadline','is',null).neq('status','done').order('deadline').limit(3);
  if(error||!data?.length) return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const panel=document.querySelector('.deadlines');
  if(!panel) return;
  const rows=data.map(x=>{const d=new Date(x.deadline+'T00:00:00'),member=x.team_profiles?.full_name||x.team_profiles?.email||'Unassigned';return `<div class="deadline"><div class="date-badge"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString('en-MY',{month:'short'}).toUpperCase()}</span></div><div><strong>${esc(x.festivals?.name||'Poster task')}</strong><span>Assigned to ${esc(member)}</span></div><span class="tag ${x.status==='ongoing'?'soon':'later'}">${esc(x.status)}</span></div>`}).join('');
  panel.querySelectorAll('.deadline').forEach(x=>x.remove());
  panel.insertAdjacentHTML('beforeend',rows);
}
loadDeadlines();
const authPanel=document.createElement('div');
authPanel.className='auth-panel'; authPanel.hidden=true;
authPanel.innerHTML='<strong>Team login</strong><input id="authName" type="text" placeholder="Full name (for new account)"><input id="authEmail" type="email" placeholder="Email"><input id="authPassword" type="password" placeholder="Password"><button id="signIn">Sign in</button><button id="signUp">Create account</button><small id="authMessage"></small>';
document.body.appendChild(authPanel);
document.getElementById('loginButton').onclick=()=>authPanel.hidden=!authPanel.hidden;
document.getElementById('logoutButton').onclick=async()=>{await supabaseClient.auth.signOut()};
function updateAuth(session){const signedIn=!!session;document.getElementById('authStatus').textContent=signedIn?`Signed in: ${session.user.email}`:'Not signed in';document.getElementById('loginButton').hidden=signedIn;document.getElementById('logoutButton').hidden=!signedIn;authPanel.hidden=true}
if(supabaseClient){supabaseClient.auth.getSession().then(({data})=>updateAuth(data.session));supabaseClient.auth.onAuthStateChange((_event,session)=>updateAuth(session));document.getElementById('signIn').onclick=async()=>{const email=authEmail.value,password=authPassword.value;const {error}=await supabaseClient.auth.signInWithPassword({email,password});authMessage.textContent=error?error.message:'Signed in.'};document.getElementById('signUp').onclick=async()=>{const email=authEmail.value,password=authPassword.value,name=authName.value.trim();if(!name){authMessage.textContent='Enter your full name first.';return}const {error}=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name}}});authMessage.textContent=error?error.message:'Account created. Check your email if required.'}}
if(supabaseClient) supabaseClient.auth.onAuthStateChange(()=>{loadStats();loadDeadlines()});
async function applyPlanningPermissions(session){
  const button=document.getElementById('addFestival');
  if(!button||!session){return}
  const {data:profile}=await supabaseClient.from('team_profiles').select('role').eq('id',session.user.id).maybeSingle();
  if(profile?.role==='designer'){button.disabled=true;button.title='Only admins and coordinators can add festivals';const discover=document.getElementById('discoverFestivals');if(discover){discover.disabled=true;discover.title='Only admins and coordinators can discover festivals'}}
}
if(supabaseClient) supabaseClient.auth.getSession().then(({data})=>applyPlanningPermissions(data.session));
if(supabaseClient) supabaseClient.auth.onAuthStateChange((_event,session)=>applyPlanningPermissions(session));
const modal=document.getElementById('festivalModal');
document.getElementById('addFestival').onclick=()=>{modal.hidden=false};
document.getElementById('closeModal').onclick=()=>{modal.hidden=true};
document.getElementById('festivalForm').addEventListener('submit',async(e)=>{
  e.preventDefault(); const message=document.getElementById('formMessage');
  if(!supabaseClient){message.textContent='Supabase is not available.';return;}
  const form=new FormData(e.target); const record={name:form.get('name'),description:form.get('description'),event_date:form.get('event_date')||null,location:form.get('location')||'Malaysia',date_status:'confirmed'};
  const {error}=await supabaseClient.from('festivals').insert(record);
  if(error){message.textContent='Could not save: '+error.message;return;}
  modal.hidden=true; e.target.reset(); loadFestivals(); loadStats();
});
