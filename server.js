require('dotenv').config();
const express = require('express');
const path    = require('path');
const app     = express();

const PORT             = process.env.PORT || 3000;
const SUPABASE_URL     = process.env.SUPABASE_URL   || '';
const SUPABASE_ANON    = process.env.SUPABASE_ANON_KEY || '';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY  || ''; // opcional

// ── Frontend config ──────────────────────────────────────────────
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.SUPABASE_URL="${SUPABASE_URL}";window.SUPABASE_ANON_KEY="${SUPABASE_ANON}";`);
});

// ── API: Sincronizar ESPN a pedido ─────────────────────────────
app.get('/api/sync-espn', async (req, res) => {
  try {
    const today = req.query.date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${today}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return res.json({ error: `ESPN ${r.status}`, updated: 0 });
    const { events = [] } = await r.json();

    let updated = 0;
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const status = ev.status?.type?.name || '';
      if (!['STATUS_IN_PROGRESS','STATUS_HALFTIME','STATUS_FINAL','STATUS_FULL_TIME'].includes(status)) continue;

      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const gl = parseInt(home.score ?? '0');
      const gv = parseInt(away.score ?? '0');
      const homeEs = TEAM_ES[home.team?.displayName] || TEAM_ES[home.team?.name] || home.team?.displayName || '';
      const awayEs = TEAM_ES[away.team?.displayName] || TEAM_ES[away.team?.name] || away.team?.displayName || '';
      if (!homeEs || !awayEs) continue;

      let data = await sbRest(`/partidos?local=eq.${encodeURIComponent(homeEs)}&visitante=eq.${encodeURIComponent(awayEs)}&select=id`);
      if (!data?.length) {
        data = await sbRest(`/partidos?local=eq.${encodeURIComponent(awayEs)}&visitante=eq.${encodeURIComponent(homeEs)}&select=id`);
      }
      const pid = data?.[0]?.id;
      if (!pid) continue;

      const goals = (comp.details || [])
        .filter(d => d.type?.text === 'Goal Scored' || d.type?.id === '70' || d.scoringPlay)
        .map(d => {
          const scorer = d.athletesInvolved?.[0]?.displayName || d.participants?.[0]?.displayName || '?';
          const min = d.clock?.value != null ? Math.round(d.clock.value / 60) + "'" : '';
          const pen = d.penaltyKick ? ' (pen)' : '';
          const og = d.ownGoal ? ' (pp)' : '';
          return `${scorer}${min ? ' '+min : ''}${pen}${og}`;
        });

      await sbRest('/resultados', 'POST', [{
        partido_id: pid,
        goles_local: gl,
        goles_vis: gv,
        goleadores: goals.join(' · '),
        updated_at: new Date().toISOString()
      }]);
      updated++;
    }
    res.json({ updated, error: null });
  } catch (e) {
    res.json({ error: e.message, updated: 0 });
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Polla NODO corriendo en :${PORT}`));

// ── Nombres de equipos en español ───────────────────────────────
const TEAM_ES = {
  'Mexico':'México','South Africa':'Sudáfrica','South Korea':'Corea del Sur',
  'Czech Republic':'República Checa','Czechia':'República Checa',
  'Bosnia and Herzegovina':'Bosnia y Herzegovina','Bosnia & Herzegovina':'Bosnia y Herzegovina',
  'United States':'Estados Unidos','USA':'Estados Unidos',
  'Haiti':'Haití','Haïti':'Haití',
  'Brazil':'Brasil','Morocco':'Marruecos','Switzerland':'Suiza',
  "Côte d'Ivoire":'Costa de Marfil','Ivory Coast':'Costa de Marfil',
  'Germany':'Alemania','Netherlands':'Países Bajos','Sweden':'Suecia',
  'Saudi Arabia':'Arabia Saudita','Spain':'España','Cape Verde':'Cabo Verde',
  'Iran':'Irán','New Zealand':'Nueva Zelanda','Belgium':'Bélgica',
  'Egypt':'Egipto','France':'Francia','Iraq':'Irak','Norway':'Noruega',
  'Ghana':'Ghana','Panama':'Panamá','England':'Inglaterra','Croatia':'Croacia',
  'DR Congo':'RD Congo','Democratic Republic of Congo':'RD Congo',
  'Uzbekistan':'Uzbekistán','Canada':'Canadá','Japan':'Japón',
  'Turkey':'Turquía','Türkiye':'Turquía','Portugal':'Portugal',
  'Argentina':'Argentina','Uruguay':'Uruguay','Ecuador':'Ecuador',
  'Paraguay':'Paraguay','Colombia':'Colombia','Australia':'Australia',
  'Scotland':'Escocia','Serbia':'Serbia','Austria':'Austria',
  'Jordan':'Jordania','Algeria':'Argelia','Tunisia':'Túnez',
  'Senegal':'Senegal','Nigeria':'Nigeria','Cameroon':'Camerún',
  'Qatar':'Catar','Curacao':'Curazao','Curaçao':'Curazao',
  'Curaçao':'Curazao','Cabo Verde':'Cabo Verde',
};

