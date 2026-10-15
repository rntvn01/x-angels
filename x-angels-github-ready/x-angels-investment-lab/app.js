'use strict';
(() => {
  const STORAGE_KEY = 'xangels-investment-lab-v1';
  // This organization mailbox is public client configuration, not a secret.
  const RECIPIENT = 'info@astanaventure.com';
  const ALLOWED_AMOUNTS = [25000, 50000, 75000, 100000];
  const $ = id => document.getElementById(id);
  const fields = ['participant', 'email', 'thesis', 'risks', 'checks'];
  const limits = { participant: 100, email: 254, thesis: 4000, risks: 2000, checks: 2000 };
  const panels = [$('case-panel'), $('reason-panel'), $('result-panel')];
  const money = n => '$' + Number(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  const percent = n => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  const initial = () => ({ amount: null, participant: '', email: '', thesis: '', risks: '', checks: '', completed: false, completedAt: null, stage: 0, lastSentFingerprint: '', pendingFingerprint: '', submissionId: '', pendingAt: '' });
  let state = initial();
  let storageAvailable = true;
  let isSubmitting = false;
  let toastTimer;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const field of fields) if (typeof raw[field] === 'string') state[field] = raw[field].slice(0, limits[field]);
      if (ALLOWED_AMOUNTS.includes(raw.amount)) state.amount = raw.amount;
      for (const field of ['completedAt', 'lastSentFingerprint', 'pendingFingerprint', 'submissionId', 'pendingAt']) if (typeof raw[field] === 'string') state[field] = raw[field];
      state.completed = raw.completed === true && hasValidAnswer() && state.lastSentFingerprint === fingerprint();
      state.stage = state.completed || raw.stage === 2 ? 2 : raw.stage === 1 && state.amount ? 1 : 0;
    }
  } catch (_) { storageAvailable = false; }

  function validEmail(email) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  function hasValidAnswer() {
    return ALLOWED_AMOUNTS.includes(state.amount) && state.thesis.trim().length >= 1 && (!state.email.trim() || validEmail(state.email.trim())) && fields.every(field => state[field].length <= limits[field]);
  }
  function fingerprint() { return JSON.stringify([state.amount, ...fields.map(field => state[field].trim())]); }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageAvailable = true; }
    catch (_) { storageAvailable = false; }
    $('save-note').textContent = storageAvailable ? 'Черновик сохраняется только в этом браузере.' : 'Черновик не сохраняется. Оставьте страницу открытой.';
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
  }
  function showStage(stage, focus = true) {
    if (isSubmitting) { toast('Отправляем тезис. Дождитесь результата.'); return; }
    if (stage === 1 && !state.amount) stage = 0;
    state.stage = stage;
    panels.forEach((panel, i) => { panel.hidden = i !== stage; });
    document.querySelectorAll('.journey li').forEach((item, i) => {
      item.classList.toggle('current', i === stage); item.classList.toggle('done', i < stage);
      if (i === stage) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    if (stage === 1) renderSelection();
    persist();
    if (stage === 2) renderResult();
    if (focus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      $(['case-heading', 'reason-heading', 'result-heading'][stage]).focus({ preventScroll: true });
    }
  }
  function renderSelection() {
    $('chosen-amount').textContent = money(state.amount);
    $('chosen-budget').textContent = percent(state.amount / 500000 * 100) + '% бюджета';
    $('chosen-equity').textContent = percent(state.amount / 2400000 * 100) + '%';
  }
  function updateChoice() {
    $('to-reason').disabled = !state.amount;
    $('amount-hint').textContent = state.amount ? 'Ваш выбор: ' + money(state.amount) + ' — ' + percent(state.amount / 500000 * 100) + '% бюджета.' : 'Выберите сумму, чтобы поделиться своим тезисом.';
    document.querySelectorAll('input[name="amount"]').forEach(input => { input.checked = Number(input.value) === state.amount; });
  }
  function renderResult() {
    const submitted = state.completed && hasValidAnswer() && state.lastSentFingerprint === fingerprint();
    const allocation = state.amount / 500000 * 100;
    $('answer-card').hidden = !submitted;
    $('delivery-status').hidden = !submitted;
    $('result-lead').textContent = submitted ? 'Ваш тезис сохранён. Продолжим разбор.' : 'Сравните свой подход с вопросами для разбора.';
    $('result-to-thesis').hidden = submitted;
    $('sizing-title').textContent = state.amount ? percent(allocation) + '% бюджета в одном стартапе' : 'Какой резерв оставить?';
    $('sizing-copy').textContent = state.amount ? 'Останется ' + money(500000 - state.amount) + '. Хватит ли резерва для других сделок и следующих раундов?' : 'Сколько сохранить для других сделок и следующих раундов?';
    if (!submitted) return;
    $('result-amount').textContent = money(state.amount);
    $('result-details').textContent = percent(allocation) + '% бюджета · около ' + percent(state.amount / 2400000 * 100) + '% доли при полном раунде';
    $('result-person').textContent = state.participant.trim();
    $('result-person').hidden = !state.participant.trim();
    for (const field of ['thesis', 'risks', 'checks']) $('result-' + field).textContent = state[field].trim();
    for (const field of ['risks', 'checks']) $('result-' + field + '-block').hidden = !state[field].trim();
    $('delivery-status').textContent = 'Ответ ' + state.submissionId.slice(0, 8) + ' принят сервисом отправки. Лучший анализ выберут организаторы.';
    document.querySelector('.answer-foot>span').textContent = storageAvailable ? 'Копия сохранена в этом браузере.' : 'Скачайте копию: сохранение в браузере недоступно.';
  }
  function answerText() {
    const lines = [
      'X ANGELS — ИНВЕСТИЦИОННЫЙ ТЕЗИС', 'Учебный кейс 001 · PropTech',
      'Номер ответа: ' + state.submissionId
    ];
    if (state.participant.trim()) lines.push('Участник: ' + state.participant.trim());
    if (state.email.trim()) lines.push('Почта: ' + state.email.trim());
    lines.push('Инвестиция: ' + money(state.amount), 'Доля учебного бюджета: ' + percent(state.amount / 500000 * 100) + '%', 'Ориентировочная доля при полном раунде: ' + percent(state.amount / 2400000 * 100) + '%', '', 'ИНВЕСТИЦИОННЫЙ ТЕЗИС', state.thesis.trim());
    if (state.risks.trim()) lines.push('', 'ГЛАВНЫЙ РИСК', state.risks.trim());
    if (state.checks.trim()) lines.push('', 'ВОПРОСЫ ПЕРЕД СДЕЛКОЙ', state.checks.trim());
    lines.push('', 'Время ответа (UTC): ' + (state.completedAt || state.pendingAt || ''), '', 'Приз за лучший анализ. Правильной суммы нет.', 'Все цифры и условия кейса вымышлены.');
    return lines.join('\n');
  }
  function download(text, name) {
    const blob = new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function setSubmitting(value) {
    isSubmitting = value;
    [...fields, 'back-case', 'back-case-bottom', 'submit-answer', 'skip-answer'].forEach(id => { $(id).disabled = value; });
    $('submit-answer').textContent = value ? 'Отправляем…' : 'Отправить тезис';
    $('thesis-form').setAttribute('aria-busy', String(value));
  }
  function showError(message) { $('form-error').textContent = message; $('form-error').hidden = false; }
  for (const field of fields) {
    $(field).value = state[field];
    $(field).addEventListener('input', () => {
      state[field] = $(field).value; state.completed = false;
      $(field).removeAttribute('aria-invalid'); $('form-error').hidden = true;
      persist();
    });
  }
  if (state.risks || state.checks) document.querySelector('.extra-fields').open = true;
  document.querySelectorAll('input[name="amount"]').forEach(input => input.addEventListener('change', () => {
    if (!ALLOWED_AMOUNTS.includes(Number(input.value))) return;
    state.amount = Number(input.value); state.completed = false; updateChoice(); persist();
  }));
  $('to-reason').addEventListener('click', () => { if (state.amount) showStage(1); });
  ['back-case', 'back-case-bottom'].forEach(id => $(id).addEventListener('click', () => showStage(0)));
  ['skip-case', 'skip-answer'].forEach(id => $(id).addEventListener('click', () => showStage(2)));
  $('result-to-thesis').addEventListener('click', () => showStage(state.amount ? 1 : 0));
  $('edit-answer').addEventListener('click', () => { state.completed = false; showStage(1); });
  $('brand-link').addEventListener('click', event => { event.preventDefault(); showStage(0); });
  $('thesis-form').addEventListener('submit', async event => {
    event.preventDefault(); if (isSubmitting) return;
    if ($('website').value) { showError('Не удалось отправить. Обновите страницу.'); return; }
    let firstInvalid = null;
    for (const field of fields) {
      state[field] = $(field).value;
      const value = state[field].trim();
      const invalid = state[field].length > limits[field] || (field === 'thesis' && value.length < 1) || (field === 'email' && value && !validEmail(value));
      if (invalid) { $(field).setAttribute('aria-invalid', 'true'); if (!firstInvalid) firstInvalid = field; }
      else $(field).removeAttribute('aria-invalid');
    }
    if (firstInvalid) {
      const message = firstInvalid === 'email' ? 'Проверьте почту или оставьте поле пустым.' : firstInvalid === 'thesis' && !state.thesis.trim() ? 'Добавьте тезис: достаточно одного символа.' : 'Сократите текст до допустимой длины.';
      showError(message); $(firstInvalid).focus(); return;
    }
    if (!ALLOWED_AMOUNTS.includes(state.amount)) { showStage(0); return; }
    const currentFingerprint = fingerprint();
    if (state.lastSentFingerprint === currentFingerprint) { state.completed = true; showStage(2); return; }
    if (state.pendingFingerprint !== currentFingerprint || !state.submissionId) {
      state.submissionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      state.pendingAt = new Date().toISOString(); state.pendingFingerprint = currentFingerprint;
    }
    persist(); $('form-error').hidden = true;
    const payload = {
      name: state.participant.trim() || 'Участник без имени',
      _subject: 'X Angels | Тезис ' + state.submissionId.slice(0, 8) + ' | ' + money(state.amount),
      _template: 'table', _captcha: 'false', _honey: '', _url: location.origin + location.pathname,
      'Номер ответа': state.submissionId, 'Учебный кейс': '001 — PropTech. Все цифры и условия вымышлены.',
      'Учебный чек (USD)': String(state.amount), 'Доля учебного бюджета': percent(state.amount / 500000 * 100) + '%',
      'Инвестиционный тезис': state.thesis.trim(),
      'Время ответа (UTC)': state.pendingAt,
      'Правило конкурса': 'Нет правильной суммы. Приз за лучший анализ бизнеса и рисков.',
      'Условия отправки': 'Участник нажал «Отправить тезис» под уведомлением о передаче заполненных полей организаторам через FormSubmit.'
    };
    if (state.email.trim()) payload.email = state.email.trim();
    if (state.risks.trim()) payload['Главный риск'] = state.risks.trim();
    if (state.checks.trim()) payload['Вопросы перед сделкой'] = state.checks.trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setSubmitting(true);
    try {
      const response = await fetch('https://formsubmit.co/ajax/' + RECIPIENT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) throw new Error('delivery');
      const result = await response.json();
      if (result.success !== true && result.success !== 'true') throw new Error('delivery');
      state.completed = true; state.completedAt = state.pendingAt; state.lastSentFingerprint = currentFingerprint;
      setSubmitting(false); showStage(2);
    } catch (_) {
      state.completed = false; persist();
      showError('Приём ответа не подтверждён. Текст остался в форме — попробуйте ещё раз. Повторная отправка сохранит номер ответа.');
      $('form-error').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally { clearTimeout(timeout); setSubmitting(false); }
  });
  $('download-answer').addEventListener('click', () => { download(answerText(), 'X_Angels_Investment_Thesis.txt'); toast('Ответ скачан.'); });
  $('copy-answer').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(answerText()); toast('Ответ скопирован.'); }
    catch (_) { toast('Используйте кнопку «Скачать ответ».'); }
  });
  $('checklist-toggle').addEventListener('click', () => {
    const isOpen = $('checklist-toggle').getAttribute('aria-expanded') === 'true';
    $('checklist').hidden = isOpen; $('checklist-toggle').setAttribute('aria-expanded', String(!isOpen));
    $('checklist-toggle').textContent = isOpen ? 'Открыть чек-лист' : 'Свернуть чек-лист';
  });
  $('download-checklist').addEventListener('click', () => {
    const items = Array.from($('checklist').querySelectorAll('li')).map((li, index) => (index + 1) + '. ' + li.textContent);
    download('X ANGELS\nПЯТЬ ВОПРОСОВ ДО ИНВЕСТИЦИИ\n\n' + items.join('\n\n'), 'X_Angels_Due_Diligence_Checklist.txt');
  });
  $('about-open').addEventListener('click', () => $('about-dialog').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $('about-dialog').close()));
  $('restart-open').addEventListener('click', () => $('restart-dialog').showModal());
  $('restart-cancel').addEventListener('click', () => $('restart-dialog').close());
  $('restart-confirm').addEventListener('click', () => {
    $('restart-dialog').close(); state = initial();
    fields.forEach(field => { $(field).value = ''; $(field).removeAttribute('aria-invalid'); });
    $('form-error').hidden = true;
    $('checklist').hidden = true; $('checklist-toggle').setAttribute('aria-expanded', 'false'); $('checklist-toggle').textContent = 'Открыть чек-лист';
    document.querySelectorAll('details').forEach(details => { details.open = false; });
    updateChoice(); showStage(0);
  });
  window.addEventListener('beforeunload', event => { if (isSubmitting) { event.preventDefault(); event.returnValue = ''; } });
  updateChoice(); showStage(state.stage, false);
})();
