import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Brain, ClipboardCheck, Database, Download, FileJson, FileUp, LogIn, LogOut,
  Plus, RotateCcw, Save, Search, Star, Target, Trash2, TrendingUp, Upload, Users
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

const STORAGE_KEY = 'tele-sales-coach-pro-v1';

const categories = [
  { key: 'avaus', title: 'Avaus', short: 'Ensimmäiset 15–30 sekuntia', anchors: {
    4: 'Vahva, napakka ja uskottava avaus. Herättää heti kiinnostuksen ja saa asiakkaan jäämään keskusteluun.',
    3: 'Selkeä ja toimiva avaus. Asiakas ymmärtää miksi soitetaan ja keskustelu lähtee etenemään.',
    2: 'Perustasoinen avaus. Ei kaada puhelua, mutta ei erotu tai herätä vahvaa kiinnostusta.',
    1: 'Epävarma, liian pitkä tai geneerinen avaus. Kuulostaa myyntipuhelulta ja asiakas pyrkii nopeasti pois.'
  }},
  { key: 'motivaatio', title: 'Motivaation tunnistaminen', short: 'Ostotriggerin löytäminen', anchors: {
    4: 'Löytää asiakkaan todellisen ostomotiivin nopeasti ja rakentaa keskustelun sen ympärille.',
    3: 'Kysyy relevantteja kysymyksiä ja tunnistaa vähintään yhden käyttökelpoisen ostotriggerin.',
    2: 'Kysyy jotain, mutta jää pintaan. Motivaatiota ei hyödynnetä kunnolla keskustelussa.',
    1: 'Ei selvitä asiakkaan tilannetta. Pitchaa suoraan ja olettaa tarpeet.'
  }},
  { key: 'arvolupaus', title: 'Arvolupauksen relevanssi', short: 'Oikea hyöty oikealle ihmiselle', anchors: {
    4: 'Arvo tuntuu asiakkaalle henkilökohtaiselta ja konkreettiselta. Hyödyt sidotaan täsmällisesti asiakkaan tilanteeseen.',
    3: 'Hyödyt ovat pääosin relevantteja ja linkittyvät asiakkaan tilanteeseen.',
    2: 'Mukana on jokin osuva hyöty, mutta kokonaisuus jää osin geneeriseksi.',
    1: 'Listaa jäsenetuja katalogimaisesti ilman selvää yhteyttä asiakkaan tilanteeseen.'
  }},
  { key: 'vastavaitteet', title: 'Vastaväitteiden käsittely', short: 'Momentum vastustuksen jälkeen', anchors: {
    4: 'Purkaa vastaväitteen rauhallisesti ja taitavasti. Keskustelun momentum paranee vastustuksen jälkeen.',
    3: 'Tunnistaa aidon esteen ja vie keskustelua eteenpäin ilman puolustelua.',
    2: 'Yrittää käsitellä vastaväitettä, mutta vastaus jää mekaaniseksi tai liian nopeaksi argumentoinniksi.',
    1: 'Väistää, puolustautuu tai hyväksyy vastaväitteen liian nopeasti. Keskustelu kuolee.'
  }},
  { key: 'klousaus', title: 'Kaupan klousaus', short: 'Päätös tai selkeä next step', anchors: {
    4: 'Pyytää päätöstä luonnollisesti ja itsevarmasti. Vie asiakkaan selkeään ratkaisuun tai vahvaan seuraavaan askeleeseen.',
    3: 'Pyytää päätöstä tai sopii selkeän jatkon. Ei jätä puhelua täysin auki.',
    2: 'Yrittää edistää, mutta jää varovaiseksi tai epäselväksi.',
    1: 'Ei pyydä päätöstä eikä sovi kunnollista jatkoa. Hyväkin keskustelu jää roikkumaan.'
  }}
];

