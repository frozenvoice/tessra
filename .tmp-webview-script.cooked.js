
const vscode = acquireVsCodeApi();

// === ???곹깭 愿由?===
let tabs = [];       // { id, name, method, url, headers, params, body, auth, response, error, loading }
let activeTabId = null;
let tabIdCounter = 0;
let currentEnvName = null;
let editingEnvId = null;
let activeVarKeys = [];  // ?쒖꽦 ?섍꼍??蹂????紐⑸줉
let pendingSaveBtn = null;          // Save 踰꾪듉 ?ㅼ씠?쇰줈洹??꾨즺 ?湲?
let pendingSaveResponseBtn = null;  // Save Response Body 踰꾪듉 ?ㅼ씠?쇰줈洹??꾨즺 ?湲?
var _pendingCloseAfterSave = null;  // dirty ???リ린 ????????レ쓣 ??ID
const VALID_BODY_TYPES = ['none', 'json', 'xml', 'form', 'formdata', 'binary', 'raw'];

// === ?묐떟 鍮꾧탳 (Pin / Compare) ===
var pinnedResponses = [];  // [{ label, body, contentType, timestamp, tabId, formatStyle, formatIndent, formatLang }]
var lastResponse = null;   // 吏곸쟾 ?묐떟 (鍮좊Ⅸ 鍮꾧탳??

// Pin???묐떟??body瑜???λ맂 ?щ㎎ ?ㅽ??쇰줈 ?щ㎎??
function formatPinnedBody(pin) {
  if (pin.formatLang && pin.formatStyle) {
    if (pin.formatLang === 'json') return formatJson(pin.body, pin.formatStyle, pin.formatIndent);
    if (pin.formatLang === 'xml') return formatXml(pin.body, pin.formatStyle, pin.formatIndent);
  }
  return pin.body;
}

// Pin/Compare 踰꾪듉 ?곹깭 ?쇨큵 媛깆떊
function updatePinCompareButtons(mc) {
  var pinBtn = mc.querySelector('.js-pin-response');
  if (pinBtn) {
    pinBtn.innerHTML = pinSvg + ' Pin' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '');
  }
  var cmpBtn = mc.querySelector('.js-compare-responses');
  if (cmpBtn) {
    if (pinnedResponses.length >= 2) {
      cmpBtn.disabled = false;
      cmpBtn.classList.add('ready');
    } else {
      cmpBtn.disabled = true;
      cmpBtn.classList.remove('ready');
    }
    cmpBtn.innerHTML = diffSvg + ' Compare' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '');
  }
}
var pinSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1C8.55228 1 9 1.44772 9 2V7.586L12.707 3.879C13.098 3.488 13.731 3.488 14.121 3.879C14.512 4.269 14.512 4.902 14.121 5.293L9 10.414V14C9 14.5523 8.55228 15 8 15C7.44772 15 7 14.5523 7 14V10.414L1.879 5.293C1.488 4.902 1.488 4.269 1.879 3.879C2.269 3.488 2.902 3.488 3.293 3.879L7 7.586V2C7 1.44772 7.44772 1 8 1Z"/></svg>';
var diffSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4h5v1H2V4zm0 3h5v1H2V7zm0 3h5v1H2v-1zm9-6h5v1h-5V4zm0 3h5v1h-5V7zm0 3h5v1h-5v-1zM8 1v14l-1-1V2l1-1z"/></svg>';

function normalizeBodyType(bodyType) {
  if (VALID_BODY_TYPES.indexOf(bodyType) >= 0) return bodyType;
  return bodyType === 'text' ? 'raw' : 'none';
}

// === ??諛?===
const tabBar = document.getElementById('tabBar');
const addTabBtn = document.getElementById('addTabBtn');
const mainContent = document.getElementById('mainContent');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');

addTabBtn.addEventListener('click', () => createTab());
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); createTab(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeTabId) { e.preventDefault(); closeTab(activeTabId); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handlePrimaryAction(); }
});

// ???ㅻ깄???앹꽦 (dirty 鍮꾧탳??
function snapshotTab(tab) {
  return JSON.stringify({
    method: tab.method, url: tab.url,
    headers: tab.headers, params: tab.params,
    body: tab.body, bodyType: tab.bodyType,
    formData: tab.formData, binaryFilePath: tab.binaryFilePath,
    auth: tab.auth, scripts: tab.scripts, timeout: tab.timeout
  });
}

// ??씠 dirty ?곹깭?몄? ?먮퀎
function isTabDirty(tab) {
  if (!tab) return false;
  // ???? URL, ?ㅻ뜑, ?뚮씪誘명꽣, 諛붾뵒 以??섎굹?쇰룄 ?낅젰?섎㈃ dirty
  if (!tab._snapshot) {
    return !!(
      tab.url ||
      tab.headers.some(function(h){return h.key||h.value}) ||
      tab.params.some(function(p){return p.key||p.value}) ||
      tab.body ||
      (tab.formData || []).some(function(field){return field.key || field.value}) ||
      tab.binaryFilePath ||
      tab.scripts?.preRequest ||
      tab.scripts?.test
    );
  }
  // 而щ젆?섏뿉??遺덈윭???? ?ㅻ깄???鍮?蹂寃?媛먯?
  return snapshotTab(tab) !== tab._snapshot;
}

// dirty ?곹깭 媛깆떊 ????諛?由щ젋??
function markDirty() {
  var tab = tabs.find(function(t){return t.id === activeTabId});
  if (!tab) return;
  saveActiveTabState();
  var wasDirty = tab.dirty;
  tab.dirty = isTabDirty(tab);
  if (tab.dirty !== wasDirty) renderTabBar();
}

function createTab(data) {
  const id = 'tab_' + (++tabIdCounter);
  const tab = {
    id,
    requestId: data?.requestId || null,  // 而щ젆???덉뒪?좊━ ?붿껌 ID (以묐났 ??諛⑹?)
    name: data?.name || 'New Request',
    method: data?.method || 'GET',
    url: data?.url || '',
    headers: data?.headers || [],
    params: data?.params || [],
    body: data?.body || '',
    bodyType: normalizeBodyType(data?.bodyType),
    formData: data?.formData || [],
    binaryFilePath: data?.binaryFilePath || '',
    auth: data?.auth || { type: 'none' },
    scripts: data?.scripts || { preRequest: '', test: '' },
    timeout: data?.timeout ?? 0,
    pinned: data?.pinned || false,
    dirty: false,
    _snapshot: null,  // 而щ젆?섏뿉??遺덈윭????쓽 ?먮낯 ?ㅻ깄??
    response: null,
    resolvedUrl: '',
    resolvedHeaders: [],
    scriptResults: null,
    error: null,
    loading: false,
    progressVisible: false,
    slideIn: false,
    sendTime: 0,
  };
  // 而щ젆???덉뒪?좊━?먯꽌 遺덈윭????씠硫??ㅻ깄?????
  if (data?.requestId) {
    tab._snapshot = snapshotTab(tab);
  }
  tabs.push(tab);
  switchTab(id);
  if (data) debouncePersist();
  return id;
}

function clearTabRequestState(tab) {
  if (!tab) return;
  tab.loading = false;
  tab.progressVisible = false;
  if (tab._progressTimer) { clearTimeout(tab._progressTimer); tab._progressTimer = null; }
  if (tab._elapsedTimer) { clearInterval(tab._elapsedTimer); tab._elapsedTimer = null; }
}

function doCloseTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx < 0) return;
  const tab = tabs[idx];
  if (tab?.loading) {
    clearTabRequestState(tab);
    vscode.postMessage({ type: 'cancelRequest', tabId: id });
  }
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
  }
  renderTabBar();
  renderContent();
  debouncePersist();
}

function closeTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (tab.pinned) return;
  // dirty ?곹깭硫??꾩옱 ??媛??숆린?????ы솗??
  if (id === activeTabId) saveActiveTabState();
  tab.dirty = isTabDirty(tab);
  if (tab.dirty) {
    showDirtyConfirm(id);
    return;
  }
  doCloseTab(id);
}

// dirty ???リ린 ?뺤씤 ?ㅼ씠?쇰줈洹?
function showDirtyConfirm(tabId) {
  // 湲곗〈 ?ㅼ씠?쇰줈洹??쒓굅
  var old = document.getElementById('dirtyConfirmOverlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'dirtyConfirmOverlay';
  overlay.className = 'dirty-confirm-overlay';
  overlay.innerHTML =
    '<div class="dirty-confirm-dialog">' +
      '<div class="dirty-confirm-msg">There are unsaved changes. Close this tab?</div>' +
      '<div class="dirty-confirm-actions">' +
        '<button class="dirty-btn dirty-btn-save" data-action="save">Save</button>' +
        '<button class="dirty-btn dirty-btn-discard" data-action="discard">Discard</button>' +
        '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">痍⑥냼</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    overlay.remove();
    if (action === 'save') {
      // ??????リ린: saveRequest ?꾩넚 ??寃곌낵?먯꽌 ???リ린
      var tab = tabs.find(function(t){return t.id === tabId});
      if (tab && tab.url) {
        if (tabId === activeTabId) saveActiveTabState();
        _pendingCloseAfterSave = tabId;
        vscode.postMessage({ type: 'saveRequest', requestId: tab.requestId || undefined, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' } });
      } else {
        doCloseTab(tabId);
      }
    } else if (action === 'discard') {
      doCloseTab(tabId);
    }
    // cancel: ?꾨Т寃껊룄 ????
  });
}

// ?щ윭 ???쇨큵 ?リ린 (dirty ??? ?섎굹???쒖감 ?뺤씤)
function closeTabs(ids) {
  if (!ids || ids.length === 0) return;
  var queue = ids.slice();
  function next() {
    while (queue.length > 0) {
      var id = queue.shift();
      var tab = tabs.find(function(t){return t.id === id});
      if (!tab || tab.pinned) continue;
      if (id === activeTabId) saveActiveTabState();
      tab.dirty = isTabDirty(tab);
      if (tab.dirty) {
        showBatchDirtyConfirm(id, queue);
        return;
      }
      doCloseTab(id);
    }
  }
  next();

  function showBatchDirtyConfirm(tabId, remaining) {
    var old = document.getElementById('dirtyConfirmOverlay');
    if (old) old.remove();
    var tabObj = tabs.find(function(t){return t.id === tabId});
    var tabLabel = tabObj ? (tabObj.name || 'New Request') : '';
    var overlay = document.createElement('div');
    overlay.id = 'dirtyConfirmOverlay';
    overlay.className = 'dirty-confirm-overlay';
    overlay.innerHTML =
      '<div class="dirty-confirm-dialog">' +
        '<div class="dirty-confirm-msg">"' + escapeHtml(tabLabel) + '" has unsaved changes.</div>' +
        '<div class="dirty-confirm-actions">' +
          '<button class="dirty-btn dirty-btn-discard" data-action="discard">Discard</button>' +
          '<button class="dirty-btn dirty-btn-cancel" data-action="cancel">痍⑥냼</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      var action = e.target.dataset.action;
      if (!action) return;
      overlay.remove();
      if (action === 'discard') {
        doCloseTab(tabId);
        next();
      }
      // cancel: ?섎㉧吏??紐⑤몢 痍⑥냼
    });
  }
}

// === ?대┃ ripple ?댄럺??===
function addRipple(btn, e) {
  const rect = btn.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = Math.max(rect.width, rect.height) * 4;
  const circle = document.createElement('span');
  circle.className = 'ripple-circle';
  circle.style.width = circle.style.height = size + 'px';
  circle.style.left = (x - size / 2) + 'px';
  circle.style.top = (y - size / 2) + 'px';
  btn.appendChild(circle);
  circle.addEventListener('animationend', () => circle.remove());
}

// 踰꾪듉 ?띿뒪???꾩떆 蹂寃??쇰뱶諛?
function showBtnFeedback(btn, text, duration) {
  duration = duration || 1500;
  const origHtml = btn.innerHTML;
  btn.innerHTML = text;
  setTimeout(() => { btn.innerHTML = origHtml; }, duration);
}

// Send 鍮?以꾧린 ?④낵
function triggerSendStreak(btn) {
  btn.classList.add('streak-active');
  setTimeout(() => btn.classList.remove('streak-active'), 400);
}

// Send 踰꾪듉 ?대┃ ?댄럺????源붾걫???뚮┝ + 湲濡쒖슦
// renderContent()媛 吏곹썑??DOM??援먯껜?섎?濡?setTimeout(0)?쇰줈 ??踰꾪듉???곸슜
function triggerSendSlam(btn) {
  triggerSendStreak(btn);
  setTimeout(function() {
    var newBtn = mainContent.querySelector('.js-send');
    if (newBtn) {
      newBtn.classList.add('send-click');
      newBtn.classList.add('send-click-flash');
      setTimeout(function() { newBtn.classList.remove('send-click-flash'); }, 100);
      setTimeout(function() { newBtn.classList.remove('send-click'); }, 300);
    }
  }, 0);
}

