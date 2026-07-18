const platforms = [
  {id:'muse',name:'Muse Asia',initials:'MUSE',tagline:'Free licensed anime on YouTube',regions:['India'],types:['anime'],ads:'okay',url:'https://www.youtube.com/@MuseAsia',color:'#e44d78',verified:'Official anime licensor'},
  {id:'anione',name:'Ani-One Asia',initials:'A1',tagline:'Seasonal anime + full episodes',regions:['India'],types:['anime'],ads:'okay',url:'https://www.youtube.com/@AniOneAsia',color:'#8554dd',verified:'Official Medialink channel'},
  {id:'viki',name:'Rakuten Viki',initials:'V',tagline:'Free Asian dramas with ads',regions:['India','United States','United Kingdom','Global'],types:['korean','japanese'],ads:'okay',url:'https://www.viki.com/categories/watch-free/genre/all',color:'#0db6d6',verified:'Free catalog varies by region'},
  {id:'kbs',name:'KBS World',initials:'KBS',tagline:'Korean drama + entertainment',regions:['India','United States','United Kingdom','Global'],types:['korean','live'],ads:'okay',url:'https://www.youtube.com/@kbsworldtv',color:'#2879d8',verified:'Official broadcaster'},
  {id:'kofa',name:'Korean Film Archive',initials:'KOFA',tagline:'Classic Korean film + animation',regions:['India','United States','United Kingdom','Global'],types:['korean','anime'],ads:'avoid',url:'https://www.youtube.com/@KoreanFilm',color:'#b63b2f',verified:'Official national archive'},
  {id:'jff',name:'JFF Theater',initials:'JFF',tagline:'Free Japanese films',regions:['India','United States','United Kingdom','Global'],types:['japanese'],ads:'avoid',url:'https://www.jff.jpf.go.jp/',color:'#e15732',verified:'Japan Foundation · registration'},
  {id:'nhk',name:'NHK World-Japan',initials:'NHK',tagline:'Japanese culture + live TV',regions:['India','United States','United Kingdom','Global'],types:['japanese','live'],ads:'avoid',url:'https://www3.nhk.or.jp/nhkworld/',color:'#ca2228',verified:'Official public broadcaster'},
  {id:'pokemon',name:'Pokémon Asia',initials:'PK',tagline:'Official animation episodes',regions:['India'],types:['anime'],ads:'okay',url:'https://www.youtube.com/@PokemonAsiaENG',color:'#e8a90d',verified:'Official franchise channel'},
  {id:'tubi',name:'Tubi Anime',initials:'T',tagline:'Free anime in supported regions',regions:['United States','United Kingdom'],types:['anime','korean','japanese'],ads:'okay',url:'https://tubitv.com/category/anime',color:'#5946ff',verified:'Ad-supported'},
  {id:'retro',name:'RetroCrush',initials:'RC',tagline:'Classic anime catalog',regions:['United States'],types:['anime'],ads:'okay',url:'https://www.retrocrush.tv/',color:'#ed4d88',verified:'Free titles vary'}
];

const catalog = window.FREELY_CATALOG || {lastUpdated:null,sources:[],items:[]};
const media = (catalog.items || [])
  .map(item => ({
    ...item,
    id:String(item.id),
    direct:/youtube\.com\/(watch|playlist)|jff\.jpf\.go\.jp\/movie\//.test(item.url || '')
  }))
  .filter(item => item.catalogVisible !== false && item.access && item.availability === 'available' && item.direct);

const live = {
  'Animation & Anime':[
    {name:'Muse Asia',detail:'English subtitles · India',logo:'M',color:'#e44d78',url:'https://www.youtube.com/@MuseAsia'},
    {name:'Ani-One Asia',detail:'English subtitles · India',logo:'A1',color:'#8554dd',url:'https://www.youtube.com/@AniOneAsia'},
    {name:'Pokémon Asia',detail:'English dubbed episodes',logo:'PK',color:'#e8a90d',url:'https://www.youtube.com/@PokemonAsiaENG'}
  ],
  'Korean':[
    {name:'KBS World TV',detail:'English-subtitled programs',logo:'KBS',color:'#2879d8',url:'https://www.youtube.com/@kbsworldtv/streams'},
    {name:'KBS Korea',detail:'Captioned programs when available',logo:'K',color:'#264d94',url:'https://www.youtube.com/@KBStogether/streams'},
    {name:'Korean Film Archive',detail:'Selected English-subtitled classics',logo:'KOFA',color:'#b63b2f',url:'https://www.youtube.com/@KoreanFilm'}
  ],
  'Japanese':[
    {name:'NHK World-Japan',detail:'English-language broadcast',logo:'NHK',color:'#ca2228',url:'https://www3.nhk.or.jp/nhkworld/en/live/'},
    {name:'JFF Theater',detail:'English subtitles · rotating films',logo:'JFF',color:'#e15732',url:'https://www.jff.jpf.go.jp/'},
    {name:'NHK Programs',detail:'English audio or subtitles',logo:'JP',color:'#333',url:'https://www3.nhk.or.jp/nhkworld/en/shows/'}
  ]
};

