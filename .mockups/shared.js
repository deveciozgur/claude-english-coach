// Shared interactions for all five concept mockups (no framework, no network).
// Each page marks elements with data-* hooks; the visual design lives entirely in the page's CSS.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Views: [data-nav="studio"] buttons switch [data-view="studio"] sections.
  function show(view) {
    $$('[data-nav]').forEach((b) => b.setAttribute('aria-current', b.dataset.nav === view ? 'page' : 'false'));
    $$('[data-view]').forEach((v) => (v.hidden = !v.dataset.view.split(' ').includes(view)));
    document.body.dataset.active = view;
  }
  $$('[data-nav]').forEach((b) => b.addEventListener('click', () => show(b.dataset.nav)));

  // Accordions: [data-toggle] opens/closes its parent [data-item].
  $$('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const item = b.closest('[data-item]');
      const open = item.dataset.open !== 'true';
      item.dataset.open = open;
      b.setAttribute('aria-expanded', open);
    }),
  );

  // Feedback layer tabs: [data-layer] buttons show [data-pane].
  $$('[data-layer]').forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-layer]').forEach((x) => x.setAttribute('aria-selected', x === b));
      $$('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.layer));
    }),
  );

  // Flashcard: reveal, then grade 0-5.
  const cards = [
    { w: 'next to', m: 'yanında', ex: 'The café is next to the park.', up: 'adjacent to' },
    { w: 'breakfast', m: 'kahvaltı', ex: 'I have breakfast at 8.', up: 'brunch (informal)' },
  ];
  let ci = 0;
  function renderCard() {
    const c = cards[ci % cards.length];
    $$('[data-card-word]').forEach((e) => (e.textContent = c.w));
    $$('[data-card-meaning]').forEach((e) => (e.textContent = c.m));
    $$('[data-card-example]').forEach((e) => (e.textContent = `“${c.ex}”`));
    $$('[data-card-up]').forEach((e) => (e.textContent = c.up));
    $$('[data-card]').forEach((e) => (e.dataset.revealed = 'false'));
  }
  $$('[data-reveal]').forEach((b) => b.addEventListener('click', () => $$('[data-card]').forEach((e) => (e.dataset.revealed = 'true'))));
  $$('[data-q]').forEach((b) =>
    b.addEventListener('click', () => {
      const q = Number(b.dataset.q);
      $$('[data-card-log]').forEach((l) => (l.textContent = `${cards[ci % cards.length].w}: q${q} → ${q < 3 ? 'back tomorrow' : q === 3 ? 'same interval' : q === 4 ? 'next in 3d' : 'next in 7d'}`));
      ci++;
      renderCard();
    }),
  );
  renderCard();

  // Chat: send appends the learner message and a typed coach reply.
  const reply =
    'Strength|You used “since” with a time point, which is exactly how fluent speakers say it.\nRecast|I have been working in an office since 2020.\nPolish|With “since”, English uses the present perfect: am working → have been working.';
  $$('[data-chat-form]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('textarea, input', form);
      const text = input.value.trim();
      if (!text) return;
      const log = $(form.dataset.chatForm);
      const tplUser = $('template[data-tpl="user"]');
      const tplBot = $('template[data-tpl="bot"]');
      const u = tplUser.content.firstElementChild.cloneNode(true);
      (u.matches('[data-text]') ? u : $('[data-text]', u)).textContent = text;
      log.appendChild(u);
      input.value = '';
      const b = tplBot.content.firstElementChild.cloneNode(true);
      log.appendChild(b);
      const rows = reply.split('\n').map((l) => l.split('|'));
      let r = 0;
      const tick = setInterval(() => {
        if (r >= rows.length) return clearInterval(tick);
        const row = $(`[data-row="${rows[r][0]}"]`, b);
        if (row) row.hidden = false;
        r++;
        log.scrollTop = log.scrollHeight;
      }, 380);
      log.scrollTop = log.scrollHeight;
    }),
  );

  show(document.body.dataset.start || 'studio');
})();