// Stop 踰꾪듉 ?寃⑷컧 (slam + glow + flash + vignette ???⑥씪 keyframe?쇰줈 ?듯빀)
function triggerStopSlam(btn) {
  console.log('Stop clicked - animation start');
  // slam ?뚮┝ + 湲濡쒖슦 (?섎굹??animation?쇰줈 ?듯빀)
  btn.classList.remove('stop-slam');
  void btn.offsetWidth;
  btn.classList.add('stop-slam');
  // 諛곌꼍??flash (160ms)
  btn.classList.add('stop-flash');
  setTimeout(function() { btn.classList.remove('stop-flash'); }, 160);
  // slam ?대옒???뺣━
  setTimeout(function() { btn.classList.remove('stop-slam'); }, 400);
  // vignette flash
  var vig = document.createElement('div');
  vig.className = 'stop-vignette-flash';
  document.body.appendChild(vig);
  setTimeout(function() { vig.remove(); }, 300);
}

// ?꾩뿭 ripple ?대깽???꾩엫 (紐⑤뱺 .ripple-btn ??? + flash/bounce ?④낵
// Send/Stop 踰꾪듉? ?꾩슜 slam ?몃뱾?ш? 泥섎━?섎?濡??ш린??ripple留?
document.addEventListener('click', function(e) {
  const btn = e.target.closest('.ripple-btn');
  if (!btn) return;
  addRipple(btn, e);
  // Send/Stop 踰꾪듉? ?꾩슜 ?④낵 ?ъ슜
  if (btn.classList.contains('btn-send') || btn.classList.contains('btn-stop')) return;
  // 諛곌꼍??flash (0.1珥?
  btn.classList.add('btn-flash');
  setTimeout(function() { btn.classList.remove('btn-flash'); }, 100);
  // ?뚮┝ ??諛붿슫?????먮옒 ?쒗??
  btn.classList.remove('btn-bouncing');
  void btn.offsetWidth;
  btn.classList.add('btn-bouncing');
  btn.addEventListener('animationend', function handler() {
    btn.classList.remove('btn-bouncing');
    btn.removeEventListener('animationend', handler);
  });
});

function handlePrimaryAction() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  if (tab.loading) {
    vscode.postMessage({ type: 'cancelRequest', tabId: tab.id });
    return;
  }
  sendActiveTab();
}

function switchTab(id) {
  if (activeTabId === id) return;
  saveActiveTabState();
  activeTabId = id;
  renderTabBar();
  renderContent();
  debouncePersist();
}

function saveActiveTabState() {
  if (!activeTabId) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const mc = mainContent;
  const methodEl = mc.querySelector('.js-method');
  const urlEl = mc.querySelector('.js-url');
  if (!methodEl) return;
  tab.method = methodEl.value;
  tab.url = urlEl.value;
  tab.headers = collectKv(mc.querySelector('.js-header-rows'));
  tab.params = collectKv(mc.querySelector('.js-param-rows'));
  tab.body = mc.querySelector('.js-body')?.value || '';
  tab.bodyType = mc.querySelector('.js-body-type')?.value || 'none';
  tab.formData = collectFormData(mc.querySelector('.js-formdata-rows'));
  tab.binaryFilePath = mc.querySelector('.js-binary-path')?.value || '';
  tab.auth = collectAuth(mc);
  tab.scripts = collectScripts(mc);
  tab.timeout = parseInt(mc.querySelector('.js-timeout')?.value) || 0;
}

function renderTabBar() {
  // 湲곗〈 ???붿냼 ?쒓굅
  tabBar.querySelectorAll('.req-tab').forEach(el => el.remove());

  // pinned ??쓣 ?쇱そ??怨좎젙
  const sorted = tabs.filter(t => t.pinned).concat(tabs.filter(t => !t.pinned));

  for (const tab of sorted) {
    const el = document.createElement('div');
    el.className = 'req-tab' + (tab.id === activeTabId ? ' active' : '') + (tab.pinned ? ' pinned' : '') + ' tab-' + tab.method;
    el.innerHTML =
      '<span class="pin-icon">📌</span>' +
      '<span class="method-badge method-' + tab.method + '">' + tab.method + '</span>' +
      '<span class="tab-name">' + escapeHtml(truncate(tab.name, 25)) + '</span>' +
      (tab.dirty ? '<span class="dirty-dot" title="誘몄???蹂寃쎌궗??>●</span>' : '') +
      '<span class="close-tab" data-id="' + tab.id + '">&times;</span>';
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('close-tab')) {
        closeTab(e.target.dataset.id);
      } else {
        switchTab(tab.id);
      }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, tab.id);
    });
    tabBar.insertBefore(el, addTabBtn);
  }
}

function showTabContextMenu(x, y, tabId) {
  closeTabContextMenu();
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;

  const tabIdx = tabs.indexOf(tab);
  const othersClosable = tabs.filter(t => t.id !== tabId && !t.pinned);
  const rightClosable = tabs.filter((t, i) => i > tabIdx && !t.pinned);
  const allClosable = tabs.filter(t => !t.pinned);

  const items = [
    { label: 'Close', action: 'close', disabled: !!tab.pinned },
    { label: 'Close Others', action: 'closeOthers', disabled: othersClosable.length === 0 },
    { label: 'Close All', action: 'closeAll', disabled: allClosable.length === 0 },
    { label: 'Close to the Right', action: 'closeRight', disabled: rightClosable.length === 0 },
    { sep: true },
    tab.pinned
      ? { label: 'Unpin Tab', action: 'unpin' }
      : { label: 'Pin Tab', action: 'pin' },
    { sep: true },
    { label: 'Duplicate Tab', action: 'duplicate' },
  ];

  const menu = document.createElement('div');
  menu.className = 'tab-ctx-menu';
  menu.id = 'tabCtxMenu';
  items.forEach(function(it) {
    if (it.sep) {
      var sep = document.createElement('div');
      sep.className = 'ctx-sep';
      menu.appendChild(sep);
      return;
    }
    var el = document.createElement('div');
    el.className = 'ctx-item' + (it.disabled ? ' disabled' : '');
    el.textContent = it.label;
    el.dataset.action = it.action;
    menu.appendChild(el);
  });

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  document.body.appendChild(menu);

  // 硫붾돱媛 酉고룷??諛뽰쑝濡??섍?硫?蹂댁젙
  var rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

  menu.addEventListener('click', function(e) {
    var action = e.target.dataset.action;
    if (!action) return;
    closeTabContextMenu();
    switch (action) {
      case 'close':
        closeTab(tabId);
        break;
      case 'closeOthers':
        closeTabs(othersClosable.map(function(t){return t.id}));
        break;
      case 'closeAll':
        closeTabs(allClosable.map(function(t){return t.id}));
        break;
      case 'closeRight':
        closeTabs(rightClosable.map(function(t){return t.id}));
        break;
      case 'pin':
        tab.pinned = true;
        renderTabBar();
        debouncePersist();
        break;
      case 'unpin':
        tab.pinned = false;
        renderTabBar();
        debouncePersist();
        break;
      case 'duplicate':
        saveActiveTabState();
        createTab({ name: tab.name, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout });
        break;
    }
  });
  setTimeout(function() { document.addEventListener('click', closeTabContextMenu, { once: true }); }, 0);
}

function closeTabContextMenu() {
  var m = document.getElementById('tabCtxMenu');
  if (m) m.remove();
}