const tools = [
  {icon:'S',color:'#e83e36',title:'JustWatch',text:'Search multiple services at once, set your country, then filter to free or ad-supported offers.',link:'https://www.justwatch.com/',cta:'Open universal search',note:'Availability index'},
  {icon:'uB',color:'#7846a8',title:'uBlock Origin Lite',text:'A privacy-focused content blocker for Chrome. Use it for tracker protection and respect each streaming service’s terms.',link:'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh',cta:'View official extension',note:'Chrome Web Store'},
  {icon:'🦊',color:'#ef6124',title:'Firefox protection',text:'Built-in Enhanced Tracking Protection can reduce cross-site tracking without installing another extension.',link:'https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop',cta:'Read setup guide',note:'Mozilla support'},
  {icon:'▶',color:'#ff2d36',title:'SponsorBlock',text:'Community-sourced skipping for sponsor segments inside YouTube creator videos—not platform playback ads.',link:'https://sponsor.ajay.app/',cta:'Visit SponsorBlock',note:'Open-source tool'},
  {icon:'CC',color:'#2287cf',title:'VLC media player',text:'Play media you own and attach local .srt or .vtt subtitle files with precise timing controls.',link:'https://www.videolan.org/vlc/',cta:'Get VLC',note:'Free and open source'},
  {icon:'◫',color:'#20a568',title:'Picture-in-Picture',text:'Use your browser’s built-in picture-in-picture control on supported provider players while you work.',link:'https://support.google.com/chrome/answer/9692215',cta:'Learn how it works',note:'Browser feature'}
];

const state = {
  route:'home',
  type:'all',
  saved: JSON.parse(localStorage.getItem('freely-asian-watchlist') || '[]'),
  genres: JSON.parse(localStorage.getItem('freely-asian-genres') || '["Mystery","Fantasy","Romance"]'),
  week: JSON.parse(localStorage.getItem('freely-asian-week') || '[]'),
  profile: JSON.parse(localStorage.getItem('freely-profile') || '{"name":"My profile","region":"India"}')
};
state.saved=state.saved.map(String);
state.week=state.week.map(String);

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = s => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
function save(){localStorage.setItem('freely-asian-watchlist',JSON.stringify(state.saved));localStorage.setItem('freely-asian-genres',JSON.stringify(state.genres));localStorage.setItem('freely-asian-week',JSON.stringify(state.week));localStorage.setItem('freely-profile',JSON.stringify(state.profile));}

