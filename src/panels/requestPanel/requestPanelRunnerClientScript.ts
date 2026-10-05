/** Request panel Collection Runner client fragment (same Webview lexical scope as main client script). */
export function getRequestPanelRunnerClientScript(): string {
  return /*js*/ `
var runnerOverlay = null;
var runnerResults = [];
var runnerStatusState = null;

function normalizeRunnerDelayInput(value) {
  var parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(60000, Math.max(0, parsed));
}

function normalizeRunnerIterationsInput(value) {
  var parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(100, Math.max(1, parsed));
}

function normalizeRunnerRequestChoices(msg) {
  var requests = Array.isArray(msg.requests) ? msg.requests : [];
  var normalized = [];
  for (var i = 0; i < requests.length; i++) {
    var entry = requests[i];
    if (!entry || typeof entry.id !== 'string' || !entry.id) continue;
    normalized.push({
      id: entry.id,
      name: typeof entry.name === 'string' ? entry.name : entry.id,
      method: typeof entry.method === 'string' && entry.method ? String(entry.method).toUpperCase() : 'GET',
      folderPath: typeof entry.folderPath === 'string' ? entry.folderPath : '',
    });
  }
  if (normalized.length > 0) return normalized;
  var fallbackTotal = Number(msg.total) || 0;
  for (var j = 0; j < fallbackTotal; j++) {
    normalized.push({
      id: 'legacy-' + j,
      name: '#' + (j + 1),
      method: 'GET',
      folderPath: '',
    });
  }
  return normalized;
}

function renderRunnerRequestChoiceRows(requests) {
  return requests.map(function(entry, index) {
    var checkboxId = 'runner-req-' + index;
    var pathHtml = entry.folderPath
      ? '<div class="runner-request-path">' + escapeHtml(entry.folderPath) + '</div>'
      : '';
    return '<label class="runner-request-row" for="' + escapeAttr(checkboxId) + '">' +
      '<input id="' + escapeAttr(checkboxId) + '" class="js-runner-request-check" data-testid="runner-request-check" type="checkbox" checked data-request-id="' + escapeAttr(entry.id) + '">' +
      '<span class="runner-request-meta">' +
        '<span class="runner-request-line">' +
          '<span class="method-badge method-' + escapeAttr(entry.method) + '">' + escapeHtml(entry.method) + '</span>' +
          '<span class="runner-request-name">' + escapeHtml(entry.name) + '</span>' +
        '</span>' +
        pathHtml +
      '</span>' +
    '</label>';
  }).join('');
}

function showRunnerSetup(msg) {
  runnerResults = [];
  runnerStatusState = null;
  var options = msg.options || {};
  var delayMs = normalizeRunnerDelayInput(options.delayMs);
  var iterations = normalizeRunnerIterationsInput(options.iterations);
  var stopOnFailure = options.stopOnFailure === true;
  var requestChoices = normalizeRunnerRequestChoices(msg);
  var collectionTotal = requestChoices.length;

  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>' + escapeHtml(tf('webview.runTitle', { name: msg.name })) + '</h3>' +
      '<button class="btn btn-s js-runner-start" data-testid="runner-start" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runStart')) + '</button>' +
      '<button class="btn btn-s js-runner-close" data-testid="runner-close" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runClose')) + '</button>' +
    '</div>' +
    '<div class="runner-request-select" data-testid="runner-request-select">' +
      '<div class="runner-request-select-head">' +
        '<div>' +
          '<div class="runner-request-select-title">' + escapeHtml(tr('webview.runRequests')) + '</div>' +
          '<div class="runner-request-select-count js-runner-selected-count" data-testid="runner-selected-count"></div>' +
        '</div>' +
        '<div class="runner-request-select-actions">' +
          '<button type="button" class="js-runner-select-all" data-testid="runner-select-all">' + escapeHtml(tr('webview.runSelectAll')) + '</button>' +
          '<button type="button" class="js-runner-clear-selection" data-testid="runner-clear-selection">' + escapeHtml(tr('webview.runClearSelection')) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="runner-request-list js-runner-request-list" data-testid="runner-request-list" role="group" aria-label="' + escapeAttr(tr('webview.runRequests')) + '">' +
        renderRunnerRequestChoiceRows(requestChoices) +
      '</div>' +
      '<div class="runner-select-hint js-runner-select-hint" data-testid="runner-select-hint" hidden></div>' +
    '</div>' +
    '<div class="runner-options">' +
      '<label class="runner-option">' +
        '<span>' + escapeHtml(tr('webview.runDelayMs')) + '</span>' +
        '<input class="input js-runner-delay" type="number" min="0" max="60000" step="100" value="' + delayMs + '">' +
      '</label>' +
      '<label class="runner-option">' +
        '<span>' + escapeHtml(tr('webview.runIterations')) + '</span>' +
        '<input class="input js-runner-iterations" type="number" min="1" max="100" step="1" value="' + iterations + '">' +
      '</label>' +
      '<label class="runner-option runner-option-check">' +
        '<input class="js-runner-stop-on-failure" type="checkbox"' + (stopOnFailure ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(tr('webview.runStopOnFailure')) + '</span>' +
      '</label>' +
    '</div>' +
    '<div class="runner-summary" data-testid="runner-summary">' +
      '<span>' + escapeHtml(tr('webview.runTotal')) + ': <b class="js-runner-collection-total" data-testid="runner-collection-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runSelected')) + ': <b class="js-runner-selected-total" data-testid="runner-selected-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runRuns')) + ': <b class="js-runner-runs" data-testid="runner-runs">' + (collectionTotal * iterations) + '</b></span>' +
    '</div>' +
    '<div class="runner-live-status">' +
      '<div class="runner-live-title">' + escapeHtml(tr('webview.runOptions')) + '</div>' +
      '<div class="runner-live-copy">' + escapeHtml(tr('webview.runOptionsCopy')) + '</div>' +
    '</div>';

  document.body.appendChild(runnerOverlay);

  var delayInput = runnerOverlay.querySelector('.js-runner-delay');
  var iterationInput = runnerOverlay.querySelector('.js-runner-iterations');
  var runsEl = runnerOverlay.querySelector('.js-runner-runs');
  var selectedTotalEl = runnerOverlay.querySelector('.js-runner-selected-total');
  var selectedCountEl = runnerOverlay.querySelector('.js-runner-selected-count');
  var selectHintEl = runnerOverlay.querySelector('.js-runner-select-hint');
  var startBtn = runnerOverlay.querySelector('.js-runner-start');
  var checkboxes = Array.from(runnerOverlay.querySelectorAll('.js-runner-request-check'));

  var getSelectedRequestIds = function() {
    return checkboxes
      .filter(function(input) { return input.checked; })
      .map(function(input) { return input.dataset.requestId; })
      .filter(Boolean);
  };

  var syncRunnerSelectionUi = function() {
    var selectedCount = getSelectedRequestIds().length;
    if (selectedCountEl) {
      selectedCountEl.textContent = tf('webview.runSelectedCount', {
        selected: selectedCount,
        total: collectionTotal,
      });
    }
    if (selectedTotalEl) selectedTotalEl.textContent = String(selectedCount);
    if (runsEl) {
      runsEl.textContent = String(selectedCount * normalizeRunnerIterationsInput(iterationInput?.value));
    }
    var noneSelected = selectedCount === 0;
    if (startBtn) {
      startBtn.disabled = noneSelected;
      startBtn.setAttribute('aria-disabled', noneSelected ? 'true' : 'false');
    }
    if (selectHintEl) {
      selectHintEl.hidden = !noneSelected;
      selectHintEl.textContent = noneSelected ? tr('webview.runSelectAtLeastOne') : '';
    }
  };

  checkboxes.forEach(function(input) {
    input.addEventListener('change', syncRunnerSelectionUi);
  });
  runnerOverlay.querySelector('.js-runner-select-all')?.addEventListener('click', function() {
    checkboxes.forEach(function(input) { input.checked = true; });
    syncRunnerSelectionUi();
  });
  runnerOverlay.querySelector('.js-runner-clear-selection')?.addEventListener('click', function() {
    checkboxes.forEach(function(input) { input.checked = false; });
    syncRunnerSelectionUi();
  });

  delayInput?.addEventListener('change', function() { this.value = String(normalizeRunnerDelayInput(this.value)); });
  iterationInput?.addEventListener('change', function() {
    this.value = String(normalizeRunnerIterationsInput(this.value));
    syncRunnerSelectionUi();
  });
  iterationInput?.addEventListener('input', syncRunnerSelectionUi);
  syncRunnerSelectionUi();

  startBtn?.addEventListener('click', function() {
    var selectedRequestIds = getSelectedRequestIds();
    if (selectedRequestIds.length === 0) {
      syncRunnerSelectionUi();
      return;
    }
    var selectedOptions = {
      delayMs: normalizeRunnerDelayInput(delayInput?.value),
      iterations: normalizeRunnerIterationsInput(iterationInput?.value),
      stopOnFailure: runnerOverlay.querySelector('.js-runner-stop-on-failure')?.checked === true,
    };
    this.disabled = true;
    vscode.postMessage({
      type: 'startCollectionRun',
      delayMs: selectedOptions.delayMs,
      iterations: selectedOptions.iterations,
      stopOnFailure: selectedOptions.stopOnFailure,
      selectedRequestIds: selectedRequestIds,
    });
  });

  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
}

function showRunner(msg) {
  runnerResults = [];
  runnerStatusState = null;
  var total = msg.total || 0;
  var collectionTotal = msg.collectionTotal != null ? msg.collectionTotal : total;
  var selectedTotal = msg.selectedTotal != null ? msg.selectedTotal : total;
  var totalRuns = msg.totalRuns || total;
  
  if (runnerOverlay) runnerOverlay.remove();
  runnerOverlay = document.createElement('div');
  runnerOverlay.className = 'runner-overlay';
  runnerOverlay.innerHTML =
    '<div class="runner-header">' +
      '<h3>' + escapeHtml(tf('webview.runTitle', { name: msg.name })) + '</h3>' +
      '<button class="btn btn-s js-runner-stop" data-testid="runner-stop" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runStop')) + '</button>' +
      '<button class="btn btn-s js-runner-rerun hidden" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runRerunFailed')) + '</button>' +
      '<button class="btn btn-s js-runner-close hidden" data-testid="runner-close" style="padding:2px 10px;font-size:13px">' + escapeHtml(tr('webview.runClose')) + '</button>' +
    '</div>' +
    '<div class="runner-progress" data-testid="runner-progress">' +
      '<span class="js-runner-counter" data-testid="runner-counter">0/' + totalRuns + '</span>' +
      '<div class="runner-bar"><div class="runner-bar-fill js-runner-bar" style="transform:scaleX(0)"></div></div>' +
      '<span class="spinner js-runner-spinner"></span>' +
    '</div>' +
    '<div class="runner-summary" data-testid="runner-summary">' +
      '<span>' + escapeHtml(tr('webview.runTotal')) + ': <b data-testid="runner-collection-total">' + collectionTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runSelected')) + ': <b data-testid="runner-selected-total">' + selectedTotal + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runRuns')) + ': <b data-testid="runner-runs">' + totalRuns + '</b></span>' +
      '<span>' + escapeHtml(tr('webview.runIteration')) + ': <b class="js-runner-iteration">1/' + (msg.iterations || 1) + '</b></span>' +
      '<span class="pass">' + escapeHtml(tr('webview.runPassed')) + ': <b class="js-runner-pass" data-testid="runner-passed">0</b></span>' +
      '<span class="fail">' + escapeHtml(tr('webview.runFailed')) + ': <b class="js-runner-fail" data-testid="runner-failed">0</b></span>' +
      '<span class="skip">' + escapeHtml(tr('webview.runSkipped')) + ': <b class="js-runner-skip" data-testid="runner-skipped">0</b></span>' +
      '<span class="js-runner-time"></span>' +
    '</div>' +
    '<div class="runner-live-status">' +
      '<div class="runner-live-title js-runner-live-title">' + escapeHtml(tr('webview.runStatus')) + '</div>' +
      '<div class="runner-live-copy js-runner-live-copy"></div>' +
    '</div>' +
    '<div class="runner-list js-runner-list"></div>';

  document.body.appendChild(runnerOverlay);

  
  runnerOverlay.querySelector('.js-runner-stop').addEventListener('click', function() {
    vscode.postMessage({ type: 'stopCollectionRun' });
    this.disabled = true;
    this.textContent = tr('webview.runStopping');
  });
  
  runnerOverlay.querySelector('.js-runner-close').addEventListener('click', function() {
    if (runnerOverlay) { runnerOverlay.remove(); runnerOverlay = null; }
  });
  runnerOverlay.querySelector('.js-runner-rerun').addEventListener('click', function() {
    var failedIndices = [];
    runnerResults.forEach(function(result, index) {
      if (result?.failed) {
        failedIndices.push(Number.isInteger(result.requestIndex) ? result.requestIndex : index);
      }
    });
    failedIndices = Array.from(new Set(failedIndices));
    if (!failedIndices.length) return;
    this.disabled = true;
    vscode.postMessage({ type: 'rerunFailedCollection', failedIndices: failedIndices });
  });
  
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
      detail.textContent = tr('webview.runError') + ': ' + r.error;
    } else if (r.response) {
      var body = r.response.body || '';
      var ct = (r.response.headers?.['content-type'] || r.response.headers?.['Content-Type'] || '').toLowerCase();
      if (r.response.bodyBase64 && isBinaryContentType(ct)) {
        body = tr('webview.binaryResponse');
      }
      if (body.length > 2000) body = body.substring(0, 2000) + '\\n... (truncated)';
      detail.textContent = tr('webview.runStatus') + ': ' + r.response.status + ' ' + r.response.statusText +
        '\\n' + tr('webview.size') + ': ' + formatSize(r.response.size) +
        (responseDecodingWarningText(r.response) ? '\\n' + responseDecodingWarningText(r.response) : '') + '\\n\\n' + body;
    }
    row.after(detail);
  });
}

function updateRunnerStatus(msg) {
  if (!runnerOverlay) return;
  runnerStatusState = msg;
  var titleEl = runnerOverlay.querySelector('.js-runner-live-title');
  var copyEl = runnerOverlay.querySelector('.js-runner-live-copy');
  if (titleEl) {
    titleEl.textContent = msg.phase === 'retry'
      ? tr('webview.runRetrying')
      : msg.phase === 'delay'
        ? tr('webview.runWaiting')
        : tr('webview.runSending');
  }
  if (copyEl) {
    var attemptLabel = tf('webview.runAttempt', {
      current: msg.attempt || 1,
      total: msg.totalAttempts || 1,
    });
    var iterationLabel = tf('webview.runIterationStatus', {
      current: msg.iteration || 1,
      total: msg.totalIterations || 1,
    });
    var prefix = (msg.method || '') + ' ' + (msg.name || '');
    if (msg.phase === 'retry') {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + attemptLabel + ' · ' + tf('webview.runRetryDelay', { count: msg.retryDelayMs || 0 });
    } else if (msg.phase === 'delay') {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + tf('webview.runDelayStatus', { count: msg.delayMs || 0 });
    } else {
      copyEl.textContent = iterationLabel + ' · ' + prefix + ' · ' + attemptLabel;
    }
  }
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(row) {
    row.classList.toggle('active', Number(row.dataset.idx) === Number(msg.index));
  });
}

function updateRunnerRow(msg) {
  if (!runnerOverlay) return;
  var list = runnerOverlay.querySelector('.js-runner-list');
  var isPassed = !msg.error && msg.status < 400;
  var cls = isPassed ? 'pass' : 'fail';
  var icon = isPassed ? '\\u2705' : '\\u274C';
  var statusStr = msg.error ? 'ERR' : (msg.status + '');
  var row = document.createElement('div');
  row.className = 'runner-row method-' + msg.method + ' ' + cls;
  row.dataset.idx = msg.index;
  row.dataset.requestIndex = msg.requestIndex;
  row.innerHTML =
    '<span class="rr-idx">' + (msg.index + 1) + '</span>' +
    '<span class="method-badge method-' + msg.method + '">' + msg.method + '</span>' +
    '<span class="rr-name">' + escapeHtml(tf('webview.runRowName', { iteration: msg.iteration || 1, name: msg.name })) + '</span>' +
    '<span class="rr-status">' + statusStr + '</span>' +
    '<span class="rr-time">' + (msg.time ? msg.time + 'ms' : '-') + '</span>' +
    '<span class="rr-icon">' + icon + '</span>';
  list.appendChild(row);

  
  runnerResults[msg.index] = { error: msg.error, response: msg.response, failed: !isPassed, requestIndex: msg.requestIndex };

  
  var totalRuns = msg.totalRuns || msg.total;
  var pct = Math.round(((msg.index + 1) / totalRuns) * 100);
  runnerOverlay.querySelector('.js-runner-counter').textContent = (msg.index + 1) + '/' + totalRuns;
  runnerOverlay.querySelector('.js-runner-bar').style.transform = 'scaleX(' + (pct / 100) + ')';
  var iterationEl = runnerOverlay.querySelector('.js-runner-iteration');
  if (iterationEl) iterationEl.textContent = (msg.iteration || 1) + '/' + (msg.totalIterations || 1);
  runnerOverlay.querySelector('.js-runner-pass').textContent = msg.passed;
  runnerOverlay.querySelector('.js-runner-fail').textContent = msg.failed;
  runnerOverlay.querySelector('.js-runner-skip').textContent = msg.skipped || 0;
  runnerOverlay.querySelectorAll('.runner-row').forEach(function(existingRow) {
    existingRow.classList.toggle('active', Number(existingRow.dataset.idx) === Number(msg.index));
  });

  
  list.scrollTop = list.scrollHeight;
}

function finishRunner(msg) {
  if (!runnerOverlay) return;
  
  var spinner = runnerOverlay.querySelector('.js-runner-spinner');
  if (spinner) spinner.remove();
  
  var stopBtn = runnerOverlay.querySelector('.js-runner-stop');
  if (stopBtn) stopBtn.classList.add('hidden');
  var rerunBtn = runnerOverlay.querySelector('.js-runner-rerun');
  if (rerunBtn) {
    rerunBtn.classList.toggle('hidden', msg.failed <= 0);
    rerunBtn.disabled = false;
  }
  var closeBtn = runnerOverlay.querySelector('.js-runner-close');
  if (closeBtn) closeBtn.classList.remove('hidden');
  var liveTitle = runnerOverlay.querySelector('.js-runner-live-title');
  var liveCopy = runnerOverlay.querySelector('.js-runner-live-copy');
  if (liveTitle) liveTitle.textContent = tr('webview.runStatus');
  if (liveCopy) {
    liveCopy.textContent = msg.stopped
      ? tr('webview.runStopping')
      : msg.stoppedOnFailure
        ? tf('webview.runStoppedOnFailure', { count: msg.skipped || 0 })
        : '';
  }
  
  runnerOverlay.querySelector('.js-runner-time').textContent = tr('webview.runTime') + ': ' + msg.time + 'ms';
  var skipEl = runnerOverlay.querySelector('.js-runner-skip');
  if (skipEl) skipEl.textContent = msg.skipped || 0;
  
  if (!msg.stopped) {
    runnerOverlay.querySelector('.js-runner-bar').style.transform = 'scaleX(1)';
  }
}
`;
}