function renderContent() {
  if (!activeTabId || tabs.length === 0) {
    mainContent.innerHTML = '<div class="placeholder">Press + or Ctrl+T to create a new request</div>';
    return;
  }
  // 由щ젋?????섎룞 議곗젅???붿껌 ?곸뿭 ?믪씠 蹂댁〈
  var prevReqArea = mainContent.querySelector('.req-area');
  var savedHeight = prevReqArea && prevReqArea.dataset.manualHeight ? prevReqArea.style.height : null;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  const envLine = currentEnvName
    ? '<div class="env-indicator"><span class="var-name">{{env}}</span> = ' + escapeHtml(currentEnvName) + '</div>'
    : '';

  let resHtml = '';
  if (tab.loading) {
    resHtml = '<div style="padding:6px"><span class="spinner"></span>?붿껌 ?꾩넚 以?..</div>' +
      '<div class="skeleton-loader"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
  } else if (tab.error) {
    resHtml = '<div class="error-msg">' + escapeHtml(tab.error) + '</div>';
  } else if (tab.response) {
    const r = tab.response;
    const sc = Math.floor(r.status / 100);
    const ct = (r.headers?.['content-type'] || r.headers?.['Content-Type'] || '').toLowerCase();
    const isBinary = !!r.bodyBase64 && isBinaryContentType(ct);
    const displayBody = isBinary
      ? '[諛붿씠?덈━ ?묐떟?낅땲?? Save 踰꾪듉?쇰줈 ?먮낯 ?뚯씪????ν븯?몄슂.]'
      : r.body;
    const lang = isBinary ? 'text' : detectLang(ct, displayBody);
    const rawBodyHtml = isBinary ? escapeHtml(displayBody) : highlightBody(displayBody, lang);
    // ?묐떟 ?ㅻ뜑瑜??뚯씠釉?HTML濡??앹꽦
    const headerEntries = Object.entries(r.headers);
    const headerCount = headerEntries.length;
    let headersTableHtml = '<table class="res-header-table">' +
      '<thead><tr><th class="res-header-key-col">Key</th><th>Value</th></tr></thead><tbody>';
    for (const [k,v] of headerEntries) {
      headersTableHtml += '<tr><td class="res-header-key">' + escapeHtml(k) + '</td>' +
        '<td class="res-header-value" title="' + escapeAttr(String(v)) + '">' + escapeHtml(String(v)) + '</td></tr>';
    }
    headersTableHtml += '</tbody></table>';

    // Set-Cookie ?뚯떛?섏뿬 荑좏궎 ?뚯씠釉??앹꽦
    // rawSetCookies媛 ?덉쑝硫?媛쒕퀎 荑좏궎 諛곗뿴 ?ъ슜 (expires ?쇳몴 臾몄젣 ?놁쓬)
    // ?놁쑝硫??ㅻ뜑?먯꽌 異붿텧 ???뺢퇋?앹쑝濡?荑좏궎 寃쎄퀎 遺꾨━
    let allCookieStrs = [];
    if (r.rawSetCookies && r.rawSetCookies.length > 0) {
      allCookieStrs = r.rawSetCookies;
    } else {
      const cookieHeader = headerEntries
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .map(([,v]) => String(v))
        .join(', ');
      if (cookieHeader) {
        // ?쇳몴 ?ㅼ뿉 "?뚰뙆踰?=" ?⑦꽩???ㅻ㈃ ??荑좏궎 ?쒖옉 (expires ?좎쭨 ?쇳몴? 援щ퀎)
        allCookieStrs = cookieHeader.split(/,\s*(?=[A-Za-z_][A-Za-z0-9_]*=)/);
      }
    }
    const cookieCount = allCookieStrs.length;
    let cookiesTableHtml = '';
    if (cookieCount > 0) {
      cookiesTableHtml = '<table class="res-header-table res-cookie-table">' +
        '<thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Path</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr></thead><tbody>';
      for (const cs of allCookieStrs) {
        const parts = cs.split(';').map(function(s) { return s.trim(); });
        const nameVal = parts[0] || '';
        const eqIdx = nameVal.indexOf('=');
        const cName = eqIdx >= 0 ? nameVal.substring(0, eqIdx) : nameVal;
        const cValue = eqIdx >= 0 ? nameVal.substring(eqIdx + 1) : '';
        let domain = '', path = '', expires = '', httpOnly = false, secure = false;
        for (let i = 1; i < parts.length; i++) {
          const attr = parts[i];
          const attrLower = attr.toLowerCase();
          if (attrLower.startsWith('domain=')) domain = attr.substring(7);
          else if (attrLower.startsWith('path=')) path = attr.substring(5);
          else if (attrLower.startsWith('expires=')) expires = attr.substring(8);
          else if (attrLower.startsWith('max-age=')) { if (!expires) expires = 'max-age=' + attr.substring(8); }
          else if (attrLower === 'httponly') httpOnly = true;
          else if (attrLower === 'secure') secure = true;
        }
        cookiesTableHtml += '<tr>' +
          '<td class="res-header-key">' + escapeHtml(cName) + '</td>' +
          '<td class="res-header-value" title="' + escapeAttr(cValue) + '">' + escapeHtml(cValue) + '</td>' +
          '<td>' + escapeHtml(domain) + '</td>' +
          '<td>' + escapeHtml(path) + '</td>' +
          '<td>' + escapeHtml(expires) + '</td>' +
          '<td>' + (httpOnly ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
          '<td>' + (secure ? '<span class="cookie-badge">Y</span>' : '') + '</td>' +
        '</tr>';
      }
      cookiesTableHtml += '</tbody></table>';
    }
    const hasFormat = (lang === 'json' || lang === 'xml');
    const fmtMenuHtml = hasFormat
      ? '<div class="fmt-wrap">' +
          '<button class="tb-btn ripple-btn js-fmt-btn">Format</button>' +
          '<div class="fmt-menu js-fmt-menu">' +
            '<div class="fmt-menu-label">Style</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="pretty"><span class="check">x</span>Pretty</div>' +
            '<div class="fmt-menu-item js-fmt-style" data-style="compact"><span class="check"> </span>Compact</div>' +
            (lang === 'xml' ? '<div class="fmt-menu-item js-fmt-style" data-style="inline"><span class="check"> </span>Inline Children</div>' : '') +
            '<div class="fmt-menu-sep"></div>' +
            '<div class="fmt-menu-label">Indent</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="2"><span class="check">x</span>2 spaces</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="4"><span class="check"> </span>4 spaces</div>' +
            '<div class="fmt-menu-item js-fmt-indent" data-indent="tab"><span class="check"> </span>Tab</div>' +
          '</div>' +
        '</div>'
      : '';
    const toolbarHtml = (lang === 'json' || lang === 'xml')
      ? '<div class="res-body-toolbar js-res-body-toolbar" data-lang="' + lang + '">' +
          (lang === 'json'
              ? '<div class="toggle-group">' +
                  '<button class="toggle-btn active" data-mode="tree">Tree</button>' +
                  '<button class="toggle-btn" data-mode="raw">Raw</button>' +
                '</div>' +
              '<button class="tb-btn js-expand-all" title="Expand All">Expand</button>' +
              '<button class="tb-btn js-collapse-all" title="Collapse All">Collapse</button>'
            : '') +
          fmtMenuHtml +
        '</div>'
      : '';
    // 移섑솚???ㅼ젣 URL ?쒖떆
    const resolvedUrlDisplay = tab.resolvedUrl
      ? '<div class="resolved-url js-resolved-url" title="?대┃?섏뿬 蹂듭궗">' + escapeHtml(tab.resolvedUrl) + '</div>'
      : '';
    resHtml =
      '<div class="response-meta">' +
        '<span class="status status-' + sc + 'xx">' + r.status + ' ' + escapeHtml(r.statusText) + '</span>' +
        '<span>' + r.time + ' ms</span><span>' + formatSize(r.size) + '</span>' +
        '<span style="flex:1"></span>' +
        (lang !== 'text' ? '<span style="font-size:13px;opacity:.5;text-transform:uppercase">' + lang + '</span>' : '') +
        '<button class="res-action-btn ripple-btn js-copy-response" title="Copy Response Body"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3H4v10h8V5l-2-2zM9 4l2 2H9V4zM3 0h6l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V1a1 1 0 011-1z"/><path d="M1 3v11a1 1 0 001 1h8v-1H2V3H1z"/></svg> Copy</button>' +
        '<button class="res-action-btn ripple-btn js-save-response" title="Save Response Body"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.353 1.146l1.5 1.5L15 2.793V14.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5h11.707l.146.146zM2 2v12h12V3.207L12.793 2H2zm4 0v4h4V2H6zm5 0v5H5V2h1v3h3V2h2zm-3 7a2 2 0 110 4 2 2 0 010-4z"/></svg> Save</button>' +
        '<button class="pin-response-btn ripple-btn js-pin-response" title="Pin Response for Compare">' + pinSvg + ' Pin' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '') + '</button>' +
        '<button class="compare-btn js-compare-responses' + (pinnedResponses.length >= 2 ? ' ready' : '') + '" title="Compare Pinned Responses"' + (pinnedResponses.length < 2 ? ' disabled' : '') + '>' + diffSvg + ' Compare' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '') + '</button>' +
      '</div>' +
      resolvedUrlDisplay +
      '<div class="tabs js-res-tabs">' +
        '<div class="tab active" data-tab="resBody">Body</div>' +
        (cookieCount > 0 ? '<div class="tab" data-tab="resCookies">Cookies <span class="tab-count">' + cookieCount + '</span></div>' : '<div class="tab" data-tab="resCookies">Cookies</div>') +
        '<div class="tab" data-tab="resHeaders">Headers <span class="tab-count">' + headerCount + '</span></div>' +
        ((tab.scriptResults?.tests?.length || 0) > 0 ? '<div class="tab" data-tab="resTests">Tests <span class="tab-count">' + tab.scriptResults.tests.length + '</span></div>' : '<div class="tab" data-tab="resTests">Tests</div>') +
        (lang === 'html' ? '<div class="tab" data-tab="resPreview">Preview</div>' : '') +
      '</div>' +
      toolbarHtml +
      (lang === 'json' ? '<div class="json-tree js-res-tree js-res-body"></div>' : '') +
      '<div class="json-body js-res-raw js-res-body' + (lang === 'json' ? ' hidden' : '') + '">' + rawBodyHtml + '</div>' +
      '<div class="res-headers-panel hidden js-res-headers">' +
        (tab.resolvedHeaders && tab.resolvedHeaders.length
          ? '<div class="resolved-headers-section"><div class="resolved-headers-title">Request Headers (Resolved)</div>' +
            '<table class="res-header-table"><thead><tr><th class="res-header-key-col">Key</th><th>Value</th></tr></thead><tbody>' +
            tab.resolvedHeaders.map(function(h) {
              return '<tr><td class="res-header-key">' + escapeHtml(h.key) + '</td><td class="res-header-value" title="' + escapeAttr(h.value) + '">' + escapeHtml(h.value) + '</td></tr>';
            }).join('') +
            '</tbody></table></div><div class="resolved-headers-title" style="margin-top:8px">Response Headers</div>'
          : '') +
        headersTableHtml +
      '</div>' +
      '<div class="res-cookies-panel hidden js-res-cookies">' +
        (cookieCount > 0 ? cookiesTableHtml : '<div class="placeholder" style="padding:12px;font-size:13px;opacity:.5">No cookies in response</div>') +
      '</div>' +
      '<div class="res-headers-panel hidden js-res-tests">' +
        ((tab.scriptResults?.tests?.length || 0) > 0
          ? '<table class="res-header-table"><thead><tr><th class="res-header-key-col">Test</th><th>Result</th></tr></thead><tbody>' +
            tab.scriptResults.tests.map(function(test) {
              var status = test.passed ? 'PASS' : 'FAIL';
              var detail = test.passed ? '성공' : escapeHtml(test.error || '실패');
              return '<tr><td class="res-header-key">' + escapeHtml(test.name) + '</td><td class="res-header-value" title="' + escapeAttr(detail) + '">' + status + ' - ' + detail + '</td></tr>';
            }).join('') +
            '</tbody></table>' +
            ((tab.scriptResults.logs || []).length > 0
              ? '<div class="resolved-headers-title" style="margin-top:8px">Script Logs</div><table class="res-header-table"><thead><tr><th class="res-header-key-col">Level</th><th>Message</th></tr></thead><tbody>' +
                tab.scriptResults.logs.map(function(log) {
                  return '<tr><td class="res-header-key">' + escapeHtml(log.level.toUpperCase()) + '</td><td class="res-header-value" title="' + escapeAttr(log.message) + '">' + escapeHtml(log.message) + '</td></tr>';
                }).join('') +
                '</tbody></table>'
              : '')
          : '<div class="placeholder" style="padding:12px;font-size:13px;opacity:.5">No tests executed</div>') +
      '</div>' +
      (lang === 'html' ? '<iframe class="res-preview hidden js-res-preview" sandbox="allow-same-origin" style="width:100%;flex:1;border:none;background:#fff"></iframe>' : '');
  } else {
    resHtml = tab.url
      ? '<div class="placeholder">Send a request to see the response</div>'
      : '<div class="empty-tab-hint">Enter a URL and click Send to get started</div>';
  }

  mainContent.innerHTML = envLine +
    '<div class="url-bar">' +
      '<select class="js-method">' +
        ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(m =>
          '<option' + (m === tab.method ? ' selected' : '') + '>' + m + '</option>'
        ).join('') +
      '</select>' +
      '<div class="url-input-wrap">' +
        '<input class="js-url" type="text" placeholder="{{baseUrl}}/api/endpoint" spellcheck="false" value="' + escapeAttr(tab.url) + '"/>' +
        '<div class="var-overlay js-var-overlay hidden"></div>' +
      '</div>' +
      (tab.loading
        ? '<button class="btn-stop js-send"><span class="stop-icon"></span> Stop</button>'
        : '<button class="btn-send ripple-btn js-send"><span class="send-streak"></span><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1.5l14 6.5-14 6.5V9l10-1-10-1V1.5z"/></svg> Send</button>') +
      '<span class="url-bar-spacer"></span>' +
      '<button class="res-action-btn ripple-btn js-save"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.353 1.146l1.5 1.5L15 2.793V14.5a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-13a.5.5 0 01.5-.5h11.707l.146.146zM2 2v12h12V3.207L12.793 2H2zm4 0v4h4V2H6zm5 0v5H5V2h1v3h3V2h2zm-3 7a2 2 0 110 4 2 2 0 010-4z"/></svg> Save</button>' +
      (tab.requestId ? '<button class="res-action-btn ripple-btn js-save-as" title="Save as a new request">Save As</button>' : '') +
      '<button class="res-action-btn ripple-btn js-copy-curl" title="Copy as cURL"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2l4.5 4L1 10l1 1.5L7.5 6 2 0.5 1 2zm7 8h7v1.5H8V10z"/></svg> cURL</button>' +
      '<button class="res-action-btn ripple-btn js-generate-code" title="Generate Code">Code</button>' +
    '</div>' +
    '<div class="split">' +
      '<div class="req-area">' +
        '<div class="tabs js-req-tabs">' +
          '<div class="tab active" data-tab="params">Params</div>' +
          '<div class="tab" data-tab="headers">Headers</div>' +
          '<div class="tab" data-tab="body">Body</div>' +
          '<div class="tab" data-tab="auth">Auth</div>' +
          '<div class="tab" data-tab="scripts">Scripts</div>' +
          '<div class="tab" data-tab="settings">Settings</div>' +
        '</div>' +
        '<div class="js-params-panel kv-section">' +
          '<div class="js-param-rows">' + kvRowsHtml(tab.params) + '</div>' +
          '<button class="add-btn js-add-param">+ Add Param</button>' +
        '</div>' +
        '<div class="js-headers-panel kv-section hidden">' +
          '<div class="js-header-rows">' + kvRowsHtml(tab.headers) + '</div>' +
          '<button class="add-btn js-add-header">+ Add Header</button>' +
        '</div>' +
        '<div class="js-body-panel body-section hidden">' +
          '<select class="js-body-type body-type-select">' +
            ['none','json','xml','form','formdata','binary','raw'].map(function(t) {
              var label = { none:'None', json:'JSON', xml:'XML', form:'Form URL Encoded', formdata:'Form Data', binary:'Binary', raw:'Raw' }[t];
              return '<option value="' + t + '"' + (t === tab.bodyType ? ' selected' : '') + '>' + label + '</option>';
            }).join('') +
          '</select>' +
          '<textarea class="js-body" placeholder="{&quot;key&quot;: &quot;value&quot;}"' + (tab.bodyType === 'none' || tab.bodyType === 'formdata' || tab.bodyType === 'binary' ? ' style="display:none"' : '') + '>' + escapeHtml(tab.body) + '</textarea>' +
          '<div class="js-formdata-panel' + (tab.bodyType === 'formdata' ? '' : ' hidden') + '">' +
            '<div class="js-formdata-rows">' + formDataRowsHtml(tab.formData || []) + '</div>' +
            '<button class="add-btn js-add-formdata-text">+ Add Field</button>' +
            '<button class="add-btn js-add-formdata-file">+ Add File</button>' +
          '</div>' +
          '<div class="js-binary-panel' + (tab.bodyType === 'binary' ? '' : ' hidden') + '">' +
            '<div class="kv-row" style="margin-top:4px">' +
              '<input class="js-binary-path" type="text" placeholder="File Path" value="' + escapeAttr(tab.binaryFilePath || '') + '"/>' +
              '<button class="btn btn-s js-browse-binary" type="button" style="padding:3px 8px">Browse</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="js-auth-panel auth-section hidden">' +
          authHtml(tab.auth) +
        '</div>' +
        '<div class="js-scripts-panel body-section hidden">' +
          '<div style="font-size:12px;opacity:.65;margin-bottom:4px">Pre-request Script</div>' +
          '<textarea class="js-script-prerequest" placeholder="env.set(&quot;token&quot;, &quot;123&quot;);">' + escapeHtml(tab.scripts?.preRequest || '') + '</textarea>' +
          '<div style="font-size:12px;opacity:.65;margin:8px 0 4px">Test Script</div>' +
          '<textarea class="js-script-test" placeholder="test(&quot;status&quot;, function () { pm.response.to.have.status(200); });">' + escapeHtml(tab.scripts?.test || '') + '</textarea>' +
        '</div>' +
        '<div class="js-settings-panel settings-section hidden">' +
          '<div class="settings-row">' +
            '<label class="settings-label">Timeout (sec)</label>' +
            '<input class="js-timeout settings-input" type="number" min="0" placeholder="0" title="0 = unlimited" value="' + (tab.timeout || '') + '"/>' +
            '<span class="settings-hint">0 = unlimited</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="divider"></div>' +
      '<div class="bullet-progress js-bullet-progress' + (tab.loading ? ' active' : '') + '"><div class="bullet-glow"></div></div>' +
      '<div class="res-area' + (tab.response && tab.slideIn ? ' slide-in' : '') + '">' + resHtml + '</div>' +
    '</div>';

  // ?대깽??諛붿씤??
  bindContentEvents();

  // ?섎룞 議곗젅 ?믪씠 蹂듭썝
  if (savedHeight) {
    var newReqArea = mainContent.querySelector('.req-area');
    if (newReqArea) {
      newReqArea.style.height = savedHeight;
      newReqArea.style.flex = 'none';
      newReqArea.dataset.manualHeight = '1';
    }
  }
}