const initialForm = () => ({
  date: new Date().toISOString().slice(0, 10), seller: '', company: '', callId: '', outcome: '', reviewType: 'Call listening',
  coachingFocus: '', nextActions: '', notes: '', transcript: '', aiSummary: '', betterPhrases: [],
  scores: Object.fromEntries(categories.map((c) => [c.key, 0]))
});

const totalScore = (scores) => categories.reduce((sum, c) => sum + Number(scores?.[c.key] || 0), 0);
const avgScore = (scores) => {
  const values = categories.map((c) => Number(scores?.[c.key] || 0)).filter(Boolean);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};
const ratingLabel = (total) => total >= 18 ? 'Erinomainen / top performer -taso' : total >= 14 ? 'Hyvä, muutama selkeä kehityskohde' : total >= 10 ? 'Keskitaso, tarvitsee fokusoitua coachingia' : total > 0 ? 'Selkeä kehitystarve' : 'Ei vielä arvioitu';
const csvEscape = (value) => /[",\n;]/.test(String(value ?? '')) ? `"${String(value ?? '').replace(/"/g, '""')}"` : String(value ?? '');
const downloadBlob = (filename, content, type) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); };

function toDbRow(entry, userId) {
  return {
    user_id: userId,
    date: entry.date,
    seller: entry.seller,
    company: entry.company,
    call_id: entry.callId,
    outcome: entry.outcome,
    review_type: entry.reviewType,
    coaching_focus: entry.coachingFocus,
    next_actions: entry.nextActions,
    notes: entry.notes,
    transcript: entry.transcript,
    ai_summary: entry.aiSummary,
    better_phrases: entry.betterPhrases || [],
    scores: entry.scores || {}
  };
}
function fromDbRow(row) {
  return {
    id: row.id, date: row.date, seller: row.seller || '', company: row.company || '', callId: row.call_id || '', outcome: row.outcome || '',
    reviewType: row.review_type || 'Call listening', coachingFocus: row.coaching_focus || '', nextActions: row.next_actions || '', notes: row.notes || '',
    transcript: row.transcript || '', aiSummary: row.ai_summary || '', betterPhrases: row.better_phrases || [], scores: row.scores || {}, createdAt: row.created_at
  };
}
function downloadCSV(rows) {
  const header = ['Päivämäärä','Myyjä','Asiakas / yritys','Puhelu ID','Lopputulos','Arviointityyppi',...categories.map((c)=>c.title),'Yhteispisteet','Keskiarvo','Coaching focus','Toimenpiteet','AI yhteenveto','Paremmat sanavalinnat','Muistiinpanot'];
  const csvRows = rows.map((r) => [r.date,r.seller,r.company,r.callId,r.outcome,r.reviewType,...categories.map((c)=>r.scores?.[c.key] || 0),totalScore(r.scores),avgScore(r.scores).toFixed(1),r.coachingFocus,r.nextActions,r.aiSummary,(r.betterPhrases || []).join(' | '),r.notes]);
  const csv = [header, ...csvRows].map((row)=>row.map(csvEscape).join(';')).join('\n');
  downloadBlob(`call-scorecard-${new Date().toISOString().slice(0,10)}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8;');
}
function averageByCategory(rows) {
  return categories.map((cat) => { const values = rows.map((r)=>Number(r.scores?.[cat.key] || 0)).filter(Boolean); const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; return { skill: cat.title, avg: Number(avg.toFixed(2)), count: values.length }; });
}
function sellerStats(rows) {
  return [...new Set(rows.map((r)=>r.seller).filter(Boolean))].map((seller)=>{ const sellerRows = rows.filter((r)=>r.seller === seller); const avg = sellerRows.reduce((sum, r)=>sum+avgScore(r.scores),0) / Math.max(1, sellerRows.length); return { seller, calls: sellerRows.length, avg: Number(avg.toFixed(2)), totalAvg: Number((avg*5).toFixed(1)) }; }).sort((a,b)=>b.avg-a.avg);
}
function monthlyTrend(rows) {
  const map = {}; rows.forEach((r)=>{ const period = (r.date || '').slice(0,7); if (!period) return; map[period] ||= []; map[period].push(avgScore(r.scores)); });
  return Object.entries(map).map(([period, values])=>({ period, avg: Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)) })).sort((a,b)=>a.period.localeCompare(b.period));
}

