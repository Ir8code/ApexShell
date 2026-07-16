// Apex — the per-seat checklist pane (J90). the operator's constant tracker in the
// chat's right rail: the seat registers tasks/items in its todo file and this
// pane mirrors it live; the user adds/edits here and the main-side todo module
// writes the file + notifies the seat. R26 discipline: every edit is posted
// as intent and the pane re-renders ONLY from the todoList echo — what you
// see is file truth, never renderer hope.
'use strict';
window.ApexTodoPane = function ({ container, seatId }) {
  const post = (t, m) => ApexBus.post(t, m);
  container.innerHTML =
    '<div class="tpHead"><span>CHECKLIST</span><span class="tpCount"></span></div>' +
    '<div class="tpErr" hidden></div>' +
    '<div class="tpList"></div>' +
    // the add affordance floats under the list — just a plus (the operator, 2026-07-15)
    '<button class="tpAdd" title="add a task or list item">＋</button>' +
    '<form class="tpForm" hidden>' +
      '<select name="type"><option value="task">task</option>' +
        '<option value="item">list item</option></select>' +
      '<input name="title" placeholder="title — a few words" maxlength="120" required>' +
      '<div class="tpTaskFields">' +
        '<input name="delegate" list="tpDelegates-' + seatId + '" placeholder="delegate — who does it" maxlength="40">' +
        '<datalist id="tpDelegates-' + seatId + '"><option value="self">' +
          '<option value="User"><option value="qwen"><option value="fable">' +
          '<option value="opus"><option value="sonnet"><option value="haiku">' +
          '<option value="codex"></datalist>' +
        '<select name="status"><option value="todo">todo</option>' +
          '<option value="in-progress">in progress</option>' +
          '<option value="done">done</option>' +
          '<option value="blocked">blocked</option></select>' +
      '</div>' +
      '<input name="notes" placeholder="notes (optional)" maxlength="1000">' +
      '<div class="tpBtns"><button type="submit" class="tpSave">Save</button>' +
        '<button type="button" class="tpCancel">Cancel</button>' +
        '<button type="button" class="tpDelete" hidden>Delete</button></div>' +
    '</form>';

  const listEl = container.querySelector('.tpList');
  const errEl = container.querySelector('.tpErr');
  const countEl = container.querySelector('.tpCount');
  const form = container.querySelector('.tpForm');
  const f = (n) => form.elements[n];
  let editingId = null;       // null = add mode
  let entries = [];

  const syncTypeFields = () => {
    const task = f('type').value === 'task';
    form.querySelector('.tpTaskFields').hidden = !task;
    f('delegate').required = task;   // the contract: a task NEEDS its delegate
  };
  f('type').onchange = syncTypeFields;

  // Click-off closes (J93). pointerdown fires before click, so a pencil click
  // closes-then-reopens seamlessly; the ＋ is excluded so its own click can
  // toggle instead of always seeing a freshly-closed form.
  const addBtn = container.querySelector('.tpAdd');
  const onDocDown = (ev) => {
    if (form.contains(ev.target) || ev.target === addBtn) return;
    closeForm();
  };
  function openForm(entry) {
    editingId = entry ? entry.id : null;
    f('type').value = entry ? entry.type : 'task';
    f('title').value = entry ? entry.title : '';
    f('delegate').value = (entry && entry.delegate) || '';
    f('status').value = (entry && entry.status) || 'todo';
    f('notes').value = (entry && entry.notes) || '';
    form.querySelector('.tpDelete').hidden = !entry;
    syncTypeFields();
    form.hidden = false;
    document.addEventListener('pointerdown', onDocDown);
    f('title').focus();
  }
  // reset on close too — openForm() repopulates anyway, but the always-visible
  // bug (J92) showed stale fields lingering; belt-and-suspenders
  const closeForm = () => {
    form.hidden = true; editingId = null; form.reset();
    document.removeEventListener('pointerdown', onDocDown);
  };

  addBtn.onclick = () => { form.hidden ? openForm(null) : closeForm(); };
  form.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeForm(); });
  form.querySelector('.tpCancel').onclick = closeForm;
  form.querySelector('.tpDelete').onclick = () => {
    if (editingId) post('todoRemove', { id: seatId, entryId: editingId });
    closeForm();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const entry = {
      type: f('type').value, title: f('title').value.trim(),
      delegate: f('delegate').value.trim(), status: f('status').value,
      notes: f('notes').value.trim(),
    };
    if (!entry.title) return;
    if (editingId) post('todoUpdate', { id: seatId, entryId: editingId, patch: entry });
    else post('todoAdd', { id: seatId, entry });
    closeForm();
  };

  function row(e) {
    const r = document.createElement('div');
    r.className = 'tpRow ' + e.type + (e.status === 'done' ? ' done' : '');
    if (e.notes) r.title = e.notes;
    if (e.type === 'task') {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = e.status === 'done';
      box.title = box.checked ? 'reopen' : 'mark done';
      box.onchange = () => post('todoUpdate', {
        id: seatId, entryId: e.id, patch: { status: box.checked ? 'done' : 'todo' } });
      r.appendChild(box);
    } else {
      const b = document.createElement('span');
      b.className = 'tpBullet'; b.textContent = '▪';
      r.appendChild(b);
    }
    const t = document.createElement('span');
    t.className = 'tpTitle'; t.textContent = e.title;
    r.appendChild(t);
    if (e.type === 'task' && e.delegate) {
      const chip = document.createElement('span');
      chip.className = 'tpChip ' +
        (e.delegate === 'self' ? 'self' : e.delegate === 'User' ? 'user' : 'model');
      chip.textContent = e.delegate === 'self' ? 'self' : '→ ' + e.delegate;
      chip.title = 'delegate: ' + e.delegate;
      r.appendChild(chip);
    }
    if (e.type === 'task' && (e.status === 'in-progress' || e.status === 'blocked')) {
      const st = document.createElement('span');
      st.className = 'tpStatus ' + e.status;
      st.textContent = e.status === 'in-progress' ? '⋯' : '⛔';
      st.title = e.status;
      r.appendChild(st);
    }
    const ed = document.createElement('button');
    ed.className = 'tpEdit'; ed.textContent = '✎'; ed.title = 'edit';
    ed.onclick = () => openForm(e);
    r.appendChild(ed);
    return r;
  }

  function update(m) {
    entries = m.entries || [];
    errEl.hidden = !m.error;
    errEl.textContent = m.error ? 'list file: ' + m.error : '';
    listEl.textContent = '';
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'tpEmpty';
      empty.textContent = 'nothing tracked yet';
      listEl.appendChild(empty);
    } else {
      for (const e of entries) listEl.appendChild(row(e));
    }
    const tasks = entries.filter((e) => e.type === 'task');
    countEl.textContent = tasks.length
      ? tasks.filter((e) => e.status === 'done').length + '/' + tasks.length : '';
  }

  update({ entries: [] });
  return { update, hide: () => { container.hidden = true; } };
};