function bindContentEvents() {
  const mc = mainContent;

  // 硫붿꽌??蹂寃?????諛??낅뜲?댄듃
  mc.querySelector('.js-method')?.addEventListener('change', (e) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.method = e.target.value; markDirty(); renderTabBar(); }
  });

  // URL ?낅젰 ??誘몄튂??蹂??泥댄겕 + ?먮룞 ???
  var urlInputEl = mc.querySelector('.js-url');
  if (urlInputEl) {
    urlInputEl.addEventListener('input', function() {
      checkUnresolvedVars();
      markDirty();
      debouncePersist();
    });
    urlInputEl.addEventListener('scroll', function() {
      var ov = mc.querySelector('.js-var-overlay');
      if (ov) ov.scrollLeft = urlInputEl.scrollLeft;
    });
    // 珥덇린 泥댄겕
    setTimeout(checkUnresolvedVars, 50);
  }

  // Send / Stop ?대┃ ?寃⑷컧
  const sendBtn = mc.querySelector('.js-send');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (sendBtn.classList.contains('btn-send')) {
        triggerSendSlam(sendBtn);
      } else if (sendBtn.classList.contains('btn-stop')) {
        triggerStopSlam(sendBtn);
      }
      handlePrimaryAction();
    });
  }

  // Save (?대? ??λ맂 ??씠硫???뼱?곌린, ????씠硫??꾩튂 ?좏깮 ?ㅼ씠?쇰줈洹?
  mc.querySelector('.js-save')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage({ type: 'saveRequest', requestId: tab.requestId || undefined, method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' } });
  });

  // Save As (???대쫫/?꾩튂濡??????requestId ?놁씠 ?꾩넚?섏뿬 ????ぉ ?앹꽦)
  mc.querySelector('.js-save-as')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    pendingSaveBtn = this;
    vscode.postMessage({ type: 'saveRequest', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' } });
  });

  // Copy as cURL (+ "Copied!" ?쇰뱶諛?
  mc.querySelector('.js-copy-curl')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'copyAsCurl', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth });
    showBtnFeedback(this, 'Copied!', 1200);
  });

  mc.querySelector('.js-generate-code')?.addEventListener('click', function() {
    saveActiveTabState();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || !tab.url) return;
    vscode.postMessage({ type: 'generateCode', method: tab.method, url: tab.url, headers: tab.headers, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth });
    showBtnFeedback(this, 'Opened!', 1000);
  });

  // Copy Response Body (+ "Copied!" ?쇰뱶諛?
  mc.querySelector('.js-copy-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var opts = getFormatOptions(mc);
    var body = tab.response.body;
    if (opts) {
      if (opts.lang === 'json') body = formatJson(body, opts.style, opts.indent);
      else if (opts.lang === 'xml') body = formatXml(body, opts.style, opts.indent);
    }
    vscode.postMessage({ type: 'copyResponseBody', body: body });
    showBtnFeedback(this, 'Copied!', 1200);
  });

  // 移섑솚??URL ?대┃ ???대┰蹂대뱶 蹂듭궗
  mc.querySelector('.js-resolved-url')?.addEventListener('click', (e) => {
    const el = e.currentTarget;
    const url = el.textContent;
    vscode.postMessage({ type: 'copyToClipboard', text: url });
    el.classList.add('copied');
    const orig = el.textContent;
    el.textContent = 'Copied!';
    setTimeout(() => { el.textContent = orig; el.classList.remove('copied'); }, 1200);
  });

  // Save Response Body (?ㅼ씠?쇰줈洹??꾨즺 ?꾩뿉留?"Saved ?? ?쇰뱶諛?
  mc.querySelector('.js-save-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || '';
    pendingSaveResponseBtn = this;
    vscode.postMessage({ type: 'saveResponseBody', body: tab.response.body, bodyBase64: tab.response.bodyBase64 || '', contentType: ct });
  });

  // Pin Response ???꾩옱 ?묐떟??鍮꾧탳?⑹쑝濡????/ ?좉?
  mc.querySelector('.js-pin-response')?.addEventListener('click', function() {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;
    var btn = this;
    // ?대? ????묐떟?몄? ?뺤씤 (媛숈? ??+ 媛숈? body ???댁젣)
    var existIdx = pinnedResponses.findIndex(function(p) { return p.tabId === activeTabId && p.body === tab.response.body; });
    if (existIdx !== -1) {
      // Pin ?댁젣
      pinnedResponses.splice(existIdx, 1);
      btn.innerHTML = 'Unpinned';
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    } else {
      // Pin 異붽? ???꾩옱 ?щ㎎ ?ㅽ??쇰룄 ?④퍡 ???
      const ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || 'text/plain';
      const envLabel = currentEnvName ? '[' + currentEnvName + ']' : '';
      const timeLabel = new Date().toLocaleTimeString();
      const label = (tab.name || tab.method + ' ' + tab.url) + ' ' + envLabel + ' ' + timeLabel;
      var fmtOpts = getFormatOptions(mc);
      if (pinnedResponses.length >= 2) {
        pinnedResponses.shift(); // 媛???ㅻ옒??嫄??쒓굅
      }
      pinnedResponses.push({ label: label.trim(), body: tab.response.body, contentType: ct, timestamp: Date.now(), tabId: activeTabId, formatStyle: fmtOpts ? fmtOpts.style : null, formatIndent: fmtOpts ? fmtOpts.indent : null, formatLang: fmtOpts ? fmtOpts.lang : null });
      btn.innerHTML = 'Pinned (' + pinnedResponses.length + '/2)';
      setTimeout(function() { updatePinCompareButtons(mc); }, 1200);
    }
    // Compare 踰꾪듉? 利됱떆 媛깆떊
    var cmpBtn = mc.querySelector('.js-compare-responses');
    if (cmpBtn) {
      if (pinnedResponses.length >= 2) { cmpBtn.disabled = false; cmpBtn.classList.add('ready'); }
      else { cmpBtn.disabled = true; cmpBtn.classList.remove('ready'); }
      cmpBtn.innerHTML = diffSvg + ' Compare' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + '/2)' : '');
    }
  });

  // Compare Responses ????λ맂 2媛??묐떟??媛곸옄???щ㎎ ?ㅽ??쇰줈 ?щ㎎?낇븯??鍮꾧탳
  mc.querySelector('.js-compare-responses')?.addEventListener('click', function() {
    if (pinnedResponses.length < 2) return;
    vscode.postMessage({
      type: 'compareResponses',
      left: { label: pinnedResponses[0].label, body: formatPinnedBody(pinnedResponses[0]), contentType: pinnedResponses[0].contentType, formatted: true },
      right: { label: pinnedResponses[1].label, body: formatPinnedBody(pinnedResponses[1]), contentType: pinnedResponses[1].contentType, formatted: true }
    });
  });

  // ?묐떟 ?곸뿭 ?고겢由???而⑦뀓?ㅽ듃 硫붾돱
  mc.querySelector('.res-area')?.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    // 湲곗〈 硫붾돱 ?쒓굅
    document.querySelectorAll('.res-ctx-menu').forEach(m => m.remove());
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.response) return;

    const menu = document.createElement('div');
    menu.className = 'res-ctx-menu';
    menu.innerHTML =
      '<div class="ctx-item js-ctx-compare-last' + (!lastResponse ? ' disabled' : '') + '">Compare with Last Response</div>' +
      '<div class="ctx-sep"></div>' +
      '<div class="ctx-item js-ctx-pin-current">' + pinSvg + ' Pin Current Response</div>' +
      '<div class="ctx-item js-ctx-clear-pins' + (pinnedResponses.length === 0 ? ' disabled' : '') + '">Clear All Pins' + (pinnedResponses.length > 0 ? ' (' + pinnedResponses.length + ')' : '') + '</div>';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);

    // ?붾㈃ 諛뽰쑝濡??섍?吏 ?딅룄濡?議곗젙
    var rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 4) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 4) + 'px';

    // Compare with Last Response ??媛곸옄???щ㎎ ?ㅽ??쇰줈 ?щ㎎?낇븯??鍮꾧탳
    menu.querySelector('.js-ctx-compare-last')?.addEventListener('click', function() {
      if (!lastResponse || !tab.response) return;
      var ct = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || 'text/plain';
      var envLabel = currentEnvName ? '[' + currentEnvName + ']' : '';
      var curLabel = (tab.name || tab.method + ' ' + tab.url) + ' ' + envLabel + ' (current)';
      // ?꾩옱 ?묐떟? ?꾩옱 ?щ㎎ ?듭뀡 ?ъ슜
      var curFmt = getFormatOptions(mc);
      var curBody = tab.response.body;
      if (curFmt) {
        if (curFmt.lang === 'json') curBody = formatJson(curBody, curFmt.style, curFmt.indent);
        else if (curFmt.lang === 'xml') curBody = formatXml(curBody, curFmt.style, curFmt.indent);
      }
      // 吏곸쟾 ?묐떟? ??λ맂 ?щ㎎ ?듭뀡 ?ъ슜
      var lastBody = formatPinnedBody(lastResponse);
      vscode.postMessage({
        type: 'compareResponses',
        left: { label: lastResponse.label, body: lastBody, contentType: lastResponse.contentType, formatted: true },
        right: { label: curLabel.trim(), body: curBody, contentType: ct, formatted: true }
      });
      menu.remove();
    });

    // Pin Current Response
    menu.querySelector('.js-ctx-pin-current')?.addEventListener('click', function() {
      var pinBtn = mc.querySelector('.js-pin-response');
      if (pinBtn) pinBtn.click();
      menu.remove();
    });

    // Clear All Pins ??紐⑤뱺 ? ?댁젣
    menu.querySelector('.js-ctx-clear-pins')?.addEventListener('click', function() {
      if (pinnedResponses.length === 0) return;
      pinnedResponses.length = 0;
      updatePinCompareButtons(mc);
      menu.remove();
    });

    // ?ㅻⅨ 怨??대┃ ??硫붾돱 ?リ린
    setTimeout(function() {
      document.addEventListener('click', function closeCtx() {
        menu.remove();
        document.removeEventListener('click', closeCtx);
      }, { once: true });
    }, 0);
  });

  // ?붿껌 ???꾪솚
  mc.querySelector('.js-req-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    mc.querySelectorAll('.js-req-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const panels = { params: '.js-params-panel', headers: '.js-headers-panel', body: '.js-body-panel', auth: '.js-auth-panel', scripts: '.js-scripts-panel', settings: '.js-settings-panel' };
    for (const [k, sel] of Object.entries(panels)) {
      mc.querySelector(sel)?.classList.toggle('hidden', k !== t.dataset.tab);
    }
  });

  // ?묐떟 ???꾪솚 (Body / Headers / Preview)
  mc.querySelector('.js-res-tabs')?.addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    mc.querySelectorAll('.js-res-tabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const sel = t.dataset.tab;
    const isBody = sel === 'resBody';
    const isPreview = sel === 'resPreview';

    // 紐⑤뱺 ?묐떟 肄섑뀗痢??④?
      mc.querySelectorAll('.js-res-body').forEach(el => el.classList.add('hidden'));
      mc.querySelector('.js-res-headers')?.classList.add('hidden');
      mc.querySelector('.js-res-cookies')?.classList.add('hidden');
      mc.querySelector('.js-res-tests')?.classList.add('hidden');
      const preview = mc.querySelector('.js-res-preview');
      if (preview) preview.classList.add('hidden');
    const toolbar = mc.querySelector('.js-res-body-toolbar');
    if (toolbar) toolbar.classList.add('hidden');

    // ?좏깮????肄섑뀗痢좊쭔 ?쒖떆
    if (isBody) {
      if (toolbar) toolbar.classList.remove('hidden');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) {
        // JSON: Tree/Raw ?좉? 紐⑤뱶 蹂듭썝
        const mode = toolbar?.querySelector('.toggle-btn.active')?.dataset.mode || 'tree';
        tree.classList.toggle('hidden', mode !== 'tree');
        if (raw) raw.classList.toggle('hidden', mode !== 'raw');
      } else {
        // XML, text ?? raw留??쒖떆
        if (raw) raw.classList.remove('hidden');
      }
      } else if (sel === 'resHeaders') {
        mc.querySelector('.js-res-headers')?.classList.remove('hidden');
      } else if (sel === 'resCookies') {
        mc.querySelector('.js-res-cookies')?.classList.remove('hidden');
      } else if (sel === 'resTests') {
        mc.querySelector('.js-res-tests')?.classList.remove('hidden');
      } else if (isPreview && preview) {
      preview.classList.remove('hidden');
      if (!preview.dataset.loaded) {
        const tab = tabs.find(tt => tt.id === activeTabId);
        if (tab?.response?.body) {
          preview.srcdoc = tab.response.body;
          preview.dataset.loaded = '1';
        }
      }
    }
  });

  // Tree/Raw ?좉?
  mc.querySelector('.js-res-body-toolbar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-btn');
    if (btn) {
      mc.querySelectorAll('.js-res-body-toolbar .toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tree = mc.querySelector('.js-res-tree');
      const raw = mc.querySelector('.js-res-raw');
      if (tree) tree.classList.toggle('hidden', btn.dataset.mode !== 'tree');
      if (raw) raw.classList.toggle('hidden', btn.dataset.mode !== 'raw');
      // Expand/Collapse 踰꾪듉? Tree 紐⑤뱶?먯꽌留??쒖꽦
      mc.querySelectorAll('.js-expand-all,.js-collapse-all').forEach(b => b.style.display = btn.dataset.mode === 'tree' ? '' : 'none');
    }
  });

  // Expand All
  mc.querySelector('.js-expand-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.remove('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '-'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.add('hidden'));
  });

  // Collapse All
  mc.querySelector('.js-collapse-all')?.addEventListener('click', () => {
    mc.querySelectorAll('.js-res-tree .jt-children').forEach(el => el.classList.add('collapsed'));
    mc.querySelectorAll('.js-res-tree .jt-toggle').forEach(el => { el.textContent = '+'; });
    mc.querySelectorAll('.js-res-tree .jt-ellipsis').forEach(el => el.classList.remove('hidden'));
  });

  // Format ?쒕∼?ㅼ슫
  const fmtBtn = mc.querySelector('.js-fmt-btn');
  const fmtMenu = mc.querySelector('.js-fmt-menu');
  if (fmtBtn && fmtMenu) {
    fmtBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fmtMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => fmtMenu.classList.remove('open'));
    fmtMenu.addEventListener('click', (e) => { e.stopPropagation(); });

    // ?ㅽ????좏깮
    fmtMenu.querySelectorAll('.js-fmt-style').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-style .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
    // ?ㅼ뿬?곌린 ?좏깮
    fmtMenu.querySelectorAll('.js-fmt-indent').forEach(item => {
      item.addEventListener('click', () => {
        fmtMenu.querySelectorAll('.js-fmt-indent .check').forEach(c => { c.textContent = ' '; });
        item.querySelector('.check').textContent = 'x';
        applyFormat(mc);
      });
    });
  }

  // XML/JSON 珥덇린 ?щ㎎ ?곸슜 (?묐떟 ?섏떊 ??利됱떆 ?щ㎎??
  if (mc.querySelector('.js-res-body-toolbar')) {
    console.log('[arc-client] 珥덇린 ?щ㎎ ?곸슜 ?몄텧');
    applyFormat(mc);
  }

  // JSON ?몃━ 珥덇린 ?뚮뜑留?
  const treeContainer = mc.querySelector('.js-res-tree');
  if (treeContainer && !treeContainer.hasChildNodes()) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.response?.body) {
      try {
        const parsed = JSON.parse(tab.response.body);
        treeContainer.innerHTML = buildJsonTree(parsed, '', true);
        bindTreeToggles(treeContainer);
      } catch {}
    }
  }

  // KV 異붽?
  mc.querySelector('.js-add-param')?.addEventListener('click', () => { addKvRow(mc.querySelector('.js-param-rows')); markDirty(); });
  mc.querySelector('.js-add-header')?.addEventListener('click', () => { addKvRow(mc.querySelector('.js-header-rows')); markDirty(); });

  // KV ??젣 ?대깽???꾩엫
  mc.querySelectorAll('.js-param-rows, .js-header-rows').forEach(container => {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('rm')) { e.target.closest('.kv-row')?.remove(); markDirty(); }
    });
    // KV ?낅젰 蹂寃?媛먯?
    container.addEventListener('input', markDirty);
  });

  // Auth ???蹂寃?
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
    markDirty();
  });
  // Auth ?꾨뱶 ?낅젰 蹂寃?媛먯? (?대깽???꾩엫)
  mc.querySelector('.js-auth-fields')?.addEventListener('input', markDirty);

  // Body ???蹂寃???Content-Type ?먮룞 ?ㅼ젙
  mc.querySelector('.js-body-type')?.addEventListener('change', (e) => {
    const bodyType = e.target.value;
    const textarea = mc.querySelector('.js-body');
    const formDataPanel = mc.querySelector('.js-formdata-panel');
    const binaryPanel = mc.querySelector('.js-binary-panel');
    if (textarea) textarea.style.display = (bodyType === 'none' || bodyType === 'formdata' || bodyType === 'binary') ? 'none' : '';
    if (formDataPanel) formDataPanel.classList.toggle('hidden', bodyType !== 'formdata');
    if (binaryPanel) binaryPanel.classList.toggle('hidden', bodyType !== 'binary');
    syncAutoContentType(mc, bodyType);
    markDirty();
  });
  // 珥덇린 ?뚮뜑留???auto Content-Type ?숆린??
  var initBodyType = mc.querySelector('.js-body-type')?.value || 'none';
  if (initBodyType !== 'none') syncAutoContentType(mc, initBodyType);

  // Timeout ?낅젰 蹂寃?媛먯?
  mc.querySelector('.js-timeout')?.addEventListener('input', markDirty);

  // === textarea ?먮룞 ?믪씠 議곗젅 ===
  var bodyTa = mc.querySelector('.js-body');
  if (bodyTa) {
    function autoGrow() {
      bodyTa.style.height = 'auto';
      var h = Math.max(100, Math.min(400, bodyTa.scrollHeight));
      bodyTa.style.height = h + 'px';
    }
    bodyTa.addEventListener('input', function() { autoGrow(); markDirty(); });
    bodyTa.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { setTimeout(autoGrow, 0); }
    });
    autoGrow();
  }

  mc.querySelector('.js-add-formdata-text')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'text');
    markDirty();
  });
  mc.querySelector('.js-add-formdata-file')?.addEventListener('click', () => {
    addFormDataRow(mc.querySelector('.js-formdata-rows'), 'file');
    markDirty();
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('rm')) {
      e.target.closest('.formdata-row')?.remove();
      markDirty();
      return;
    }
    if (e.target.classList.contains('js-formdata-browse')) {
      const row = e.target.closest('.formdata-row');
      vscode.postMessage({ type: 'pickFile', target: 'formdata', rowId: row?.dataset.rowId });
    }
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('js-formdata-type')) {
      syncFormDataRow(e.target.closest('.formdata-row'));
    }
    markDirty();
  });
  mc.querySelector('.js-formdata-rows')?.addEventListener('input', markDirty);
  mc.querySelectorAll('.formdata-row').forEach(syncFormDataRow);

  mc.querySelector('.js-browse-binary')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'pickFile', target: 'binary' });
  });
  mc.querySelector('.js-binary-path')?.addEventListener('input', markDirty);
  mc.querySelector('.js-script-prerequest')?.addEventListener('input', markDirty);
  mc.querySelector('.js-script-test')?.addEventListener('input', markDirty);

  // === ?쒕옒洹?援щ텇??===
  var divider = mc.querySelector('.divider');
  var splitEl = mc.querySelector('.split');
  var reqArea = mc.querySelector('.req-area');
  var resArea = mc.querySelector('.res-area');
  if (divider && splitEl && reqArea && resArea) {
    var dragging = false;
    var startY = 0;
    var startH = 0;
    divider.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startH = reqArea.offsetHeight;
      divider.classList.add('active');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var dy = e.clientY - startY;
      var newH = Math.max(60, startH + dy);
      var maxH = splitEl.offsetHeight - 40 - divider.offsetHeight;
      newH = Math.min(newH, maxH);
      reqArea.style.height = newH + 'px';
      reqArea.style.flex = 'none';
      reqArea.dataset.manualHeight = '1';
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }
}

