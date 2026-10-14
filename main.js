/* Dżentelmeni – interakcje i animacje (GSAP + ScrollTrigger + Lenis, efekty przeniesione z React Bits) */
(() => {
  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const finishIntro = () => { clearTimeout(window.__introT); doc.classList.remove('intro'); };

  $('#yr').textContent = new Date().getFullYear();

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (!reduce && typeof window.Lenis !== 'undefined') {
      lenis = new Lenis({ lerp: 0.11, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      window.__lenis = lenis;
    }
  }

  /* ---------- header + barber-pole progress ---------- */
  const top = $('#top');
  const pole = $('.pole');
  let lastY = 0;
  const onScroll = (y, max) => {
    top.classList.toggle('solid', y > 30);
    const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
    if (goingDown && y > 400) top.classList.add('hide');
    else if (goingUp || y < 400) top.classList.remove('hide');
    lastY = y;
    pole.style.setProperty('--p', max > 0 ? Math.min(1, y / max) : 0);
  };
  if (hasGsap) {
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (st) => onScroll(st.scroll(), ScrollTrigger.maxScroll(window)) });
  } else {
    addEventListener('scroll', () => onScroll(scrollY, doc.scrollHeight - innerHeight), { passive: true });
  }

  /* nav: highlight the section in view */
  const links = $$('.nav a');
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['cennik', 'salony', 'galeria', 'sms'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });

  /* ---------- CircularText (React Bits) – rotating seal around the gentleman ---------- */
  const ring = $('.badge .ring');
  if (ring) {
    const letters = Array.from(ring.dataset.ring);
    letters.forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.transform = `rotate(${(360 / letters.length) * i}deg)`;
      ring.appendChild(s);
    });
    if (hasGsap && !reduce) {
      const spin = gsap.to(ring, { rotation: 360, duration: 24, ease: 'none', repeat: -1 });
      const badge = $('.badge');
      badge.addEventListener('pointerenter', () => gsap.to(spin, { timeScale: 5, duration: 0.6 }));
      badge.addEventListener('pointerleave', () => gsap.to(spin, { timeScale: 1, duration: 0.9 }));
    }
  }

  /* ---------- intro ---------- */
  if (hasGsap && !reduce) {
    const lines = $$('.h-copy h1 .ln > span');
    gsap.set(lines, { y: 0, yPercent: 105 }); // y:0 clears the px offset GSAP would read from the CSS intro state
    gsap.set(['.h-copy .lead', '.hero .ctas'], { autoAlpha: 0, y: 18 });
    gsap.set('.mirror', { clipPath: 'circle(0% at 50% 50%)' });
    gsap.set('.mirror .glass img', { scale: 1.25 });
    gsap.set('.badge', { autoAlpha: 0, scale: 0.6, rotate: -40 });
    finishIntro();
    gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
      .to('.mirror', { clipPath: 'circle(50% at 50% 50%)', duration: 1.5, ease: 'expo.inOut' }, 0)
      .to('.mirror .glass img', { scale: 1, duration: 2.2, ease: 'power3.out' }, 0.2)
      .to(lines, { yPercent: 0, duration: 1.2, stagger: 0.11 }, 0.35)
      .to('.h-copy .lead', { autoAlpha: 1, y: 0, duration: 1 }, 0.85)
      .to('.hero .ctas', { autoAlpha: 1, y: 0, duration: 1 }, 1)
      .to('.badge', { autoAlpha: 1, scale: 1, rotate: 0, duration: 1.2, ease: 'back.out(1.6)' }, 1.05);

    /* mirror reflection drifts slowly while scrolling past the hero */
    gsap.to('.mirror .glass img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  } else {
    finishIntro();
  }

  /* ---------- reveals ---------- */
  const reveal = $$('[data-r]');
  if (hasGsap && !reduce) {
    ScrollTrigger.batch(reveal, {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, overwrite: true })
    });
    // elements already above the fold on load
    requestAnimationFrame(() => reveal.forEach((el) => { if (el.getBoundingClientRect().bottom < 0) gsap.set(el, { opacity: 1, y: 0 }); }));
    // price list rows slide in one after another, like reading a printed menu
    $$('.menu .grp').forEach((g) => {
      gsap.from($$('[data-ri]', g), { opacity: 0, x: -16, duration: 0.8, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 82%', once: true } });
    });
  } else {
    reveal.forEach((el) => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  /* ---------- CountUp (React Bits) ---------- */
  $$('[data-count]').forEach((el) => {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    const fmt = (v) => v.toFixed(dec).replace('.', ',');
    if (!hasGsap || reduce) { el.textContent = fmt(to); return; }
    const o = { v: 0 };
    el.textContent = fmt(0);
    gsap.to(o, { v: to, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => (el.textContent = fmt(o.v)) });
  });

  /* ---------- CurvedLoop (React Bits) – services travelling along a curve ---------- */
  const tp = $('#curveText');
  if (tp) {
    const words = ['Klasyczne', 'Fade', 'Buzz cut', 'Broda', 'Odsiwianie', 'Trwała ondulacja', 'Kontur brody'];
    const ns = 'http://www.w3.org/2000/svg';
    const build = (n) => {
      tp.textContent = '';
      for (let k = 0; k < n; k++) words.forEach((w) => {
        tp.appendChild(document.createTextNode(w + '  '));
        const t = document.createElementNS(ns, 'tspan'); t.setAttribute('class', 'g'); t.textContent = '✦  ';
        tp.appendChild(t);
      });
    };
    build(1);
    const seg = tp.getComputedTextLength() || 1400;
    build(4);
    let offset = 0, last = performance.now();
    const step = (now) => {
      const dt = Math.min(64, now - last); last = now;
      const v = lenis ? Math.max(-40, Math.min(40, lenis.velocity || 0)) : 0;
      offset -= (0.05 + Math.abs(v) * 0.02) * dt;
      if (offset <= -seg) offset += seg;
      tp.setAttribute('startOffset', offset.toFixed(1));
    };
    if (!reduce) {
      let running = false;
      const loop = (n) => { if (!running) return; step(n); requestAnimationFrame(loop); };
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
        else if (!e.isIntersecting) running = false;
      }).observe($('.curve'));
    }
  }

  /* ---------- opening hours + live open/closed status ---------- */
  const DAYS = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const DAYS_IN = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  const HOURS = {
    slowianska: { 0: null, 1: null, 2: [8, 17], 3: [8, 17], 4: [8, 17], 5: [8, 17], 6: [8, 13] },
    miarki: { 0: null, 1: [9, 18], 2: [9, 18], 3: 'var', 4: [9, 18], 5: [9, 18], 6: [8, 13] }
  };
  const nowWarsaw = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
    return { day: wd, h: +p.hour % 24 + +p.minute / 60 };
  };
  const hh = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  $$('[data-salon]').forEach((card) => {
    const H = HOURS[card.dataset.salon];
    const { day, h } = nowWarsaw();
    const list = $('[data-hours]', card);
    [1, 2, 3, 4, 5, 6, 0].forEach((d) => {
      const li = document.createElement('li');
      if (d === day) li.className = 'today';
      const v = H[d];
      li.innerHTML = `<span>${DAYS[d]}${d === day ? ' (dziś)' : ''}</span><span>${v === null ? 'nieczynne' : v === 'var' ? 'zmienne, info na FB' : `${hh(v[0])} - ${hh(v[1])}`}</span>`;
      list.appendChild(li);
    });
    const st = $('[data-status]', card), txt = st.querySelector('span');
    const today = H[day];
    if (Array.isArray(today) && h >= today[0] && h < today[1]) {
      st.classList.add('open');
      txt.textContent = `Otwarte, dziś do ${hh(today[1])}`;
    } else if (today === 'var') {
      txt.textContent = 'Dziś godziny zmienne, sprawdź Facebook';
    } else {
      let label = 'Zamknięte';
      for (let k = 0; k < 8; k++) {
        const d = (day + k) % 7, v = H[d];
        if (!Array.isArray(v)) continue;
        if (k === 0 && h >= v[0]) continue;
        const when = k === 0 ? 'dziś' : k === 1 ? 'jutro' : DAYS_IN[d];
        label = `Zamknięte, otwieramy ${when} o ${hh(v[0])}`;
        break;
      }
      txt.textContent = label;
    }
  });

  /* ---------- SMS ticket ---------- */
  const form = $('#sms');
  if (form) {
    const dayBox = $('#day');
    const SHORT = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
    const mk = (val, label, checked) => {
      const l = document.createElement('label'); l.className = 'chip';
      l.innerHTML = `<input type="radio" name="dzien" value="${val}"${checked ? ' checked' : ''}><span>${label}</span>`;
      dayBox.appendChild(l);
    };
    mk('jak najszybciej', 'Jak najszybciej', true);
    const base = new Date();
    let added = 0;
    for (let k = 1; k < 10 && added < 5; k++) {
      const d = new Date(base); d.setDate(base.getDate() + k);
      const wd = d.getDay();
      if (!Array.isArray(HOURS.slowianska[wd])) continue;
      const dm = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      mk(`${DAYS[wd].toLowerCase()} ${dm}`, `${SHORT[wd]} ${dm}`, false);
      added++;
    }
    const out = $('#smsText'), btn = $('#smsBtn');
    const compose = () => {
      const svc = $$('input[name="svc"]:checked', form).map((i) => i.value);
      const dzien = ($('input[name="dzien"]:checked', form) || {}).value || 'jak najszybciej';
      const pora = ($('input[name="pora"]:checked', form) || {}).value || 'obojętnie';
      const imie = $('#imie').value.trim();
      const lines = [
        'Dzień dobry, chciałbym się zapisać na wizytę w salonie przy Słowiańskiej.',
        `Usługa: ${svc.length ? svc.join(', ') : 'do ustalenia'}`,
        `Termin: ${dzien}${pora !== 'obojętnie' ? ', ' + pora : ''}`
      ];
      if (imie) lines.push(`Imię: ${imie}`);
      lines.push('Pozdrawiam');
      const msg = lines.join('\n');
      out.textContent = msg;
      btn.href = 'sms:+48503713441?&body=' + encodeURIComponent(msg);
    };
    form.addEventListener('input', compose);
    form.addEventListener('change', compose);
    form.addEventListener('submit', (e) => e.preventDefault());
    compose();
  }

  /* ---------- AccordionGallery (React Bits) ---------- */
  const acc = $('#acc');
  if (acc) {
    const panels = $$('.pn', acc);
    const wide = window.matchMedia('(min-width: 761px)');
    let active = panels.findIndex((p) => p.classList.contains('on'));
    const layout = (animate) => {
      if (!wide.matches) { panels.forEach((p) => { p.style.flexGrow = ''; p.style.transform = ''; }); return; }
      const grow = (0.5 * (panels.length - 1)) / 0.5;
      panels.forEach((p, i) => {
        const on = i === active;
        p.classList.toggle('on', on);
        const props = { flexGrow: on ? grow : 1, rotateY: on ? 0 : i < active ? 7 : -7, duration: animate && hasGsap && !reduce ? 0.7 : 0, ease: 'power3.out' };
        if (hasGsap) gsap.to(p, props); else { p.style.flexGrow = props.flexGrow; }
      });
    };
    panels.forEach((p, i) => {
      p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && active !== i) { active = i; layout(true); } });
      p.addEventListener('focus', () => { if (active !== i) { active = i; layout(true); } });
      p.addEventListener('click', () => { if (active !== i) { active = i; layout(true); } });
      p.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + panels.length) % panels.length;
          panels[n].focus();
        }
      });
    });
    layout(false);
    wide.addEventListener('change', () => layout(false));
  }

  /* ---------- mobile call bar ---------- */
  const bar = $('.bar');
  if (bar) {
    let pastHero = false, atEnd = false;
    const upd = () => bar.classList.toggle('on', pastHero && !atEnd);
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; upd(); }).observe($('.hero .ctas'));
    new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; upd(); }, { rootMargin: '0px 0px -20% 0px' }).observe($('#kontakt'));
  }
})();