function mediaCard(item){
  const saved=state.saved.includes(item.id);
  const autoBadge=item.autoDiscovered?'<span class="media-badge auto">AUTO</span>':'';
  const accountRequired=item.requiresAccount||item.platform==='JFF Theater';
  const rating=item.rating?.value?`<span class="rating-badge" title="MyAnimeList rating">★ ${escapeHtml(item.rating.value)} <small>${escapeHtml(item.rating.source||'MAL')}</small></span>`:'';
  const ratingText=item.rating?.value?` · ★ ${escapeHtml(item.rating.value)} ${escapeHtml(item.rating.source||'MAL')}`:'';
  return `<article class="media-card" data-id="${item.id}" data-open="${item.id}" data-direct-url="${escapeHtml(item.url)}" role="link" tabindex="0" aria-label="Open ${escapeHtml(item.title)} directly"><div class="media-art" data-open="${item.id}" style="background:${item.art}"><img src="${item.image}" alt="${escapeHtml(item.title)} artwork" loading="lazy" decoding="async" onerror="this.remove()"><div class="media-badges"><span class="media-badge free ${accountRequired?'account':''}">${accountRequired?'FREE · ACCOUNT':'FREE'}</span><span class="media-badge">${escapeHtml(item.focus)}</span><span class="media-badge access">CC ${escapeHtml(item.access)}</span>${autoBadge}</div>${rating}<button class="watch-button ${saved?'saved':''}" data-save="${item.id}" aria-label="${saved?'Remove from':'Add to'} watchlist">${saved?'✓':'+'}</button><div class="art-content"><small>${escapeHtml(item.platform.toUpperCase())}</small><strong>${escapeHtml(item.words).replace(/\n/g,'<br>')}</strong></div><button class="play-overlay" data-open="${item.id}" aria-label="Open ${escapeHtml(item.title)} directly">▶</button></div><h3>${escapeHtml(item.title)}</h3><p>${item.access} · ${item.type} · ${item.runtime} min${ratingText}${accountRequired?' · Free account required':''}</p></article>`;
}

function renderHome(){
  const picks=[media[0],media[6],media[12],media[2],media[16]].filter(Boolean);
  $('#homePicks').innerHTML=picks.map(mediaCard).join('');
  const visible=platforms.filter(p=>p.regions.includes(state.profile.region)||p.regions.includes('Global')).slice(0,4);
  $('#platformMiniList').innerHTML=visible.map(p=>`<a class="platform-mini" href="${p.url}" target="_blank" rel="noopener"><span class="platform-logo" style="background:${p.color}">${p.initials}</span><span><strong>${p.name}</strong><small>${p.tagline}</small></span><b>↗</b></a>`).join('');
}

function renderGenres(){
  const genres=[...new Set(media.map(m=>m.genre))];
  ['#homeGenres','#watchGenres'].forEach(sel=>{const el=$(sel);el.innerHTML=genres.slice(0,sel==='#homeGenres'?6:genres.length).map(g=>`<button class="genre-chip ${state.genres.includes(g)?'active':''}" data-genre="${g}">${g}</button>`).join('')});
  $('#genreFilter').innerHTML='<option value="all">All genres</option>'+genres.map(g=>`<option>${g}</option>`).join('');
  $('#platformFilter').innerHTML='<option value="all">All platforms</option>'+[...new Set(media.map(m=>m.platform))].map(p=>`<option>${p}</option>`).join('');
}

function renderDiscover(){
  const genre=$('#genreFilter')?.value||'all',platform=$('#platformFilter')?.value||'all',access=$('#accessFilter')?.value||'all';
  const list=media.filter(m=>m.access&&m.direct&&(state.type==='all'||m.focus===state.type)&&(genre==='all'||m.genre===genre)&&(platform==='all'||m.platform===platform)&&(access==='all'||m.access.includes(access)));
  $('#discoverGrid').innerHTML=list.map(mediaCard).join('');
  $('#resultCount').textContent=`${list.length} accessible pick${list.length===1?'':'s'}`;
}

function renderLive(){
  $('#liveCategories').innerHTML=Object.entries(live).map(([category,items])=>`<section><div class="live-section-heading"><h2>${category}</h2><span>${items.length} official sources</span></div><div class="live-grid">${items.map(x=>`<a class="live-card" href="${x.url}" target="_blank" rel="noopener"><span class="live-logo" style="background:${x.color}">${x.logo}</span><div><strong>${x.name}</strong><small>${x.detail}</small></div><span class="live-now"><i></i> LIVE</span></a>`).join('')}</div></section>`).join('');
}