var BODY_TYPE_CT = {
  json: 'application/json',
  xml: 'application/xml',
  form: 'application/x-www-form-urlencoded',
  formdata: 'multipart/form-data',
  binary: 'application/octet-stream',
  raw: 'text/plain',
};

function syncAutoContentType(mc, bodyType) {
  var headerRows = mc.querySelector('.js-header-rows');
  if (!headerRows) return;

  // 湲곗〈 auto Content-Type ???쒓굅
  headerRows.querySelectorAll('.kv-row[data-auto="content-type"]').forEach(function(r) { r.remove(); });

  var ct = BODY_TYPE_CT[bodyType];
  if (!ct) return; // none?대㈃ 異붽??섏? ?딆쓬

  // ?섎룞?쇰줈 Content-Type???대? ?덉쑝硫?異붽??섏? ?딆쓬
  var hasManual = false;
  headerRows.querySelectorAll('.kv-row:not([data-auto])').forEach(function(row) {
    var keyInput = row.querySelectorAll('input[type="text"]')[0];
    if (keyInput && keyInput.value.toLowerCase() === 'content-type') hasManual = true;
  });
  if (hasManual) return;

  // auto ??異붽?
  var row = document.createElement('div');
  row.className = 'kv-row';
  row.dataset.auto = 'content-type';
  row.innerHTML =
    '<input type="checkbox" checked disabled/>' +
    '<input type="text" value="Content-Type" readonly style="opacity:.6"/>' +
    '<input type="text" value="' + ct + '" readonly style="opacity:.6"/>' +
    '<span class="auto-badge">(auto)</span>';
  headerRows.insertBefore(row, headerRows.firstChild);
}

function collectAllKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function sendActiveTab() {
  saveActiveTabState();
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  if (tab.loading) return;
  const mc = mainContent;

  // 1) Send 踰꾪듉 ?뚮┝ ?④낵 ??renderContent?먯꽌 Stop?쇰줈 ?꾪솚??

  // 2) URL ?낅젰? 鍮?以꾧린 sweep
  var urlWrap = mc.querySelector('.url-input-wrap');
  if (urlWrap) {
    urlWrap.classList.remove('sweep');
    void urlWrap.offsetWidth;
    urlWrap.classList.add('sweep');
    setTimeout(function() { urlWrap.classList.remove('sweep'); }, 350);
  }

  // auto Content-Type ?ы븿???꾩껜 ?ㅻ뜑 ?섏쭛
  const allHeaders = collectAllKv(mc.querySelector('.js-header-rows'));
  tab.loading = true;
  tab.error = null;
  tab.progressVisible = false;
  tab.slideIn = false;
  tab.sendTime = Date.now();
  renderContent();

  // 3) ?꾩넚 以??ㅼ삩 ?꾩뒪 (renderContent ???ㅼ떆 荑쇰━)
  var urlInput = mc.querySelector('.js-url');
  if (urlInput) {
    urlInput.classList.add('neon-active');
  }

  // 3珥???寃쎄낵?쒓컙 ?ㅼ떆媛??쒖떆 + ?꾨줈洹몃젅??諛?
  var elapsedTimer = null;
  var progressTimer = setTimeout(function() {
    if (!tab.loading) return;
    tab.progressVisible = true;
    // 寃쎄낵?쒓컙 ?쒖떆 ?쒖옉
    var timerEl = mc.querySelector('.js-elapsed-timer');
    if (!timerEl) {
      var loadingDiv = mc.querySelector('.res-area > div');
      if (loadingDiv) {
        var sp = document.createElement('span');
        sp.className = 'elapsed-timer js-elapsed-timer';
        loadingDiv.appendChild(sp);
      }
      timerEl = mc.querySelector('.js-elapsed-timer');
    }
    if (timerEl) {
      elapsedTimer = setInterval(function() {
        if (!tab.loading) { clearInterval(elapsedTimer); return; }
        var elapsed = ((Date.now() - tab.sendTime) / 1000).toFixed(1);
        timerEl.textContent = elapsed + 's';
      }, 100);
    }
  }, 3000);
  tab._progressTimer = progressTimer;
  tab._elapsedTimer = elapsedTimer;

  vscode.postMessage({
    type: 'sendRequest', tabId: tab.id,
    method: tab.method, url: tab.url, headers: allHeaders, params: tab.params, body: tab.body, bodyType: tab.bodyType, formData: tab.formData || [], binaryFilePath: tab.binaryFilePath || '', auth: tab.auth, scripts: tab.scripts || { preRequest: '', test: '' }, timeout: tab.timeout,
  });
}

