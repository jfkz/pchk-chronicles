/* Страница выпуска: история, таймлайн со скроллом, монеты, персонажи и связи. Данные — window.EPD. */
(function () {
  const D = window.EPD;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = s => String(s || '?').replace(/[«»"()]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const img = (src, cls, name) => src ? `<img class="${cls}" src="/${esc(src)}" alt="" loading="lazy">` : `<span class="${cls}" aria-hidden="true">${esc(initials(name))}</span>`;
  const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
  const yt = sec => `https://youtu.be/${D.video_id}` + (sec != null ? `?t=${Math.round(sec)}` : '');
  const epLink = (k, label, title) => `<a href="/ep/${esc(k)}/" title="${esc(title || '')}">#${esc(label)}</a>`;
  const epUrl = k => `/ep/${k}/`;
  const link = (url, text) => url ? `<a href="${esc(url)}">${esc(text)}</a>` : esc(text);
  const isDead = f => /погиб|умер|убит|сожж|казн|мёртв|мертв|рассыпал/i.test(f || '');
  document.documentElement.style.setProperty('--c', D.branch_color);

  const coinEv = (D.coins && D.coins.events || []).filter(e => e.kind !== 'loot');
  const coinLabel = e => ({ earn: 'получает монету', spend: 'тратит монету', give: 'передаёт монету' }[e.kind] || 'монета');

  /* единый список: сцены + монеты, по времени */
  const items = D.scenes.map(s => ({ ...s, type: 'scene' }));
  coinEv.forEach(e => { if (e.sec != null) items.push({ sec: e.sec, t: e.t, type: 'coin', e }); });
  items.sort((a, b) => (a.sec ?? 1e9) - (b.sec ?? 1e9) || (a.type === 'coin') - (b.type === 'coin'));
  const keySecs = D.key_events.map(k => k.sec).filter(x => x != null);
  items.forEach(it => { if (it.type === 'scene' && it.sec != null && keySecs.some(k => Math.abs(k - it.sec) <= 75)) it.key = true; });

  const T = D.duration;
  const anchor = it => 't-' + (it.sec != null ? fmt(it.sec).replace(/:/g, '-') : 'x') + (it.type === 'coin' ? '-coin' : '');
  const pct = s => (Math.min(T, Math.max(0, s)) / T * 100).toFixed(3) + '%';
  const ticks = []; const stepT = T > 6000 ? 1800 : 900;
  for (let s = stepT; s < T - 300; s += stepT) ticks.push(s);

  const toc = [['story', 'История'], ['timeline', 'Таймлайн'], ['coins', 'Монеты'], ['people', 'Персонажи'], ['links', 'Связи'], ['world', 'Мир и цитаты']];

  $('#app').innerHTML = `
  <div class="crumbs"><a href="/">Хроники Понии</a> › <a href="/#eps">Выпуски</a> › #${esc(D.label)}</div>
  <header class="ep-hero">
    <a href="${yt()}" target="_blank" rel="noopener"><img class="thumb" src="https://i.ytimg.com/vi/${esc(D.video_id)}/maxresdefault.jpg" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${esc(D.video_id)}/hqdefault.jpg'" alt="Обложка выпуска"></a>
    <div>
      <span class="eyebrow">Выпуск #${esc(D.label)} · ${esc(D.date.split('-').reverse().join('.'))} · ${D.minutes} мин</span>
      <h1>${esc(D.title)}</h1>
      <div class="meta"><a class="badge" style="--c:${D.branch_color}" href="/#map"><i></i>${esc(D.branch)}</a>${D.place ? `<span>${esc(D.place)}</span>` : ''}</div>
      <p class="lead">${D.short_html}</p>
      <div class="ep-nav">
        <a class="ytb" href="${yt()}" target="_blank" rel="noopener">▶ Смотреть на YouTube</a>
        <button class="btn" data-copy="${epUrl(D.key)}">Скопировать ссылку</button>
        ${D.prev ? `<a class="btn" href="${epUrl(D.prev.key)}">← #${esc(D.prev.label)}</a>` : ''}
        ${D.next ? `<a class="btn" href="${epUrl(D.next.key)}">#${esc(D.next.label)} →</a>` : ''}
        ${D.prevBranch ? `<a class="btn" href="${epUrl(D.prevBranch.key)}" title="${esc(D.prevBranch.title)}">← в ветви: #${esc(D.prevBranch.label)}</a>` : ''}
        ${D.nextBranch ? `<a class="btn" href="${epUrl(D.nextBranch.key)}" title="${esc(D.nextBranch.title)}">в ветви: #${esc(D.nextBranch.label)} →</a>` : ''}
      </div>
      <nav class="ep-toc">${toc.map(([id, l]) => `<a class="chip" href="#${id}">${l}</a>`).join('')}</nav>
    </div>
  </header>

  <section class="ep-sec" id="story"><h2>История</h2>
    <div class="ep-cols">
      <div><p style="margin:0">${D.summary_html}</p>${D.outcome_html ? `<div class="sec"><h3>Итог</h3><p style="margin:0">${D.outcome_html}</p></div>` : ''}</div>
      ${D.world_html.length ? `<div class="sec" style="margin:0"><h3>Что изменилось в мире</h3><ul class="plain">${D.world_html.map(w => `<li>— ${w}</li>`).join('')}</ul></div>` : ''}
    </div>
  </section>

  <section class="ep-sec" id="timeline"><h2>Таймлайн выпуска <small>${D.scenes.length} сцен · ${coinEv.length} событий с монетами</small></h2>
    <div class="scrub" id="scrub">
      <div class="read"><span class="now" id="now">0:00:00</span><span class="what" id="what"></span><a class="dur" id="watch" href="${yt(0)}" target="_blank" rel="noopener">▶ смотреть с этого места</a></div>
      <div class="track" id="track">
        <div class="bar"></div><div class="fill" id="fill"></div>
        ${items.filter(i => i.sec != null && i.type === 'scene').map(i => `<span class="mk${i.key ? ' key' : ''}" style="left:${pct(i.sec)}"></span>`).join('')}
        ${coinEv.filter(e => e.sec != null).map(e => `<span class="mk coin${e.kind === 'spend' ? ' spend' : ''}" style="left:${pct(e.sec)}" title="${esc(e.t)} ${esc(e.who || '')}: ${esc(e.reason || '')}"></span>`).join('')}
        ${ticks.map(s => `<span class="tick" style="left:${pct(s)}">${fmt(s).replace(/:00$/, '')}</span>`).join('')}
        <div class="head" id="head"></div>
        <input type="range" id="range" min="0" max="${Math.round(T)}" step="1" value="0" aria-label="Промотать выпуск">
      </div>
      <div class="legendline"><span><i style="width:6px;height:14px;background:var(--c);border-radius:2px"></i>ключевое событие</span><span><i style="width:4px;height:10px;background:var(--muted);border-radius:2px"></i>сцена</span><span><i style="width:9px;height:9px;background:var(--link);border-radius:50%"></i>монета получена</span><span><i style="width:9px;height:9px;border:2px solid var(--link);border-radius:50%"></i>монета потрачена</span><span>Тяните шкалу или прокручивайте список</span></div>
    </div>
    <ol class="scenes" id="scenes">${items.map((it, i) => it.type === 'scene'
      ? `<li class="scene${it.key ? ' key' : ''}" id="${anchor(it)}" data-i="${i}" data-sec="${it.sec ?? ''}"><span class="t">${it.sec != null ? `<a href="${yt(it.sec)}" target="_blank" rel="noopener" title="Смотреть с этого момента">${esc(it.t)}</a>` : esc(it.t || '')}</span><span class="rail"></span><div class="body">${it.html}${it.sec != null ? `<button class="share" data-copy="${epUrl(D.key)}#t=${fmt(it.sec)}" title="Скопировать ссылку на этот момент">🔗</button>` : ''}</div></li>`
      : `<li class="scene coin" id="${anchor(it)}" data-i="${i}" data-sec="${it.sec}"><span class="t"><a href="${yt(it.sec)}" target="_blank" rel="noopener">${esc(it.t)}</a></span><span class="rail"></span><div class="body"><b>${link(it.e.who_url, it.e.who || 'Игрок')}</b> ${coinLabel(it.e)}${it.e.to ? ' → ' + esc(it.e.to) : ''}: ${it.e.reason_html || esc(it.e.reason || '')}${it.e.result ? ` <span class="note">(${esc(it.e.result)})</span>` : ''}</div></li>`).join('')}</ol>
  </section>

  <section class="ep-sec" id="coins"><h2>Монеты <small>${D.coins ? coinEv.filter(e => e.kind === 'earn').length + ' выдано · ' + coinEv.filter(e => e.kind === 'spend').length + ' потрачено' : 'нет данных'}</small></h2>
    ${D.coins ? `
      <div class="coins-sum">${(D.coins.totals || []).map(t => `<div class="coin-card">${img(t.img, 'av', t.who)}<b>${link(t.who_url, t.who || '—')}</b><span>${link(t.actor_url, t.actor || '')} · <em>+${t.earned || 0}</em> / −${t.spent || 0}</span></div>`).join('')}</div>
      ${D.coins.notes ? `<p class="note" style="margin:0 0 10px">${esc(D.coins.notes)}</p>` : ''}
      <ul class="plain">${(D.coins.events || []).map(e => `<li>${e.sec != null ? `<a href="${yt(e.sec)}" target="_blank" rel="noopener" style="font:500 12px var(--mono)">${esc(e.t)}</a> ` : ''}<b style="font-weight:600">${link(e.who_url, e.who || 'Игрок')}</b> — ${e.kind === 'loot' ? 'деньги в игре' : coinLabel(e)}${e.to ? ' → ' + esc(e.to) : ''}: ${e.reason_html || esc(e.reason || '')}</li>`).join('')}</ul>`
      : '<p class="note">Разбор монет для этого выпуска пока не готов.</p>'}
  </section>

  <section class="ep-sec" id="people"><h2>Персонажи <small>${D.cast.length} в партии · ${D.npcs.length} NPC</small></h2>
    <h3 class="note" style="font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--link);margin:0 0 10px">Партия</h3>
    <div class="people">${D.cast.map(person).join('')}</div>
    ${D.npcs.length ? `<h3 style="font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--link);margin:22px 0 10px">Неигровые персонажи</h3><div class="people">${D.npcs.map(person).join('')}</div>` : ''}
  </section>

  <section class="ep-sec" id="links"><h2>Связи с другими выпусками</h2>
    ${D.links.length ? `<ul class="eplinks">${D.links.map(l => `<li style="--c:${l.color}"><span><a href="${epUrl(l.key)}" style="font:600 14px var(--mono)">#${esc(l.label)}</a><br><span class="dir">${l.dir === 'back' ? 'ссылается сюда' : 'отсылка'}</span></span><span><a href="${epUrl(l.key)}">${esc(l.title)}</a><br><span class="note">${l.note_html}</span></span></li>`).join('')}</ul>` : '<p class="note">Связей не найдено.</p>'}
  </section>

  <section class="ep-sec" id="world"><h2>Места, фракции, артефакты</h2>
    <div class="ep-cols">
      <div class="prose" style="max-width:none">${D.places_html || '<p class="note">—</p>'}</div>
      ${D.quotes_html.length ? `<div><h3 style="font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--link);margin:0 0 10px">Яркие цитаты</h3><ul class="quotes">${D.quotes_html.map(q => `<li>${q}</li>`).join('')}</ul></div>` : ''}
    </div>
    <p class="note" style="margin-top:16px">Полный конспект: <a href="/summaries/ep${esc(D.key)}.md">summaries/ep${esc(D.key)}.md</a></p>
  </section>

  <nav class="ep-foot-nav">${D.prev ? `<a class="btn" href="${epUrl(D.prev.key)}">← #${esc(D.prev.label)} ${esc(D.prev.title)}</a>` : '<span></span>'}${D.next ? `<a class="btn" href="${epUrl(D.next.key)}">#${esc(D.next.label)} ${esc(D.next.title)} →</a>` : ''}</nav>
  <footer>${D.footer}</footer>`;

  function person(p) {
    const pic = p.url ? `<a href="${esc(p.url)}" tabindex="-1">${img(p.img, 'portrait', p.name)}</a>` : img(p.img, 'portrait', p.name);
    return `<article class="person${isDead(p.fate) ? ' dead' : ''}">
      ${pic}
      <div><h3>${link(p.url, p.name)}</h3>
        <div class="sub">${[p.actor ? link(p.actor_url, p.actor) : '', esc(p.race || p.role)].filter(Boolean).join(' · ')}</div>
        ${p.fate ? `<div class="${isDead(p.fate) ? 'fate d' : 'fate'}" style="margin-top:3px">${esc(p.fate)}</div>` : ''}
        ${p.other.length ? `<div class="other"><span class="lbl">Ещё в:</span>${p.other.map(o => epLink(o.key, o.label, o.title)).join('')}</div>` : ''}
      </div></article>`;
  }

  /* таймлайн: шкала ↔ прокрутка списка */
  const rows = [...document.querySelectorAll('#scenes .scene')];
  const range = $('#range'), head = $('#head'), fill = $('#fill'), now = $('#now'), what = $('#what'), watch = $('#watch');
  let cur = -1, scrubbing = false;
  function setHead(sec, idx) {
    head.style.left = pct(sec); fill.style.width = pct(sec); range.value = Math.round(sec);
    now.textContent = fmt(sec); watch.href = yt(sec);
    if (idx !== cur) {
      if (rows[cur]) rows[cur].classList.remove('on');
      cur = idx; if (rows[cur]) { rows[cur].classList.add('on'); what.textContent = rows[cur].querySelector('.body').textContent; }
    }
  }
  function idxAt(sec) { let k = 0; rows.forEach((r, i) => { const s = r.dataset.sec; if (s !== '' && +s <= sec) k = i; }); return k; }
  range.addEventListener('input', () => {
    scrubbing = true; const sec = +range.value, i = idxAt(sec);
    setHead(sec, i); rows[i].scrollIntoView({ block: 'start' });
    clearTimeout(range._t); range._t = setTimeout(() => { scrubbing = false; }, 250);
  });
  function onScroll() {
    if (scrubbing) return;
    const line = $('#scrub').getBoundingClientRect().bottom + 24;
    let i = 0; for (let k = 0; k < rows.length; k++) { if (rows[k].getBoundingClientRect().top <= line) i = k; else break; }
    const s = rows[i].dataset.sec; setHead(s !== '' ? +s : 0, i);
  }
  let raf = 0; window.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(onScroll); }, { passive: true });
  if (rows.length) setHead(rows[0].dataset.sec !== '' ? +rows[0].dataset.sec : 0, 0);

  /* ссылки «скопировать» */
  document.querySelectorAll('[data-copy]').forEach(bt => bt.addEventListener('click', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const url = location.origin + bt.dataset.copy, old = bt.textContent;
    const done = () => { bt.textContent = bt.classList.contains('share') ? '✓' : 'Ссылка скопирована'; setTimeout(() => bt.textContent = old, 1500); };
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(done, () => prompt('Ссылка:', url));
  }));

  /* переход к моменту: /ep/NN/#t=0:12:30 или #t=750 */
  function jump() {
    const m = decodeURIComponent(location.hash).match(/^#t=(?:(\d+):)?(\d+)(?::(\d+))?$/);
    if (!m) return;
    const sec = m[3] != null ? (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3] : m[1] != null ? +m[1] * 60 + +m[2] : +m[2];
    const i = idxAt(sec); scrubbing = true; setHead(rows[i].dataset.sec !== '' ? +rows[i].dataset.sec : sec, i);
    rows[i].scrollIntoView({ block: 'start' }); rows[i].classList.add('on');
    setTimeout(() => { scrubbing = false; }, 400);
  }
  window.addEventListener('hashchange', jump);
  if (location.hash) setTimeout(jump, 50);
})();