export default function App() {
  const [form, setForm] = useState(initialForm());
  const [rows, setRows] = useState([]);
  const [tab, setTab] = useState('scorecard');
  const [query, setQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');

  const cloudMode = isSupabaseConfigured;

  useEffect(() => {
    if (!cloudMode) {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setRows(JSON.parse(raw)); } catch { setRows([]); }
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => sub.subscription.unsubscribe();
  }, [cloudMode]);

  useEffect(() => {
    if (!cloudMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, [rows, cloudMode]);

  useEffect(() => {
    async function loadCloudRows() {
      if (!cloudMode || !session?.user?.id) return;
      const { data, error: loadError } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false });
      if (loadError) setError(loadError.message); else setRows((data || []).map(fromDbRow));
    }
    loadCloudRows();
  }, [cloudMode, session]);

  const total = totalScore(form.scores);
  const avg = avgScore(form.scores);
  const weakest = useMemo(() => categories.filter((c)=>Number(form.scores[c.key]) > 0).sort((a,b)=>Number(form.scores[a.key])-Number(form.scores[b.key]))[0] || null, [form.scores]);
  const sellers = useMemo(() => [...new Set(rows.map((r)=>r.seller).filter(Boolean))].sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((r) => {
    const text = `${r.seller} ${r.company} ${r.callId} ${r.notes} ${r.coachingFocus}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (selectedSeller === 'all' || r.seller === selectedSeller);
  }), [rows, query, selectedSeller]);
  const skillData = useMemo(() => averageByCategory(filteredRows), [filteredRows]);
  const sellerData = useMemo(() => sellerStats(filteredRows), [filteredRows]);
  const trendData = useMemo(() => monthlyTrend(filteredRows), [filteredRows]);

  async function signIn() {
    setError('');
    const { error: signError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (signError) setError(signError.message); else alert('Kirjautumislinkki lähetetty sähköpostiin.');
  }
  async function signOut() { await supabase.auth.signOut(); setRows([]); }
  function setScore(key, score) { setForm((prev) => ({ ...prev, scores: { ...prev.scores, [key]: score } })); }
  async function saveRow() {
    setError('');
    const entry = { ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    if (cloudMode && session?.user?.id) {
      const { data, error: saveError } = await supabase.from('evaluations').insert(toDbRow(entry, session.user.id)).select('*').single();
      if (saveError) return setError(saveError.message);
      setRows((prev) => [fromDbRow(data), ...prev]);
    } else {
      setRows((prev) => [entry, ...prev]);
    }
    setForm(initialForm()); setTab('dashboard');
  }
  async function removeRow(id) {
    if (cloudMode && session?.user?.id) await supabase.from('evaluations').delete().eq('id', id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  async function runAiScoring() {
    setError(''); setAiLoading(true);
    try {
      const res = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: form.transcript }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'AI scoring failed.');
      setForm((prev) => ({ ...prev, reviewType: 'AI review', scores: { ...prev.scores, ...(data.scores || {}) }, aiSummary: data.summary || '', coachingFocus: data.coachingFocus || prev.coachingFocus, nextActions: Array.isArray(data.nextActions) ? data.nextActions.join('\n') : prev.nextActions, betterPhrases: data.betterPhrases || [], notes: [prev.notes, data.evidence ? Object.entries(data.evidence).map(([k,v]) => `${k}: ${v}`).join('\n') : ''].filter(Boolean).join('\n\n') }));
    } catch (e) { setError(e.message); } finally { setAiLoading(false); }
  }
  async function transcribeAudio(file) {
    if (!file) return; setError(''); setTranscribing(true);
    try {
      const body = new FormData(); body.append('audio', file);
      const res = await fetch('/api/transcribe', { method: 'POST', body });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Transcription failed.');
      setForm((prev) => ({ ...prev, transcript: data.transcript || '' }));
    } catch (e) { setError(e.message); } finally { setTranscribing(false); }
  }
  function exportJson() { downloadBlob(`call-scorecard-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(rows, null, 2), 'application/json'); }
  async function importJson(file) { if (!file) return; const imported = JSON.parse(await file.text()); if (!Array.isArray(imported)) throw new Error('JSON must contain an array.'); setRows(imported); }

  const teamAvg = filteredRows.length ? (filteredRows.reduce((s, r)=>s+avgScore(r.scores),0) / filteredRows.length).toFixed(1) + '/4' : '0.0/4';
  const weakestSkill = skillData.length ? [...skillData].sort((a,b)=>a.avg-b.avg)[0]?.skill || '-' : '-';
  const statCards = [
    { label: 'Arviointeja', value: filteredRows.length, icon: Database },
    { label: 'Tiimin keskiarvo', value: teamAvg, icon: BarChart3 },
    { label: 'Myyjiä', value: sellers.length, icon: Users },
    { label: 'Heikoin skill', value: weakestSkill, icon: Target }
  ];

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-7xl px-5 py-8">
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-300"><ClipboardCheck size={16}/> Tele Sales Coach Pro <span className="text-slate-500">·</span> {cloudMode ? (session ? 'Cloud mode' : 'Cloud login required') : 'Local mode'}</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">Call Scorecard & Coaching Dashboard</h1>
          <p className="mt-3 max-w-3xl text-slate-400">Arvioi puhelut, löydä skill gapit, seuraa kehitystä ja vie data Exceliin.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => downloadCSV(rows.length ? rows : [{ ...form, id: 'current' }])} className="btn-primary"><Download size={17}/> Vie CSV</button>
          <button onClick={exportJson} className="btn-secondary"><FileJson size={17}/> Backup JSON</button>
          <label className="btn-secondary cursor-pointer"><FileUp size={17}/> Tuo JSON<input type="file" accept="application/json" className="hidden" onChange={(e)=>importJson(e.target.files?.[0])}/></label>
        </div>
      </header>

      {cloudMode && !session && <div className="card mb-6"><h2 className="mb-3 text-2xl font-bold">Kirjaudu sisään</h2><p className="mb-4 text-slate-400">Supabase on käytössä. Lähetä magic link sähköpostiisi.</p><div className="flex flex-col gap-3 md:flex-row"><input className="input" type="email" placeholder="sähköposti" value={email} onChange={(e)=>setEmail(e.target.value)}/><button className="btn-primary md:w-56" onClick={signIn}><LogIn size={17}/> Lähetä linkki</button></div></div>}
      {cloudMode && session && <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300"><span>Kirjautunut: {session.user.email}</span><button onClick={signOut} className="btn-secondary py-2"><LogOut size={15}/> Kirjaudu ulos</button></div>}
      {error && <div className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

      <nav className="mb-6 flex flex-wrap gap-2 rounded-3xl border border-slate-800 bg-slate-900/70 p-2">
        {[['scorecard','Scorecard'],['dashboard','Dashboard'],['ai','AI scoring'],['entries','Arvioinnit']].map(([id,label]) => <button key={id} onClick={()=>setTab(id)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tab === id ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>{label}</button>)}
      </nav>

      {tab === 'scorecard' && <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><div className="card"><MetaForm form={form} setForm={setForm}/><div className="mt-6 grid gap-4">{categories.map((cat)=><ScoreCategory key={cat.key} cat={cat} score={form.scores[cat.key]} setScore={setScore}/>)}</div><Notes form={form} setForm={setForm}/><button onClick={saveRow} disabled={cloudMode && !session} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-40"><Save size={18}/> Tallenna arviointi</button></div><ScoreSummary total={total} avg={avg} weakest={weakest} form={form} setForm={setForm}/></section>}

      {tab === 'ai' && <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div className="card"><h2 className="mb-2 text-2xl font-bold">AI scoring</h2><p className="mb-5 text-slate-400">Liitä transkriptio tai lataa äänitiedosto. AI pisteyttää puhelun ja ehdottaa coaching focus -alueen.</p><label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center hover:bg-slate-900"><Upload className="mb-3"/><div className="font-semibold">{transcribing ? 'Transkriboidaan...' : 'Lataa audio, esim. mp3/m4a/wav'}</div><div className="text-sm text-slate-500">Max suositus 25 MB</div><input type="file" accept="audio/*" className="hidden" onChange={(e)=>transcribeAudio(e.target.files?.[0])}/></label><TextArea label="Transkriptio" value={form.transcript} onChange={(v)=>setForm({...form, transcript:v})} placeholder="Liitä puhelun transkriptio tähän..." rows={14}/><button disabled={aiLoading || !form.transcript} onClick={runAiScoring} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-400 px-5 py-4 font-bold text-slate-950 hover:bg-violet-300 disabled:opacity-50"><Brain size={18}/> {aiLoading ? 'Analysoidaan...' : 'Pisteytä AI:lla'}</button></div><div className="space-y-5"><ScoreSummary total={total} avg={avg} weakest={weakest} form={form} setForm={setForm}/>{form.aiSummary && <div className="card"><h3 className="mb-3 text-xl font-bold">AI-yhteenveto</h3><p className="text-slate-300">{form.aiSummary}</p>{!!form.betterPhrases?.length && <div className="mt-5"><h4 className="mb-2 font-bold">Paremmat sanavalinnat</h4><ul className="space-y-2 text-sm text-slate-300">{form.betterPhrases.map((p,i)=><li key={i} className="rounded-2xl bg-slate-950 p-3">{p}</li>)}</ul></div>}<button disabled={cloudMode && !session} onClick={saveRow} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-4 font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-40"><Save size={18}/> Tallenna AI-arviointi</button></div>}</div></section>}

      {tab === 'dashboard' && <section className="space-y-5"><Filters query={query} setQuery={setQuery} selectedSeller={selectedSeller} setSelectedSeller={setSelectedSeller} sellers={sellers}/><div className="grid gap-4 md:grid-cols-4">{statCards.map((s)=><StatCard key={s.label} {...s}/>)}</div><div className="grid gap-5 lg:grid-cols-2"><ChartCard title="Skill heatmap / keskiarvot"><ResponsiveContainer width="100%" height={320}><BarChart data={skillData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="skill" stroke="#94a3b8" tick={{fontSize:12}} interval={0} angle={-15} textAnchor="end" height={80}/><YAxis domain={[0,4]} stroke="#94a3b8"/><Tooltip contentStyle={{background:'#020617', border:'1px solid #334155', borderRadius:12}}/><Bar dataKey="avg" fill="#e2e8f0" radius={[12,12,0,0]}/></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Kehitys ajassa"><ResponsiveContainer width="100%" height={320}><LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b"/><XAxis dataKey="period" stroke="#94a3b8"/><YAxis domain={[0,4]} stroke="#94a3b8"/><Tooltip contentStyle={{background:'#020617', border:'1px solid #334155', borderRadius:12}}/><Line type="monotone" dataKey="avg" stroke="#e2e8f0" strokeWidth={3} dot={{r:5}}/></LineChart></ResponsiveContainer></ChartCard></div><div className="card"><h2 className="mb-4 text-2xl font-bold">Myyjäkohtainen leaderboard</h2><div className="overflow-auto"><table className="w-full min-w-[720px] text-left"><thead className="text-sm text-slate-400"><tr><th className="p-3">Myyjä</th><th className="p-3">Arviointeja</th><th className="p-3">Keskiarvo</th><th className="p-3">Yhteispiste avg</th></tr></thead><tbody>{sellerData.map((s)=><tr key={s.seller} className="border-t border-slate-800"><td className="p-3 font-semibold">{s.seller}</td><td className="p-3">{s.calls}</td><td className="p-3">{s.avg}/4</td><td className="p-3">{s.totalAvg}/20</td></tr>)}</tbody></table></div></div></section>}

      {tab === 'entries' && <section className="space-y-5"><Filters query={query} setQuery={setQuery} selectedSeller={selectedSeller} setSelectedSeller={setSelectedSeller} sellers={sellers}/><div className="card"><h2 className="mb-4 text-2xl font-bold">Tallennetut arvioinnit</h2><div className="grid gap-3">{filteredRows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-500">Ei arviointeja.</div>}{filteredRows.map((r)=><EntryCard key={r.id} r={r} removeRow={removeRow}/>)}</div></div></section>}
    </div>
  </div>;
}

function MetaForm({ form, setForm }) { return <div className="grid gap-4 md:grid-cols-5"><Field label="Päivämäärä" value={form.date} type="date" onChange={(v)=>setForm({...form, date:v})}/><Field label="Myyjä" value={form.seller} onChange={(v)=>setForm({...form, seller:v})} placeholder="Nimi"/><Field label="Asiakas / yritys" value={form.company} onChange={(v)=>setForm({...form, company:v})} placeholder="Yritys"/><Field label="Puhelu ID" value={form.callId} onChange={(v)=>setForm({...form, callId:v})} placeholder="Tallenne / CRM"/><label className="block"><div className="mb-2 text-sm font-medium text-slate-300">Arviointityyppi</div><select value={form.reviewType} onChange={(e)=>setForm({...form, reviewType:e.target.value})} className="input"><option>Call listening</option><option>Live coaching</option><option>Self review</option><option>Peer review</option><option>AI review</option></select></label></div>; }
function ScoreCategory({ cat, score, setScore }) { return <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-semibold">{cat.title}</h2><p className="text-sm text-slate-400">{cat.short}</p></div><div className="flex gap-2">{[1,2,3,4].map((n)=><button key={n} onClick={()=>setScore(cat.key,n)} className={`h-12 w-12 rounded-2xl border text-lg font-bold transition ${score === n ? 'border-white bg-white text-slate-950 shadow-lg' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}>{n}</button>)}</div></div><div className="mt-4 grid gap-2 md:grid-cols-4">{[1,2,3,4].map((n)=><button key={n} onClick={()=>setScore(cat.key,n)} className={`rounded-2xl border p-3 text-left text-sm leading-snug ${score === n ? 'border-white bg-white text-slate-950' : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:bg-slate-800'}`}><div className="mb-1 font-bold">{n}/4</div>{cat.anchors[n]}</button>)}</div></div>; }
function Notes({ form, setForm }) { return <div className="mt-5 grid gap-4 md:grid-cols-2"><TextArea label="Coaching focus" value={form.coachingFocus} onChange={(v)=>setForm({...form, coachingFocus:v})} placeholder="Esim. vastaväitteissä yksi jatkokysymys ennen argumentointia"/><TextArea label="Toimenpiteet ensi viikolle" value={form.nextActions} onChange={(v)=>setForm({...form, nextActions:v})} placeholder="Mitä myyjä harjoittelee seuraavaksi?"/><TextArea label="Puhelun lopputulos" value={form.outcome} onChange={(v)=>setForm({...form, outcome:v})} placeholder="Kauppa / ei kauppaa / jatkosoitto / tarjous"/><TextArea label="Muistiinpanot" value={form.notes} onChange={(v)=>setForm({...form, notes:v})} placeholder="Lyhyt havainto puhelusta"/></div>; }
function ScoreSummary({ total, avg, weakest, form, setForm }) { return <aside className="space-y-5"><div className="card"><div className="mb-4 flex items-center gap-2 text-slate-300"><BarChart3 size={18}/> Kokonaisarvio</div><div className="text-6xl font-black tracking-tight">{total}<span className="text-2xl text-slate-500">/20</span></div><div className="mt-2 text-lg font-semibold text-slate-200">Keskiarvo {avg.toFixed(1)}/4</div><div className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">{ratingLabel(total)}</div>{weakest && <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><div className="mb-1 flex items-center gap-2 font-bold"><Star size={16}/> Todennäköinen coaching focus</div>{weakest.title} ({form.scores[weakest.key]}/4)<button onClick={()=>setForm({...form, coachingFocus: weakest.title})} className="mt-3 block rounded-xl bg-amber-200 px-3 py-2 text-xs font-bold text-slate-950">Käytä fokuksena</button></div>}</div><div className="card"><h3 className="mb-3 text-lg font-semibold">Käyttösuositus</h3><div className="space-y-3 text-sm text-slate-400"><p>Arvioi 1–2 puhelua / myyjä / viikko.</p><p>Valitse aina vain yksi pääasiallinen coaching focus.</p><p>Seuraa käyttäytymisen paranemista ennen kuin odotat tulosten paranemista.</p></div></div></aside>; }
function Filters({ query, setQuery, selectedSeller, setSelectedSeller, sellers }) { return <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 md:flex-row"><div className="relative flex-1"><Search className="absolute left-4 top-3.5 text-slate-500" size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Hae myyjä, yritys, puhelu ID..." className="input pl-11"/></div><select value={selectedSeller} onChange={(e)=>setSelectedSeller(e.target.value)} className="input md:w-64"><option value="all">Kaikki myyjät</option>{sellers.map((s)=><option key={s} value={s}>{s}</option>)}</select></div>; }
function StatCard({ label, value, icon: Icon }) { return <div className="card"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950"><Icon size={20}/></div><div className="text-sm text-slate-400">{label}</div><div className="mt-1 text-2xl font-black">{value}</div></div>; }
function ChartCard({ title, children }) { return <div className="card"><div className="mb-4 flex items-center gap-2 text-xl font-bold"><TrendingUp size={20}/> {title}</div>{children}</div>; }
function EntryCard({ r, removeRow }) { return <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="text-xl font-bold">{r.seller || 'Myyjä puuttuu'}</div><div className="text-sm text-slate-400">{r.company || 'Yritys puuttuu'} · {r.date} · {r.reviewType}</div></div><div className="flex items-center gap-3"><div className="rounded-2xl bg-white px-4 py-2 font-black text-slate-950">{totalScore(r.scores)}/20</div><button onClick={()=>removeRow(r.id)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-red-300"><Trash2 size={18}/></button></div></div><div className="mt-4 grid gap-2 md:grid-cols-5">{categories.map((c)=><div key={c.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-3"><div className="text-xs text-slate-500">{c.title}</div><div className="text-2xl font-black">{r.scores?.[c.key] || 0}</div></div>)}</div>{(r.coachingFocus || r.notes) && <div className="mt-4 grid gap-3 md:grid-cols-2">{r.coachingFocus && <div className="rounded-2xl bg-slate-900 p-4"><div className="mb-1 text-xs font-bold text-slate-500">Coaching focus</div>{r.coachingFocus}</div>}{r.notes && <div className="whitespace-pre-wrap rounded-2xl bg-slate-900 p-4"><div className="mb-1 text-xs font-bold text-slate-500">Muistiinpanot</div>{r.notes}</div>}</div>}</div>; }
function Field({ label, value, onChange, placeholder, type='text' }) { return <label className="block"><div className="mb-2 text-sm font-medium text-slate-300">{label}</div><input type={type} value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)} className="input"/></label>; }
function TextArea({ label, value, onChange, placeholder, rows=4 }) { return <label className="block"><div className="mb-2 text-sm font-medium text-slate-300">{label}</div><textarea value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)} rows={rows} className="input min-h-[110px] resize-y"/></label>; }