// === KV ??===
function kvRowsHtml(items) {
  return (items || []).map(kv =>
    '<div class="kv-row">' +
      '<input type="checkbox"' + (kv.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" placeholder="Key" value="' + escapeAttr(kv.key) + '"/>' +
      '<input type="text" placeholder="Value" value="' + escapeAttr(kv.value) + '"/>' +
      '<span class="rm" title="Remove">&times;</span>' +
    '</div>'
  ).join('');
}

function addKvRow(container, key, value) {
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" placeholder="Key" value="' + escapeAttr(key || '') + '"/>' +
    '<input type="text" placeholder="Value" value="' + escapeAttr(value || '') + '"/>' +
    '<span class="rm" title="Remove">&times;</span>';
  row.querySelector('.rm').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectKv(container) {
  if (!container) return [];
  const arr = [];
  container.querySelectorAll('.kv-row').forEach(row => {
    if (row.dataset.auto) return; // auto ???쒖쇅
    const cb = row.querySelector('input[type="checkbox"]');
    const inputs = row.querySelectorAll('input[type="text"],input[type="password"]');
    if (inputs[0]?.value) arr.push({ key: inputs[0].value, value: inputs[1].value, enabled: cb?.checked !== false });
  });
  return arr;
}

function formDataRowsHtml(items) {
  return (items || []).map(function(field) {
    var isFile = field.type === 'file';
    return '<div class="kv-row formdata-row" data-row-id="' + escapeAttr(field.id || ('fd_' + Math.random().toString(36).slice(2, 8))) + '">' +
      '<input type="checkbox"' + (field.enabled !== false ? ' checked' : '') + '/>' +
      '<input type="text" class="js-formdata-key" placeholder="Key" value="' + escapeAttr(field.key || '') + '"/>' +
      '<select class="js-formdata-type body-type-select" style="width:84px;margin-bottom:0">' +
        '<option value="text"' + (isFile ? '' : ' selected') + '>Text</option>' +
        '<option value="file"' + (isFile ? ' selected' : '') + '>File</option>' +
      '</select>' +
      '<input type="text" class="js-formdata-value" placeholder="' + (isFile ? 'File Path' : 'Value') + '" value="' + escapeAttr(field.value || '') + '"/>' +
      '<button class="btn btn-s js-formdata-browse' + (isFile ? '' : ' hidden') + '" type="button" style="padding:3px 8px">Browse</button>' +
      '<span class="rm" title="Remove">&times;</span>' +
    '</div>';
  }).join('');
}

function addFormDataRow(container, type) {
  if (!container) return;
  var row = document.createElement('div');
  row.className = 'kv-row formdata-row';
  row.dataset.rowId = 'fd_' + Math.random().toString(36).slice(2, 10);
  row.innerHTML =
    '<input type="checkbox" checked/>' +
    '<input type="text" class="js-formdata-key" placeholder="Key"/>' +
    '<select class="js-formdata-type body-type-select" style="width:84px;margin-bottom:0">' +
      '<option value="text"' + (type === 'file' ? '' : ' selected') + '>Text</option>' +
      '<option value="file"' + (type === 'file' ? ' selected' : '') + '>File</option>' +
    '</select>' +
    '<input type="text" class="js-formdata-value" placeholder="' + (type === 'file' ? 'File Path' : 'Value') + '"/>' +
    '<button class="btn btn-s js-formdata-browse' + (type === 'file' ? '' : ' hidden') + '" type="button" style="padding:3px 8px">Browse</button>' +
    '<span class="rm" title="Remove">&times;</span>';
  container.appendChild(row);
}

function syncFormDataRow(row) {
  if (!row) return;
  var type = row.querySelector('.js-formdata-type')?.value || 'text';
  var valueInput = row.querySelector('.js-formdata-value');
  var browseBtn = row.querySelector('.js-formdata-browse');
  if (valueInput) valueInput.placeholder = type === 'file' ? 'File Path' : 'Value';
  if (browseBtn) browseBtn.classList.toggle('hidden', type !== 'file');
}

function collectFormData(container) {
  if (!container) return [];
  var arr = [];
  container.querySelectorAll('.formdata-row').forEach(function(row) {
    var cb = row.querySelector('input[type="checkbox"]');
    var key = row.querySelector('.js-formdata-key')?.value || '';
    var value = row.querySelector('.js-formdata-value')?.value || '';
    var type = row.querySelector('.js-formdata-type')?.value || 'text';
    if (!key && !value) return;
    arr.push({
      id: row.dataset.rowId || ('fd_' + Math.random().toString(36).slice(2, 8)),
      key: key,
      value: value,
      enabled: cb?.checked !== false,
      type: type === 'file' ? 'file' : 'text',
    });
  });
  return arr;
}

function collectScripts(mc) {
  return {
    preRequest: mc.querySelector('.js-script-prerequest')?.value || '',
    test: mc.querySelector('.js-script-test')?.value || '',
  };
}

// === Auth ===
function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      ({none:'No Auth',basic:'Basic Auth',bearer:'Bearer Token',apikey:'API Key'}[t]) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return '<div class="auth-row"><label>Username</label><input type="text" class="js-auth-user" value="' + escapeAttr(u) + '"/></div>' +
           '<div class="auth-row"><label>Password</label><input type="password" class="js-auth-pass" value="' + escapeAttr(p) + '"/></div>';
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return '<div class="auth-row"><label>Token</label><input type="text" class="js-auth-token" value="' + escapeAttr(t) + '"/></div>';
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return '<div class="auth-row"><label>Key</label><input type="text" class="js-auth-apikey" value="' + escapeAttr(k) + '"/></div>' +
           '<div class="auth-row"><label>Value</label><input type="text" class="js-auth-apival" value="' + escapeAttr(v) + '"/></div>' +
           '<div class="auth-row"><label>Add to</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>Header</option><option value="query"' + (a==='query'?' selected':'') + '>Query</option></select></div>';
  }
  return '';
}

function collectAuth(mc) {
  const type = mc.querySelector('.js-auth-type')?.value || 'none';
  const auth = { type };
  if (type === 'basic') auth.basic = { username: mc.querySelector('.js-auth-user')?.value || '', password: mc.querySelector('.js-auth-pass')?.value || '' };
  if (type === 'bearer') auth.bearer = { token: mc.querySelector('.js-auth-token')?.value || '' };
  if (type === 'apikey') auth.apikey = { key: mc.querySelector('.js-auth-apikey')?.value || '', value: mc.querySelector('.js-auth-apival')?.value || '', addTo: mc.querySelector('.js-auth-addto')?.value || 'header' };
  return auth;
}

// === ?섍꼍蹂???몄쭛 ===
const envEditor = document.getElementById('envEditor');
const envEditorName = document.getElementById('envEditorName');
const envVarRows = document.getElementById('envVarRows');

document.getElementById('addEnvVarBtn').addEventListener('click', () => addKvRow(envVarRows));
document.getElementById('envCloseBtn').addEventListener('click', () => envEditor.classList.add('hidden'));

// ?섍꼍蹂???먮룞???(debounce 500ms)
const envDirtyDot = document.getElementById('envDirtyDot');
const envAutoSaved = document.getElementById('envAutoSaved');
let envSaveTimer = null;
let envAutoSavedTimer = null;

function envMarkDirty() {
  envDirtyDot.classList.add('show');
  envAutoSaved.classList.remove('show');
}

function envAutoSave() {
  if (!editingEnvId) return;
  const vars = collectKv(envVarRows);
  vscode.postMessage({ type: 'saveEnvironmentVars', envId: editingEnvId, variables: vars });
  // ????꾨즺 ?쇰뱶諛?
  envDirtyDot.classList.remove('show');
  envAutoSaved.classList.add('show');
  clearTimeout(envAutoSavedTimer);
  envAutoSavedTimer = setTimeout(() => envAutoSaved.classList.remove('show'), 2000);
}

function envScheduleSave() {
  envMarkDirty();
  clearTimeout(envSaveTimer);
  envSaveTimer = setTimeout(envAutoSave, 500);
}

// ?낅젰 蹂寃?媛먯? (input, checkbox, blur)
envVarRows.addEventListener('input', envScheduleSave);
envVarRows.addEventListener('change', envScheduleSave);
envVarRows.addEventListener('focusout', () => {
  if (!editingEnvId) return;
  clearTimeout(envSaveTimer);
  envAutoSave();
});

envVarRows.addEventListener('click', (e) => {
  if (e.target.classList.contains('rm')) {
    e.target.closest('.kv-row')?.remove();
    envScheduleSave();
  }
});

// === 湲곕낯 ?ㅻ뜑 ?몄쭛 ===
const defaultHeadersEditor = document.getElementById('defaultHeadersEditor');
const defaultHeaderRows = document.getElementById('defaultHeaderRows');

document.getElementById('addDefaultHeaderBtn').addEventListener('click', () => addKvRow(defaultHeaderRows));
document.getElementById('defaultHeadersCloseBtn').addEventListener('click', () => defaultHeadersEditor.classList.add('hidden'));
document.getElementById('defaultHeadersSaveBtn').addEventListener('click', () => {
  const headers = collectKv(defaultHeaderRows);
  vscode.postMessage({ type: 'saveDefaultHeaders', headers: headers });
});
defaultHeaderRows.addEventListener('click', (e) => {
  if (e.target.classList.contains('rm')) e.target.closest('.kv-row')?.remove();
});

