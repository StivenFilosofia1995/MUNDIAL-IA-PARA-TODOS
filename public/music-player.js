// ── MUSIC PLAYER — Polla NODO Mundial 2026 ──────────────────
(function () {
  const SONGS = [
    { file: 'waka-waka.mp3',               name: 'Waka Waka',                artist: 'Shakira' },
    { file: 'knaan-wavin-flag.mp3',         name: "Wavin' Flag",              artist: "K'NAAN" },
    { file: 'we-are-one.mp3',               name: 'We Are One (Ole Ola)',      artist: 'Pitbull ft. Jennifer Lopez' },
    { file: 'queen-champions.mp3',          name: 'We Are The Champions',      artist: 'Queen' },
    { file: 'queen-we-will-rock-you.mp3',   name: 'We Will Rock You',          artist: 'Queen' },
    { file: 'shakira-hips-dont-lie.mp3',    name: "Hips Don't Lie",            artist: 'Shakira ft. Wyclef Jean' },
    { file: 'shakira-dai-dai.mp3',          name: 'Dai Dai',                   artist: 'Shakira & Burna Boy' },
    { file: 'blur-song2.mp3',               name: 'Song 2',                    artist: 'Blur' },
    { file: 'ryan-castro-colombia.mp3',     name: 'El Ritmo Que Nos Une',      artist: 'Ryan Castro & Colombia' },
    { file: 'doctor-krapula-pibe.mp3',      name: 'Pibe de Mi Barrio',         artist: 'Doctor Krapula' },
  ];

  // Start from a random song (avoid last one)
  const lastIdx = parseInt(sessionStorage.getItem('mp-last') || '-1');
  let idx;
  do { idx = Math.floor(Math.random() * SONGS.length); } while (idx === lastIdx && SONGS.length > 1);

  // ── STYLES ─────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #mp-wrap{position:fixed;bottom:18px;right:18px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none}
    #mp-toast{background:#001166;color:#fff;font-family:'Spline Sans Mono',monospace;font-size:10px;
      padding:10px 14px 10px 12px;border-left:4px solid #FCD116;
      box-shadow:4px 4px 0 rgba(0,0,0,.4);max-width:250px;pointer-events:auto;
      animation:mp-in .5s cubic-bezier(.22,.68,0,1.2) both}
    #mp-toast.hide{animation:mp-out .35s ease forwards}
    @keyframes mp-in{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
    @keyframes mp-out{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(60px)}}
    #mp-song{font-weight:700;font-size:11px;color:#FCD116;letter-spacing:.04em;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;margin-bottom:1px}
    #mp-artist{color:rgba(255,255,255,.55);font-size:9px;letter-spacing:.06em;margin-bottom:8px}
    #mp-bar-wrap{height:2px;background:rgba(255,255,255,.15);margin-bottom:8px}
    #mp-bar{height:2px;background:#FCD116;width:0%;transition:width .5s linear}
    #mp-controls{display:flex;align-items:center;justify-content:space-between;gap:6px}
    .mp-ctrl{background:transparent;border:1.5px solid rgba(255,255,255,.25);color:rgba(255,255,255,.7);
      width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;
      align-items:center;justify-content:center;transition:all .15s;padding:0}
    .mp-ctrl:hover{border-color:#FCD116;color:#FCD116;background:rgba(252,209,22,.1)}
    #mp-play{background:#FCD116;border-color:#FCD116;color:#001166;width:34px;height:34px;font-size:15px}
    #mp-play:hover{background:#ffe44d;border-color:#ffe44d}
    #mp-play.muted{background:#4b5563;border-color:#4b5563;color:rgba(255,255,255,.5)}
    #mp-fab{width:44px;height:44px;border-radius:50%;background:#001166;border:3px solid #FCD116;
      color:#FCD116;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;
      box-shadow:3px 3px 0 rgba(0,0,0,.35);transition:all .15s;pointer-events:auto}
    #mp-fab:hover{transform:scale(1.08);background:#0022aa}
    #mp-fab.muted{background:#4b5563;border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.4)}
  `;
  document.head.appendChild(style);

  // ── DOM ────────────────────────────────────────────────────
  const wrap = document.createElement('div'); wrap.id = 'mp-wrap';

  const toast = document.createElement('div'); toast.id = 'mp-toast';
  toast.innerHTML = `
    <div id="mp-song">🎵 —</div>
    <div id="mp-artist">—</div>
    <div id="mp-bar-wrap"><div id="mp-bar"></div></div>
    <div id="mp-controls">
      <button class="mp-ctrl" id="mp-prev" title="Anterior">⏮</button>
      <button class="mp-ctrl" id="mp-play" title="Silenciar / activar">🔊</button>
      <button class="mp-ctrl" id="mp-next" title="Siguiente">⏭</button>
    </div>
  `;

  const fab = document.createElement('button'); fab.id = 'mp-fab'; fab.title = 'Música';
  fab.textContent = '🎵';

  wrap.appendChild(toast);
  wrap.appendChild(fab);
  document.body.appendChild(wrap);

  // ── AUDIO ──────────────────────────────────────────────────
  const audio  = new Audio();
  audio.volume = 0.45;
  audio.loop   = false; // manual loop so we can go to next song

  let muted   = false;
  let started = false;

  function loadSong(i, autoplay) {
    idx = ((i % SONGS.length) + SONGS.length) % SONGS.length;
    sessionStorage.setItem('mp-last', idx);
    const s = SONGS[idx];
    audio.src = '/music/' + s.file;
    document.getElementById('mp-song').textContent   = '🎵 ' + s.name;
    document.getElementById('mp-artist').textContent = s.artist;
    document.getElementById('mp-bar').style.width    = '0%';
    if (autoplay && started) audio.play().catch(() => {});
  }

  audio.addEventListener('ended', () => loadSong(idx + 1, true));

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    document.getElementById('mp-bar').style.width = (audio.currentTime / audio.duration * 100) + '%';
  });

  loadSong(idx, false);

  function tryPlay() {
    if (started) return;
    started = true;
    audio.play().catch(() => { started = false; });
  }

  ['click','keydown','touchstart'].forEach(ev =>
    document.addEventListener(ev, tryPlay, { once: true })
  );

  // ── CONTROLS ───────────────────────────────────────────────
  const playBtn = document.getElementById('mp-play');
  const prevBtn = document.getElementById('mp-prev');
  const nextBtn = document.getElementById('mp-next');

  function toggleMute() {
    muted = !muted;
    audio.muted = muted;
    playBtn.textContent = muted ? '🔇' : '🔊';
    playBtn.classList.toggle('muted', muted);
    fab.classList.toggle('muted', muted);
    fab.textContent = muted ? '🔇' : '🎵';
    if (!muted) tryPlay();
    showToast();
  }

  playBtn.addEventListener('click', toggleMute);
  fab.addEventListener('click', () => {
    const hidden = toast.classList.contains('hide') || toast.style.animation?.includes('out');
    if (hidden || !toast.style.opacity) { showToast(); } else { toggleMute(); }
  });

  prevBtn.addEventListener('click', () => { loadSong(idx - 1, true); showToast(); });
  nextBtn.addEventListener('click', () => { loadSong(idx + 1, true); showToast(); });

  // ── TOAST AUTO-HIDE ────────────────────────────────────────
  let toastTimer;
  function showToast(ms = 5000) {
    clearTimeout(toastTimer);
    toast.classList.remove('hide');
    toastTimer = setTimeout(() => toast.classList.add('hide'), ms);
  }

  // Show on first song load after 1s
  setTimeout(() => showToast(6000), 1000);

  [toast, fab].forEach(el => {
    el.addEventListener('mouseenter', () => { clearTimeout(toastTimer); toast.classList.remove('hide'); });
    el.addEventListener('mouseleave', () => { toastTimer = setTimeout(() => toast.classList.add('hide'), 3000); });
  });
})();