// ── Supabase REST helper ─────────────────────────────────────────
async function sbRest(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, opts);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function findPartidoId(localEs, visEs) {
  let data = await sbRest(`/partidos?local=eq.${encodeURIComponent(localEs)}&visitante=eq.${encodeURIComponent(visEs)}&select=id`);
  if (data?.length) return data[0].id;
  data = await sbRest(`/partidos?local=eq.${encodeURIComponent(visEs)}&visitante=eq.${encodeURIComponent(localEs)}&select=id`);
  return data?.[0]?.id ?? null;
}

async function upsertResultado(pid, gl, gv, goleadores) {
  if (gl == null || gv == null) return;
  await sbRest('/resultados', 'POST', [{
    partido_id: pid,
    goles_local: gl,
    goles_vis: gv,
    goleadores: goleadores || '',
    updated_at: new Date().toISOString()
  }]);
}

// ── ESPN FREE API (sin clave, automático) ────────────────────────
// Fuente: ESPN scores API para FIFA World Cup — funciona sin registro
async function pollESPN() {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${today}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) { console.error('[espn]', res.status); return; }
    const { events = [] } = await res.json();

    let updated = 0;
    for (const ev of events) {
      const comp   = ev.competitions?.[0];
      if (!comp) continue;
      const status = ev.status?.type?.name || '';
      if (!['STATUS_IN_PROGRESS','STATUS_HALFTIME','STATUS_FINAL','STATUS_FULL_TIME'].includes(status)) continue;

      const home = comp.competitors?.find(c => c.homeAway === 'home');
      const away = comp.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;

      const gl = parseInt(home.score ?? '0');
      const gv = parseInt(away.score ?? '0');

      const homeEs = TEAM_ES[home.team?.displayName] || TEAM_ES[home.team?.name] || home.team?.displayName || '';
      const awayEs = TEAM_ES[away.team?.displayName] || TEAM_ES[away.team?.name] || away.team?.displayName || '';
      if (!homeEs || !awayEs) continue;

      const pid = await findPartidoId(homeEs, awayEs);
      if (!pid) { console.log('[espn] no mapeado:', homeEs, 'vs', awayEs); continue; }

      // Goleadores desde ESPN details
      const goals = (comp.details || [])
        .filter(d => d.type?.text === 'Goal Scored' || d.type?.id === '70' || d.scoringPlay)
        .map(d => {
          const scorer = d.athletesInvolved?.[0]?.displayName || d.participants?.[0]?.displayName || '?';
          const min    = d.clock?.value != null ? Math.round(d.clock.value / 60) + "'" : '';
          const pen    = d.penaltyKick ? ' (pen)' : '';
          const og     = d.ownGoal ? ' (pp)' : '';
          return `${scorer}${min ? ' '+min : ''}${pen}${og}`;
        });

      await upsertResultado(pid, gl, gv, goals.join(' · '));
      console.log(`[espn] ${homeEs} ${gl}–${gv} ${awayEs}${goals.length ? ' | '+goals.join(', ') : ''}`);
      updated++;
    }
    if (updated) console.log(`[espn] ${updated} partidos actualizados`);
  } catch (e) {
    console.error('[espn]', e.message);
  }
}

// ── football-data.org (opcional, si el usuario pone FOOTBALL_API_KEY) ───
async function pollFootballData() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );
    if (!res.ok) { console.error('[fd]', res.status); return; }
    const { matches = [] } = await res.json();

    for (const m of matches) {
      if (!['IN_PLAY','PAUSED','FINISHED'].includes(m.status)) continue;
      const gl = m.score.fullTime.home ?? m.score.regularTime?.home;
      const gv = m.score.fullTime.away ?? m.score.regularTime?.away;
      if (gl == null || gv == null) continue;

      const localEs = TEAM_ES[m.homeTeam.name] || m.homeTeam.name;
      const visEs   = TEAM_ES[m.awayTeam.name] || m.awayTeam.name;
      const pid     = await findPartidoId(localEs, visEs);
      if (!pid) continue;

      const goleadores = (m.goals || []).map(g => {
        const tipo = g.type === 'PENALTY' ? ' (pen)' : g.type === 'OWN_GOAL' ? ' (pp)' : '';
        return `${g.scorer?.name || '?'} ${g.minute}'${tipo}`;
      }).join(' · ');

      await upsertResultado(pid, gl, gv, goleadores);
      console.log(`[fd] ${localEs} ${gl}–${gv} ${visEs}`);
    }
  } catch (e) {
    console.error('[fd]', e.message);
  }
}

// ── Iniciar polling ──────────────────────────────────────────────
if (SUPABASE_URL && SUPABASE_ANON) {
  if (FOOTBALL_API_KEY) {
    console.log('[live] football-data.org activo (clave configurada)');
    pollFootballData();
    setInterval(pollFootballData, 60_000);
  } else {
    console.log('[live] ESPN free API activo (automático, sin clave)');
    pollESPN();
    setInterval(pollESPN, 60_000);
  }
} else {
  console.log('[live] Sin Supabase — modo offline');
}