// === Extension ??Webview 硫붿떆吏 ===
window.addEventListener('message', (event) => {
  const msg = event.data;

  if (msg.type === 'requestCanceled') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    tab.error = null;
    if (activeTabId === msg.tabId) {
      var neonEl = mainContent.querySelector('.js-url.neon-active');
      if (neonEl) neonEl.classList.remove('neon-active');
      renderContent();
    } else {
      renderTabBar();
    }
  }

  if (msg.type === 'receiveResponse' || msg.type === 'responseError') {
    const tab = tabs.find(t => t.id === msg.tabId);
    if (!tab) return;
    clearTabRequestState(tab);
    tab.slideIn = true;

    // ?ㅼ삩 ?꾩뒪 ?쒓굅
    var neonEl = mainContent.querySelector('.js-url.neon-active');
    if (neonEl) neonEl.classList.remove('neon-active');

    if (msg.type === 'receiveResponse') {
      // 吏곸쟾 ?묐떟 ???(鍮좊Ⅸ 鍮꾧탳?? ???꾩옱 ?щ㎎ ?ㅽ??쇰룄 ?④퍡 ???
      if (tab.response) {
        var prevCt = tab.response.headers?.['content-type'] || tab.response.headers?.['Content-Type'] || 'text/plain';
        var prevEnv = currentEnvName ? '[' + currentEnvName + ']' : '';
        var prevFmt = getFormatOptions(mainContent);
        lastResponse = { label: (tab.name || tab.method + ' ' + tab.url) + ' ' + prevEnv + ' (previous)', body: tab.response.body, contentType: prevCt, formatStyle: prevFmt ? prevFmt.style : null, formatIndent: prevFmt ? prevFmt.indent : null, formatLang: prevFmt ? prevFmt.lang : null };
      }
      tab.response = msg.response;
      tab.resolvedUrl = msg.resolvedUrl || '';
      tab.resolvedHeaders = msg.resolvedHeaders || [];
      tab.scriptResults = msg.scriptResults || { logs: [], tests: [] };
      tab.error = null;
    } else {
      tab.error = msg.error;
      tab.response = null;
      tab.scriptResults = null;
    }
    if (activeTabId === msg.tabId) {
      // 珥앹븣 濡쒕뵫 諛? ?앷퉴吏 ?щ젮媛硫??щ씪吏???꾨즺 ?좊땲硫붿씠??
      var bp = mainContent.querySelector('.js-bullet-progress');
      if (bp) {
        var glow = bp.querySelector('.bullet-glow');
        if (glow) {
          var glowRect = glow.getBoundingClientRect();
          var bpRect = bp.getBoundingClientRect();
          bp.style.setProperty('--pos', (glowRect.left - bpRect.left) + 'px');
        }
        bp.classList.add('finishing');
      }
      // ?꾨즺 ?좊땲硫붿씠??0.25珥? ??renderContent
      setTimeout(function() {
        renderContent();
        setTimeout(function() {
          var sc = tab.response ? Math.floor(tab.response.status / 100) : 0;
          var isError = (sc >= 4 || !tab.response);

          // ?곹깭肄붾뱶 諛곗? ?④낵
          var badge = mainContent.querySelector('.status');
          if (badge) {
            badge.classList.add(isError ? 'flash-error' : 'flash-success');
          }

          // 4xx/5xx: ?붾㈃ ?꾩껜 鍮④컙??踰덉찉
          if (isError && tab.response) {
            var flash = document.createElement('div');
            flash.className = 'screen-flash';
            document.body.appendChild(flash);
            setTimeout(function() { flash.remove(); }, 150);
          }

          // 鍮좊Ⅸ ?묐떟 (100ms ?댄븯): PERFECT!
          if (tab.response && tab.response.time <= 100) {
            var meta = mainContent.querySelector('.response-meta');
            if (meta) {
              meta.style.position = 'relative';
              var perf = document.createElement('span');
              perf.className = 'perfect-badge';
              perf.textContent = 'PERFECT!';
              meta.appendChild(perf);
              setTimeout(function() { perf.remove(); }, 900);
            }
          }
        }, 30);
      }, 250);
    }
    // slide-in? ??踰덈쭔 ?곸슜
    setTimeout(function() { tab.slideIn = false; }, 300);
  }

  if (msg.type === 'newTab') {
    createTab();
  }

  if (msg.type === 'restoreTabState') {
    // ??λ맂 ??뱾 蹂듭썝
    var restoreTabs = msg.tabs || [];
    var restoreIdx = msg.activeIndex || 0;
    if (restoreTabs.length > 0) {
      // 珥덇린 鍮????쒓굅 (??씠 1媛쒖씠怨?URL??鍮꾩뼱?덉쑝硫?
      if (tabs.length === 1 && !tabs[0].url) {
        tabs.splice(0, 1);
      }
      for (var ri = 0; ri < restoreTabs.length; ri++) {
        createTab(restoreTabs[ri]);
      }
      // ?쒖꽦 ??蹂듭썝
      if (restoreIdx >= 0 && restoreIdx < tabs.length) {
        switchTab(tabs[restoreIdx].id);
      }
    }
  }

  if (msg.type === 'activeVarKeys') {
    activeVarKeys = msg.varKeys || [];
    checkUnresolvedVars();
  }

  if (msg.type === 'loadRequest') {
    // 以묐났 ??諛⑹?: requestId媛 ?덉쑝硫?湲곗〈 ??뿉??寃??
    if (msg.requestId) {
      var existing = tabs.find(function(t) { return t.requestId === msg.requestId; });
      if (existing) {
        switchTab(existing.id);
        return;
      }
    }
    createTab({
      requestId: msg.requestId || null,
      name: msg.name || msg.method + ' ' + msg.url,
      method: msg.method,
      url: msg.url,
      headers: msg.headers || [],
      params: msg.params || [],
      body: msg.body || '',
      bodyType: msg.bodyType || 'none',
      formData: msg.formData || [],
      binaryFilePath: msg.binaryFilePath || '',
      auth: msg.auth || { type: 'none' },
      scripts: msg.scripts || { preRequest: '', test: '' },
    });
  }

  if (msg.type === 'pickFileResult') {
    if (msg.target === 'binary') {
      var binaryInput = mainContent.querySelector('.js-binary-path');
      if (binaryInput && msg.filePath) {
        binaryInput.value = msg.filePath;
        markDirty();
      }
    } else if (msg.target === 'formdata' && msg.rowId) {
      var row = mainContent.querySelector('.formdata-row[data-row-id="' + msg.rowId + '"]');
      var input = row?.querySelector('.js-formdata-value');
      if (input && msg.filePath) {
        input.value = msg.filePath;
        markDirty();
      }
    }
  }

  if (msg.type === 'loadEnvironment') {
    editingEnvId = msg.envId;
    envEditorName.textContent = msg.envName;
    envVarRows.innerHTML = kvRowsHtml(msg.variables || []);
    envEditor.classList.remove('hidden');
  }

  if (msg.type === 'loadDefaultHeaders') {
    defaultHeaderRows.innerHTML = kvRowsHtml(msg.headers || []);
    defaultHeadersEditor.classList.remove('hidden');
  }

  if (msg.type === 'updateActiveEnv') {
    currentEnvName = msg.envName;
    const ind = mainContent.querySelector('.env-indicator');
    if (ind) {
      if (currentEnvName) {
        ind.innerHTML = '<span class="var-name">{{env}}</span> = ' + escapeHtml(currentEnvName);
        ind.classList.remove('hidden');
      } else {
        ind.classList.add('hidden');
      }
    }
  }

  // === Save 寃곌낵 ?쇰뱶諛?===
  if (msg.type === 'saveRequestResult') {
    if (msg.saved) {
      // ??뿉 而щ젆???붿껌 ID? ?대쫫 ?곌껐 + dirty 珥덇린??
      var savedTab = _pendingCloseAfterSave
        ? tabs.find(function(t){return t.id === _pendingCloseAfterSave})
        : tabs.find(function(t){return t.id === activeTabId});
      if (savedTab) {
        if (msg.requestId) savedTab.requestId = msg.requestId;
        if (msg.name) savedTab.name = msg.name;
        savedTab._snapshot = snapshotTab(savedTab);
        savedTab.dirty = false;
      }
      renderTabBar();
      if (pendingSaveBtn) {
        showBtnFeedback(pendingSaveBtn, 'Saved!', 1200);
      }
      // dirty ?뺤씤 ?ㅼ씠?쇰줈洹몄뿉??"??? ?좏깮 ???リ린
      if (_pendingCloseAfterSave) {
        doCloseTab(_pendingCloseAfterSave);
        _pendingCloseAfterSave = null;
      }
      debouncePersist();
    } else {
      // ???痍⑥냼 ??pendingClose??痍⑥냼
      _pendingCloseAfterSave = null;
    }
    pendingSaveBtn = null;
  }
  if (msg.type === 'saveResponseBodyResult') {
    if (msg.saved && pendingSaveResponseBtn) {
      showBtnFeedback(pendingSaveResponseBtn, 'Saved!', 1200);
    }
    pendingSaveResponseBtn = null;
  }

  // === 而щ젆???щ꼫 硫붿떆吏 ===
  if (msg.type === 'runCollectionStart') {
    showRunner(msg.name, msg.total);
  }
  if (msg.type === 'runCollectionProgress') {
    updateRunnerRow(msg);
  }
  if (msg.type === 'runCollectionDone') {
    finishRunner(msg);
  }
});

// === 而щ젆???щ꼫 UI ===
var runnerOverlay = null;
var runnerResults = [];

function showRunner(name, total) {
  runnerResults = [];
  // ?ㅻ쾭?덉씠 ?앹꽦
  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>Run: ' + escapeHtml(name) + '</h3>' +
      '<button class="btn btn-s js-runner-stop" style="padding:2px 10px;font-size:13px">Stop</button>' +
      '<button class="btn btn-s js-runner-close hidden" style="padding:2px 10px;font-size:13px">Close</button>' +
    '</div>' +
    '<div class="runner-progress">' +
      '<span class="js-runner-counter">0/' + total + '</span>' +
      '<div class="runner-bar"><div class="runner-bar-fill js-runner-bar" style="width:0%"></div></div>' +
      '<span class="spinner js-runner-spinner"></span>' +
    '</div>' +
    '<div class="runner-summary">' +
      '<span>Total: <b>' + total + '</b></span>' +
      '<span class="pass">Passed: <b class="js-runner-pass">0</b></span>' +
      '<span class="fail">Failed: <b class="js-runner-fail">0</b></span>' +
      '<span class="js-runner-time"></span>' +
    '</div>' +
    '<div class="runner-list js-runner-list"></div>';

  document.body.appendChild(runnerOverlay);

  // Stop 踰꾪듉
  runnerOverlay.querySelector('.js-runner-stop').addEventListener('click', function() {
    vscode.postMessage({ type: 'stopCollectionRun' });
    this.disabled = true;
    this.textContent = 'Stopping...';
  });
  // Close 踰꾪듉
  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
  // ???대┃ ?대깽???꾩엫
  runnerOverlay.querySelector('.js-runner-list').addEventListener('click', function(e) {
    var row = e.target.closest('.runner-row');
    if (!row) return;
    var idx = parseInt(row.dataset.idx);
    var existing = row.nextElementSibling;
    if (existing && existing.classList.contains('runner-detail')) {
      existing.remove();
      return;
    }
    var r = runnerResults[idx];
    if (!r) return;
    var detail = document.createElement('div');
    detail.className = 'runner-detail';
    if (r.error) {
      detail.textContent = 'Error: ' + r.error;
    } else if (r.response) {
      var body = r.response.body || '';
      var ct = (r.response.headers?.['content-type'] || r.response.headers?.['Content-Type'] || '').toLowerCase();
      if (r.response.bodyBase64 && isBinaryContentType(ct)) {
        body = '[諛붿씠?덈━ ?묐떟?낅땲?? Save 踰꾪듉?쇰줈 ?먮낯 ?뚯씪????ν븯?몄슂.]';
      }
      if (body.length > 2000) body = body.substring(0, 2000) + '\n... (truncated)';
      detail.textContent = 'Status: ' + r.response.status + ' ' + r.response.statusText +
        '\nSize: ' + formatSize(r.response.size) + '\n\n' + body;
    }
    row.after(detail);
  });
}

function updateRunnerRow(msg) {
  if (!runnerOverlay) return;
  var list = runnerOverlay.querySelector('.js-runner-list');
  var isPassed = !msg.error && msg.status < 400;
  var cls = isPassed ? 'pass' : 'fail';
  var icon = isPassed ? '\u2705' : '\u274C';
  var statusStr = msg.error ? 'ERR' : (msg.status + '');
  var row = document.createElement('div');
  row.className = 'runner-row ' + cls;
  row.dataset.idx = msg.index;
  row.innerHTML =
    '<span class="rr-idx">' + (msg.index + 1) + '</span>' +
    '<span class="method-badge method-' + msg.method + '">' + msg.method + '</span>' +
    '<span class="rr-name">' + escapeHtml(msg.name) + '</span>' +
    '<span class="rr-status">' + statusStr + '</span>' +
    '<span class="rr-time">' + (msg.time ? msg.time + 'ms' : '-') + '</span>' +
    '<span class="rr-icon">' + icon + '</span>';
  list.appendChild(row);

  // 寃곌낵 ???
  runnerResults[msg.index] = { error: msg.error, response: msg.response };

  // ?꾨줈洹몃젅???낅뜲?댄듃
  var pct = Math.round(((msg.index + 1) / msg.total) * 100);
  runnerOverlay.querySelector('.js-runner-counter').textContent = (msg.index + 1) + '/' + msg.total;
  runnerOverlay.querySelector('.js-runner-bar').style.width = pct + '%';
  runnerOverlay.querySelector('.js-runner-pass').textContent = msg.passed;
  runnerOverlay.querySelector('.js-runner-fail').textContent = msg.failed;

  // ?먮룞 ?ㅽ겕濡?
  list.scrollTop = list.scrollHeight;
}

function finishRunner(msg) {
  if (!runnerOverlay) return;
  // ?ㅽ뵾???쒓굅
  var spinner = runnerOverlay.querySelector('.js-runner-spinner');
  if (spinner) spinner.remove();
  // Stop ??Close ?꾪솚
  var stopBtn = runnerOverlay.querySelector('.js-runner-stop');
  if (stopBtn) stopBtn.classList.add('hidden');
  var closeBtn = runnerOverlay.querySelector('.js-runner-close');
  if (closeBtn) closeBtn.classList.remove('hidden');
  // 理쒖쥌 ?쒓컙 ?쒖떆
  runnerOverlay.querySelector('.js-runner-time').textContent = 'Time: ' + msg.time + 'ms';
  // 諛?100% (?먮뒗 以묐떒 ???꾩옱 媛??좎?)
  if (!msg.stopped) {
    runnerOverlay.querySelector('.js-runner-bar').style.width = '100%';
  }
}

// === JSON ?몃━ 酉?===
function buildJsonTree(val, key, isLast) {
  const comma = isLast ? '' : '<span class="jt-comma">,</span>';
  const keyHtml = key !== '' ? '<span class="jt-key">' + escapeHtml('"' + key + '"') + '</span>: ' : '';

  if (val === null) {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-null">null</span>' + comma + '</div>';
  }
  if (typeof val === 'boolean') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-bool">' + val + '</span>' + comma + '</div>';
  }
  if (typeof val === 'number') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-num">' + val + '</span>' + comma + '</div>';
  }
  if (typeof val === 'string') {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml + '<span class="jt-str">' + escapeHtml('"' + val + '"') + '</span>' + comma + '</div>';
  }

  const isArr = Array.isArray(val);
  const open = isArr ? '[' : '{';
  const close = isArr ? ']' : '}';
  const entries = isArr ? val.map((v, i) => [i, v]) : Object.entries(val);
  const count = entries.length;

  if (count === 0) {
    return '<div class="jt-row"><span class="jt-toggle"></span>' + keyHtml +
      '<span class="jt-brace">' + open + close + '</span>' + comma + '</div>';
  }

  let childrenHtml = '';
  entries.forEach(([k, v], idx) => {
    const childKey = isArr ? '' : String(k);
    childrenHtml += buildJsonTree(v, childKey, idx === count - 1);
  });

  const summary = isArr ? count + ' items' : count + ' keys';

  return '<div class="jt-row">' +
      '<span class="jt-toggle">-</span>' + keyHtml +
      '<span class="jt-brace">' + open + '</span>' +
      '<span class="jt-ellipsis hidden" title="' + summary + '"> ... ' + summary + ' </span>' +
    '</div>' +
    '<div class="jt-children jt-node">' + childrenHtml + '</div>' +
    '<div class="jt-row"><span class="jt-toggle"></span><span class="jt-brace">' + close + '</span>' + comma + '</div>';
}

