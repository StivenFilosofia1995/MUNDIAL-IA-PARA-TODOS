require('dotenv').config();
const express = require('express');
const path    = require('path');
const app     = express();

const PORT             = process.env.PORT || 3000;
const SUPABASE_URL     = process.env.SUPABASE_URL   || '';
const SUPABASE_ANON    = process.env.SUPABASE_ANON_KEY || '';
const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY  || '';

// ── Frontend config ──────────────────────────────────────────
app.get('/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.SUPABASE_URL="${SUPABASE_URL}";window.SUPABASE_ANON_KEY="${SUPABASE_ANON}";`);
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Polla NODO corriendo en :${PORT}`));

// ── Live score polling ────────────────────────────────────────
// Regístrate GRATIS en https://www.football-data.org/client/register
// Agrega FOOTBALL_API_KEY=tu_clave_aqui al archivo .env
// Sin la clave, los resultados se ingresan manualmente y se actualizan en tiempo real igual.

const TEAM_ES = {
  'Mexico':'México','South Africa':'Sudáfrica','South Korea':'Corea del Sur',
  'Czech Republic':'República Checa','Czechia':'República Checa',
  'Bosnia and Herzegovina':'Bosnia y Herzegovina','Bosnia & Herzegovina':'Bosnia y Herzegovina',
  'United States':'Estados Unidos','USA':'Estados Unidos','Haiti':'Haití','Haïti':'Haití',
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
};

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

async function pollLiveScores() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );
    if (!res.ok) { console.error('[live]', res.status); return; }
    const { matches = [] } = await res.json();

    for (const m of matches) {
      if (!['IN_PLAY','PAUSED','FINISHED'].includes(m.status)) continue;
      const gl = m.score.fullTime.home ?? m.score.regularTime?.home;
      const gv = m.score.fullTime.away ?? m.score.regularTime?.away;
      if (gl == null || gv == null) continue;

      const localEs = TEAM_ES[m.homeTeam.name] || m.homeTeam.name;
      const visEs   = TEAM_ES[m.awayTeam.name] || m.awayTeam.name;
      const pid     = await findPartidoId(localEs, visEs);
      if (!pid) { console.log('[live] no encontrado:', localEs, 'vs', visEs); continue; }

      const goleadores = (m.goals || []).map(g => {
        const tipo = g.type === 'PENALTY' ? ' (pen)' : g.type === 'OWN_GOAL' ? ' (pp)' : '';
        return `${g.scorer?.name || '?'} ${g.minute}'${tipo}`;
      }).join(' · ');

      await sbRest('/resultados', 'POST', [{
        partido_id: pid, goles_local: gl, goles_vis: gv,
        goleadores, updated_at: new Date().toISOString()
      }]);
      console.log(`[live] ${localEs} ${gl}–${gv} ${visEs}${goleadores ? ' | ' + goleadores : ''}`);
    }
  } catch (e) {
    console.error('[live]', e.message);
  }
}

if (FOOTBALL_API_KEY) {
  console.log('[live] Polling activo — football-data.org');
  pollLiveScores();
  setInterval(pollLiveScores, 60_000);
} else {
  console.log('[live] Sin FOOTBALL_API_KEY — resultados en modo manual');
}