function generateWeek(){
  const runtime=Number($('#runtimeRange')?.value||90);let pool=media.filter(m=>m.access&&m.direct&&state.genres.includes(m.genre)&&m.runtime<=runtime+30);if(pool.length<7)pool=media.filter(m=>m.access&&m.direct&&m.runtime<=runtime+30);pool=[...pool].sort(()=>Math.random()-.5);state.week=Array.from({length:7},(_,i)=>pool[i%pool.length].id);save();renderWeek();toast('Your direct-link week is ready');
}
function renderWeek(){
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  if(!state.week.length){$('#weekCalendar').innerHTML='<div class="empty-week">Choose your genres, then generate a week made for you.</div>';return}
  $('#weekCalendar').innerHTML=state.week.map((id,i)=>{const m=media.find(x=>x.id===id&&x.access&&x.direct)||media.find(x=>x.access&&x.direct);const rating=m.rating?.value?` · ★ ${escapeHtml(m.rating.value)} ${escapeHtml(m.rating.source||'MAL')}`:'';const account=m.requiresAccount||m.platform==='JFF Theater'?' · Free account required':'';return `<article class="day-card"><div class="day-label"><strong>${days[i]}</strong><small>${i<5?'Weeknight':'Weekend'}</small></div><div class="day-art" data-open="${m.id}" role="link" tabindex="0" aria-label="Open ${escapeHtml(m.title)} from poster" style="background:${m.art}"><img src="${m.image}" alt="${escapeHtml(m.title)} artwork" loading="lazy" onerror="this.remove()"></div><div class="day-info"><h3>${escapeHtml(m.title)}</h3><p>${m.access} · ${m.runtime} min · ${escapeHtml(m.platform)}${rating}${account}</p></div><button class="day-action" data-open="${m.id}" aria-label="Open ${escapeHtml(m.title)} directly">▶</button></article>`}).join('');
}
function renderTools(){$('#toolGrid').innerHTML=tools.map(t=>`<article class="tool-card"><span class="tool-icon" style="background:${t.color}">${t.icon}</span><h3>${t.title}</h3><p>${t.text}</p><a href="${t.link}" target="_blank" rel="noopener">${t.cta} →</a><small>${t.note}</small></article>`).join('')}
function updateProfile(){const {name,region}=state.profile;$('#profileName').textContent=name;$('#profileRegion').textContent=`${region} · Free plan`;$('#regionLabel').textContent=region;$('#avatar').textContent=(name==='My profile'?'A':name[0]).toUpperCase();$('#nameInput').value=name==='My profile'?'':name;$('#regionInput').value=region;$('#finderRegion').value=region;renderHome()}
function updateCount(){$('#navWatchCount').textContent=state.saved.length}
function updateCatalogStatus(){const el=$('#catalogUpdated');if(!el)return;if(!catalog.lastUpdated){el.textContent='Catalog update unavailable';return}const date=new Date(catalog.lastUpdated);const rated=media.filter(x=>x.rating?.value).length;el.textContent=`Catalog checked ${date.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})} · ${media.length} verified titles${rated?` · ${rated} MAL rated`:''}`;}

function route(name){
  state.route=name;$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===name));$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});history.replaceState(null,'',`#${name}`);
  if(name==='discover')renderDiscover();if(name==='watchlist')renderWeek();
}

document.addEventListener('click',e=>{
  const routeButton=e.target.closest('[data-route]');if(routeButton){e.preventDefault();route(routeButton.dataset.route);return}
  const saveButton=e.target.closest('[data-save]');if(saveButton){const id=String(saveButton.dataset.save);state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];save();updateCount();renderHome();renderDiscover();toast(state.saved.includes(id)?'Added to your watchlist':'Removed from watchlist');return}
  const openButton=e.target.closest('[data-open]');if(openButton){const item=media.find(x=>x.id===String(openButton.dataset.open)&&x.direct);if(item)window.open(item.url,'_blank','noopener');return}
  const genreButton=e.target.closest('[data-genre]');if(genreButton){const g=genreButton.dataset.genre;state.genres=state.genres.includes(g)?state.genres.filter(x=>x!==g):[...state.genres,g];if(!state.genres.length)state.genres=[g];save();renderGenres()}
  if(!e.target.closest('.search-wrap'))$('#searchResults').hidden=true;
});