function bindTreeToggles(container) {
  container.addEventListener('click', (e) => {
    const toggle = e.target.closest('.jt-toggle');
    const ellipsis = e.target.closest('.jt-ellipsis');
    if (!toggle && !ellipsis) return;

    // ellipsis ?대┃ ?????대떦 ?됱쓽 ?좉?怨??숈씪 ?숈옉
    const row = (toggle || ellipsis).closest('.jt-row');
    if (!row) return;
    const tgl = row.querySelector('.jt-toggle');
    if (!tgl || !tgl.textContent.trim()) return;

    const children = row.nextElementSibling;
    if (!children || !children.classList.contains('jt-children')) return;

    const collapsed = children.classList.toggle('collapsed');
    tgl.textContent = collapsed ? '+' : '-';
    const ell = row.querySelector('.jt-ellipsis');
    if (ell) ell.classList.toggle('hidden', !collapsed);
  });
}

// === Content-Type 媛먯? 諛?援щЦ ?섏씠?쇱씠??(highlight.js) ===
// hljs ?몄뼱 留ㅽ븨
var hljsLangMap = { json: 'json', html: 'html', xml: 'xml', js: 'javascript', css: 'css', text: 'plaintext' };

function detectLang(ct, body) {
  if (ct.includes('json') || ct.includes('javascript') && tryJsonParse(body)) return 'json';
  if (ct.includes('html')) return 'html';
  if (ct.includes('xml') || ct.includes('svg')) return 'xml';
  if (ct.includes('javascript') || ct.includes('ecmascript')) return 'js';
  if (ct.includes('css')) return 'css';
  if (tryJsonParse(body)) return 'json';
  if (body.trimStart().startsWith('<!') || body.trimStart().startsWith('<html')) return 'html';
  if (body.trimStart().startsWith('<?xml') || body.trimStart().startsWith('<rss')) return 'xml';
  return 'text';
}
function tryJsonParse(s) { try { JSON.parse(s); return true; } catch { return false; } }

function isBinaryContentType(ct) {
  var mime = (ct || '').split(';')[0].trim().toLowerCase();
  if (!mime) return false;
  if (mime.startsWith('text/')) return false;
  if (mime.endsWith('+json') || mime.endsWith('+xml')) return false;
  return [
    'application/json',
    'application/xml',
    'text/xml',
    'application/javascript',
    'text/javascript',
    'application/x-www-form-urlencoded',
    'application/graphql',
    'application/ld+json',
    'application/x-ndjson',
  ].indexOf(mime) < 0;
}

function highlightBody(body, lang) {
  // JSON? pretty-print ???섏씠?쇱씠??(_formatted_json?대㈃ ?대? ?щ㎎??
  if (lang === 'json') {
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch {}
  }
  var actualLang = lang === '_formatted_json' ? 'json' : lang;
  // hljs ?ъ슜 媛?ν븯硫??쇱씠釉뚮윭由??섏씠?쇱씠??
  if (typeof hljs !== 'undefined') {
    var hljsLang = hljsLangMap[actualLang] || 'plaintext';
    try {
      return hljs.highlight(body, { language: hljsLang }).value;
    } catch {}
  }
  // fallback: ?⑥닚 escape
  return escapeHtml(body);
}

// === Format 湲곕뒫 (JSON + XML) ===
function getFormatOptions(mc) {
  var toolbar = mc.querySelector('.js-res-body-toolbar');
  if (!toolbar) return null;
  var styleEl = toolbar.querySelector('.js-fmt-style .check');
  var style = 'pretty';
  toolbar.querySelectorAll('.js-fmt-style').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') style = el.dataset.style;
  });
  var indent = '2';
  toolbar.querySelectorAll('.js-fmt-indent').forEach(function(el) {
    if (el.querySelector('.check').textContent.trim() === 'x') indent = el.dataset.indent;
  });
  var indentStr = indent === 'tab' ? '\t' : ' '.repeat(parseInt(indent));
  return { style: style, indent: indentStr, lang: toolbar.dataset.lang };
}

function applyFormat(mc) {
  var opts = getFormatOptions(mc);
  console.log('[arc-client] applyFormat ?몄텧, opts:', opts);
  if (!opts) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab || !tab.response) return;
  var body = tab.response.body;
  var formatted;
  if (opts.lang === 'json') {
    formatted = formatJson(body, opts.style, opts.indent);
  } else if (opts.lang === 'xml') {
    formatted = formatXml(body, opts.style, opts.indent);
  } else {
    return;
  }
  // Raw 酉??낅뜲?댄듃
  var rawEl = mc.querySelector('.js-res-raw');
  if (rawEl) rawEl.innerHTML = highlightBody(formatted, opts.lang === 'json' ? '_formatted_json' : 'xml');
  // JSON ?몃━???щ젋?붾쭅 (pretty?먯꽌???섎? ?놁?留??쇨????좎?)
  if (opts.lang === 'json') {
    var treeEl = mc.querySelector('.js-res-tree');
    if (treeEl) {
      try {
        var parsed = JSON.parse(body);
        treeEl.innerHTML = buildJsonTree(parsed, '', true);
        bindTreeToggles(treeEl);
      } catch {}
    }
  }
}

function formatJson(body, style, indent) {
  try {
    var parsed = JSON.parse(body);
    if (style === 'compact') return JSON.stringify(parsed);
    return JSON.stringify(parsed, null, indent);
  } catch { return body; }
}

// === XML ?щ㎎??(?뺢퇋??湲곕컲, ?몃? ?쇱씠釉뚮윭由??놁쓬) ===
function formatXml(xml, style, indent) {
  console.log('[arc-client] formatXml ?몄텧, style:', style, 'indent:', JSON.stringify(indent));
  // ?좏뻾 怨듬갚/以꾨컮轅??뺢퇋??
  xml = xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (style === 'compact') {
    // ?쒓렇 ?ъ씠??怨듬갚/以꾨컮轅??쒓굅
    return xml.replace(/>\s+</g, '><').replace(/^\s+|\s+$/g, '');
  }

  // ?좏겙 遺꾨━: XML ?좎뼵, 二쇱꽍, CDATA, ??꾪겢濡쒖쭠, ?щ뒗?쒓렇, ?ル뒗?쒓렇, ?띿뒪??
  var tokens = xmlTokenize(xml);

  if (style === 'inline') {
    return xmlBuildInline(tokens, indent);
  }

  // Pretty
  return xmlBuildPretty(tokens, indent);
}

function xmlTokenize(xml) {
  var tokens = [];
  var re = /(<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/[^>]+>|<[^>]+\/\s*>|<[^>]+>)/g;
  var lastIndex = 0;
  var match;
  while ((match = re.exec(xml)) !== null) {
    if (match.index > lastIndex) {
      var text = xml.substring(lastIndex, match.index).trim();
      if (text) tokens.push({ type: 'text', value: text });
    }
    var tag = match[1];
    if (tag.startsWith('<?')) tokens.push({ type: 'decl', value: tag });
    else if (tag.startsWith('<!--')) tokens.push({ type: 'comment', value: tag });
    else if (tag.startsWith('<![CDATA[')) tokens.push({ type: 'cdata', value: tag });
    else if (tag.startsWith('</')) tokens.push({ type: 'close', value: tag });
    else if (tag.endsWith('/>')) tokens.push({ type: 'self', value: tag });
    else tokens.push({ type: 'open', value: tag });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < xml.length) {
    var tail = xml.substring(lastIndex).trim();
    if (tail) tokens.push({ type: 'text', value: tail });
  }
  return tokens;
}

function xmlBuildPretty(tokens, indent) {
  var lines = [];
  var depth = 0;
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
    } else if (t.type === 'open') {
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
    }
  }
  return lines.join('\n');
}

function xmlBuildInline(tokens, indent) {
  // Inline Children: ?먯떇???띿뒪???섎굹嫄곕굹 ?먯떇???섎굹肉먯씠硫???以꾨줈
  // 1?④퀎: ?몃━ 援ъ“ ?뚯븙 ??inline ?먯젙
  var lines = [];
  var depth = 0;
  var i = 0;
  while (i < tokens.length) {
    var t = tokens[i];
    if (t.type === 'open') {
      // ?ㅼ쓬 ?좏겙???띿뒪???ル뒗?쒓렇 ?먮뒗 ?⑥씪 ?먯떇+?ル뒗?쒓렇?몄? ?뺤씤
      if (i + 2 < tokens.length && tokens[i+1].type === 'text' && tokens[i+2].type === 'close') {
        // <tag>text</tag> ????以?
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      if (i + 3 < tokens.length && tokens[i+1].type === 'self' && tokens[i+2].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value);
        i += 3;
        continue;
      }
      // ?먯떇???섎굹 (open + text + close) ??寃쎌슦: <parent><child>text</child></parent>
      if (i + 4 < tokens.length &&
          tokens[i+1].type === 'open' && tokens[i+2].type === 'text' &&
          tokens[i+3].type === 'close' && tokens[i+4].type === 'close') {
        lines.push(indentStr(depth, indent) + t.value + tokens[i+1].value + tokens[i+2].value + tokens[i+3].value + tokens[i+4].value);
        i += 5;
        continue;
      }
      lines.push(indentStr(depth, indent) + t.value);
      depth++;
      i++;
    } else if (t.type === 'close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    } else {
      lines.push(indentStr(depth, indent) + t.value);
      i++;
    }
  }
  return lines.join('\n');
}

function indentStr(depth, indent) {
  var s = '';
  for (var i = 0; i < depth; i++) s += indent;
  return s;
}

function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function escapeHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escapeAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function truncate(s, n) { return s.length > n ? s.substring(0, n-1) + '...' : s; }

// 誘몄튂??蹂??泥댄겕 (URL ?낅젰?)
function checkUnresolvedVars() {
  var urlEl = mainContent.querySelector('.js-url');
  var overlay = mainContent.querySelector('.js-var-overlay');
  if (!urlEl || !overlay) return;
  var val = urlEl.value || '';
  var re = /\{\{([^}]+)\}\}/g;
  var match;
  var unresolvedNames = [];
  while ((match = re.exec(val)) !== null) {
    var name = match[1].trim();
    if (activeVarKeys.indexOf(name) < 0) {
      unresolvedNames.push(name);
    }
  }
  if (unresolvedNames.length > 0) {
    var html = escapeHtml(val).replace(/\{\{([^}]+)\}\}/g, function(m, n) {
      if (unresolvedNames.indexOf(n.trim()) >= 0) {
        return '<span class="unresolved-var">' + m + '</span>';
      }
      return m;
    });
    overlay.innerHTML = html;
    overlay.classList.remove('hidden');
    // ?ㅽ겕濡??숆린??
    overlay.scrollLeft = urlEl.scrollLeft;
  } else {
    overlay.innerHTML = '';
    overlay.classList.add('hidden');
  }
}

// ???곹깭瑜?Extension???꾩넚 (??μ슜)
  function persistTabState() {
    saveActiveTabState();
    var tabData = tabs.map(function(t) {
    return { name: t.name, method: t.method, url: t.url, headers: t.headers, params: t.params, body: t.body, bodyType: t.bodyType, formData: t.formData || [], binaryFilePath: t.binaryFilePath || '', auth: t.auth, scripts: t.scripts || { preRequest: '', test: '' }, timeout: t.timeout, pinned: t.pinned || false, requestId: t.requestId || undefined };
    });
  var activeIdx = tabs.findIndex(function(t) { return t.id === activeTabId; });
  vscode.postMessage({ type: 'saveTabState', tabs: tabData, activeIndex: Math.max(0, activeIdx) });
}

// ??蹂寃??꾪솚/?リ린 ???먮룞 ???(?붾컮?댁뒪)
var _persistTimer = null;
function debouncePersist() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistTabState, 1000);
}

// 珥덇린 ?곹깭: 鍮????섎굹 ?앹꽦
createTab();

// webview 以鍮??좏샇 ?꾩넚
vscode.postMessage({ type: 'webviewReady' });