$$('.filter-pill').forEach(b=>b.addEventListener('click',()=>{$$('.filter-pill').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.type=b.dataset.filter;renderDiscover()}));
$('#genreFilter').addEventListener('change',renderDiscover);$('#platformFilter').addEventListener('change',renderDiscover);$('#accessFilter').addEventListener('change',renderDiscover);
$('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#themeButton').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem('freely-theme',document.body.classList.contains('light')?'light':'dark')});
$('#profileButton').addEventListener('click',()=>$('#profileModal').hidden=false);$('#regionButton').addEventListener('click',()=>$('#profileModal').hidden=false);$('#closeProfile').addEventListener('click',()=>$('#profileModal').hidden=true);$('#profileModal').addEventListener('click',e=>{if(e.target.id==='profileModal')e.currentTarget.hidden=true});
$('#saveProfile').addEventListener('click',()=>{state.profile={name:$('#nameInput').value.trim()||'My profile',region:$('#regionInput').value};save();updateProfile();$('#profileModal').hidden=true;toast('Profile updated')});
$('#generateWeekButton').addEventListener('click',()=>{generateWeek();route('watchlist')});$('#generateHero').addEventListener('click',()=>{generateWeek();route('watchlist')});$('#regenerateWeek').addEventListener('click',generateWeek);$('#applyPreferences').addEventListener('click',generateWeek);
$('#runtimeRange').addEventListener('input',e=>$('#runtimeValue').textContent=`${e.target.value} min`);
$('#findPlatformButton').addEventListener('click',()=>{const region=$('#finderRegion').value,need=$('#finderNeed').value,ads=$('#finderAds').value;let found=platforms.filter(p=>(p.regions.includes(region)||p.regions.includes('Global'))&&p.types.includes(need)&&(ads==='okay'||p.ads==='avoid')).slice(0,3);if(!found.length)found=platforms.filter(p=>p.regions.includes('Global')).slice(0,3);$('#finderResults').innerHTML=found.map(p=>`<a class="finder-result" href="${p.url}" target="_blank" rel="noopener"><span class="platform-logo" style="background:${p.color}">${p.initials}</span><span>${p.name}<small style="display:block;color:var(--muted)">${p.verified}</small></span><b>↗</b></a>`).join('')});
$('#searchSubtitles').addEventListener('click',()=>{const q=$('#subtitleTitle').value.trim(),lang=$('#subtitleLanguage').value;if(!q){toast('Enter a movie or show title');return}const encoded=encodeURIComponent(q);$('#subtitleResults').innerHTML=`<span class="cc-illustration">CC</span><h3>${escapeHtml(q)}</h3><p>Search for ${escapeHtml(lang)} subtitles. Verify the release match before downloading.</p><div class="subtitle-links"><a href="https://www.opensubtitles.com/en/en/search-all/q-${encoded}" target="_blank" rel="noopener">OpenSubtitles ↗</a><a href="https://subdl.com/search/${encoded}" target="_blank" rel="noopener">SubDL ↗</a></div>`});
$('#globalSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase(),box=$('#searchResults');if(q.length<2){box.hidden=true;return}const results=media.filter(m=>m.access&&m.direct&&[m.title,m.genre,m.platform,m.type,m.focus,m.access].some(v=>String(v).toLowerCase().includes(q))).slice(0,6);box.innerHTML=results.length?results.map(m=>{const rating=m.rating?.value?` · ★ ${escapeHtml(m.rating.value)} ${escapeHtml(m.rating.source||'MAL')}`:'';const account=m.requiresAccount||m.platform==='JFF Theater'?' · Free account':'';return `<button class="search-result" data-open="${m.id}"><span class="search-result-art" style="background-image:url('${m.image}');background-size:cover;background-position:center"></span><span><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.access)} · ${escapeHtml(m.platform)}${rating}${account}</small></span></button>`}).join(''):'<div style="padding:16px;color:var(--muted);font-size:11px">No English-accessible matches found.</div>';box.hidden=false});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus()}if((e.key==='Enter'||e.key===' ')&&e.target.matches('.media-card,.day-art')){e.preventDefault();const item=media.find(x=>x.id===String(e.target.dataset.open)&&x.direct);if(item)window.open(item.url,'_blank','noopener')}if(e.key==='Escape'){$('#searchResults').hidden=true;$('#profileModal').hidden=true}});
$('#clearData').addEventListener('click',()=>{localStorage.removeItem('freely-asian-watchlist');localStorage.removeItem('freely-asian-genres');localStorage.removeItem('freely-asian-week');localStorage.removeItem('freely-profile');location.reload()});

function init(){
  if(localStorage.getItem('freely-theme')==='light')document.body.classList.add('light');
  renderGenres();renderHome();renderDiscover();renderLive();renderWeek();renderTools();updateProfile();updateCount();updateCatalogStatus();
  const hash=location.hash.slice(1);route(['home','discover','live','watchlist','subtitles','toolkit','setup'].includes(hash)?hash:'home');
}
init();
