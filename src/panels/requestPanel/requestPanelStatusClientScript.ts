/** Request panel Status Strip client fragment (same Webview lexical scope as main client script). */
export function getRequestPanelStatusClientScript(): string {
  return /*js*/ `
function syncEnvironmentStripDisclosureState() {
  var btn = mainContent?.querySelector('.status-strip-seg[data-action="edit-environment"]');
  if (!btn) return;
  btn.setAttribute('aria-expanded', isEnvironmentEditorOpen() ? 'true' : 'false');
}

function countExecutableScripts(scripts) {
  var count = 0;
  if (scripts && (scripts.preRequest || '').trim()) count++;
  if (scripts && (scripts.test || '').trim()) count++;
  return count;
}

function renderStatusStripCue(cue) {
  if (cue === 'on-dot') return '<span class="status-strip-cue" aria-hidden="true">●</span>';
  if (cue === 'on-check') return '<span class="status-strip-cue" aria-hidden="true">✓</span>';
  if (cue === 'warn') return '<span class="status-strip-cue" aria-hidden="true">⚠</span>';
  if (cue === 'off') return '<span class="status-strip-cue" aria-hidden="true">○</span>';
  return '';
}

function renderStatusStripLabelHtml(label, count) {
  if (count == null) return escapeHtml(label);
  var countStr = String(count);
  var idx = String(label).lastIndexOf(countStr);
  if (idx < 0) return escapeHtml(label);
  return escapeHtml(String(label).slice(0, idx)) +
    '<span class="status-strip-num">' + escapeHtml(countStr) + '</span>' +
    escapeHtml(String(label).slice(idx + countStr.length));
}

function getStatusStripRoot() {
  return (typeof mainContent !== 'undefined' && mainContent)
    ? mainContent.querySelector('.js-status-strip')
    : null;
}

function isStatusStripExpanded() {
  return getStatusStripRoot()?.dataset?.expanded === '1';
}

function setStatusStripExpanded(open, options) {
  var opts = options || {};
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var strip = host?.querySelector('.js-status-strip');
  var panel = strip?.querySelector('.js-status-strip-panel');
  var toggle = strip?.querySelector('.js-status-strip-toggle');
  if (!strip || !panel || !toggle) return false;
  strip.dataset.expanded = open ? '1' : '0';
  panel.classList.toggle('hidden', !open);
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.setAttribute('aria-label', open ? tr('webview.collapse') : tr('webview.expand'));
  toggle.setAttribute('title', open ? tr('webview.collapse') : tr('webview.expand'));
  // Used/Vars 세그먼트 aria-expanded 동기화
  host.querySelectorAll('.status-strip-seg[data-action="reveal-variable-usage"]').forEach(function(btn) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  if (open && opts.focusSelector) {
    var target = panel.querySelector(opts.focusSelector);
    if (target) {
      clearLinkedFocusInContent(host);
      if (typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (_) {
          target.scrollIntoView();
        }
      }
      queueLinkedFocusReveal(function() {
        if (!target?.isConnected) return;
        target.classList.add('linked-focus-active');
        var focusable = target.querySelector('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])') || target;
        focusLinkedTarget(focusable);
        linkedFocusTimer = setTimeout(function() {
          target.classList.remove('linked-focus-active');
          linkedFocusTimer = null;
        }, 2200);
      });
    }
  }
  return true;
}

function revealVariableUsageDisclosure() {
  var host = (typeof mainContent !== 'undefined' && mainContent) ? mainContent : null;
  var focusSel = host?.querySelector('.js-status-strip-unresolved')
    ? '.js-status-strip-unresolved'
    : '.js-status-strip-var-usage';
  setStatusStripExpanded(true, { focusSelector: focusSel });
}

function renderStatusStripSegment(label, tone, action, meta, tooltip, options) {
  options = options || {};
  var cue = options.cue || '';
  var priority = options.priority || 'medium';
  var classes = 'status-strip-seg' + (tone ? ' ' + tone : '') + (action ? ' clickable' : '');
  var testId = '';
  if (action === 'edit-environment' || action === 'switch-environment') {
    testId = 'status-environment';
  } else if (action === 'reveal-variable-usage') {
    testId = 'status-variable-usage';
  }
  var attrs = action
    ? ' type="button" data-action="' + escapeAttr(action) + '"' + (meta ? ' data-meta="' + escapeAttr(meta) + '"' : '')
    : '';
  if (testId) {
    attrs += ' data-testid="' + escapeAttr(testId) + '"';
  }
  if (options.ariaExpanded != null) {
    attrs += ' aria-expanded="' + (options.ariaExpanded ? 'true' : 'false') + '"';
  }
  if (options.ariaControls) {
    attrs += ' aria-controls="' + escapeAttr(options.ariaControls) + '"';
  }
  var titleAttr = tooltip ? ' title="' + escapeAttr(tooltip) + '"' : '';
  var priorityAttr = ' data-priority="' + escapeAttr(priority) + '"';
  var tag = action ? 'button' : 'span';
  var labelInner = options.labelHtml != null
    ? options.labelHtml
    : renderStatusStripLabelHtml(label, options.count);
  return '<' + tag + ' class="' + classes + '"' + attrs + priorityAttr + titleAttr + '>' +
    (options.mark ? renderTessraMark('tessra-mark--strip') : '') +
    renderStatusStripCue(cue) +
    '<span class="status-strip-label">' + labelInner + '</span>' +
  '</' + tag + '>';
}

function buildStatusStripSegments(tab) {
  var segments = [];

  // 1) Environment — always first; shows active env variable count (not request usage)
  var envLabel = currentEnvName || tr('webview.noEnvironment');
  var envTip = currentEnvName
    ? tf('webview.summaryEnvironment', { name: currentEnvName }) + ' · ' + tfCount('environment.vars', envEditorVariableCount)
    : tr('webview.noEnvironment');
  var envLabelHtml = escapeHtml(envLabel);
  if (currentEnvName) {
    envLabelHtml += '<span class="status-strip-env-count"> ' +
      renderStatusStripLabelHtml(tfCount('environment.vars', envEditorVariableCount), envEditorVariableCount) +
      '</span>';
  }
  segments.push(renderStatusStripSegment(
    envLabel,
    currentEnvName ? 'is-env' : 'is-warn',
    currentEnvName ? 'edit-environment' : 'switch-environment',
    null,
    envTip,
    {
      cue: currentEnvName ? '' : 'warn',
      priority: 'critical',
      mark: true,
      labelHtml: envLabelHtml,
      ariaExpanded: currentEnvName ? isEnvironmentEditorOpen() : undefined,
      ariaControls: currentEnvName ? 'envEditor' : undefined
    }
  ));

  // 2) Scripts — glanceable when present; warn when disabled/untrusted
  var hasScripts = hasExecutableScripts(tab?.scripts);
  var scriptsOff = !!(tab?.disableScripts || (hasScripts && tab?.scriptsTrusted === false));
  var scriptCount = countExecutableScripts(tab?.scripts);
  if (scriptsOff) {
    var scriptsOffMeta = tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request';
    segments.push(renderStatusStripSegment(
      tr('webview.disableScriptsStatus'),
      'is-warn',
      'switch-tab',
      scriptsOffMeta,
      tr('webview.disableScriptsStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else if (hasScripts) {
    var scriptsLabel = scriptCount > 1
      ? tfCount('webview.stripScriptsCount', scriptCount)
      : tr('webview.scriptsPresentStatus');
    segments.push(renderStatusStripSegment(
      scriptsLabel,
      'is-on',
      'switch-tab',
      'scripts:pre-request',
      tr('webview.summaryScriptsOn'),
      { cue: 'on-dot', priority: 'high' }
    ));
  }

  // 3) History — always visible; on/off must be distinguishable at a glance
  var historyOn = tab?.saveToHistory !== false;
  segments.push(renderStatusStripSegment(
    tr(historyOn ? 'webview.saveToHistoryOnStatus' : 'webview.saveToHistoryOffStatus'),
    historyOn ? 'is-on' : 'is-off',
    'switch-tab',
    'settings:save-history',
    tr(historyOn ? 'webview.summaryHistoryOn' : 'webview.summaryHistoryOff'),
    { cue: historyOn ? 'on-check' : 'off', priority: 'high' }
  ));

  // 4) Defaults — applied count or skipped warning only
  if (tab?.skipDefaultHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.skipDefaultHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:skip-default-headers',
      tr('webview.skipDefaultHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  } else {
    var appliedDefaultHeaders = getAppliedDefaultHeaders(tab);
    if (appliedDefaultHeaders.length > 0) {
      segments.push(renderStatusStripSegment(
        tfCount('webview.stripDefaultsCount', appliedDefaultHeaders.length),
        'is-info',
        'open-default-headers',
        null,
        tr('webview.defaultHeaders'),
        { priority: 'medium', count: appliedDefaultHeaders.length }
      ));
    }
  }

  // 5) Risk / non-default execution overrides
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    segments.push(renderStatusStripSegment(
      tr('webview.tlsInsecureStatus'),
      'is-warn',
      'switch-tab',
      'settings:tls-validation',
      tr('webview.tlsInsecureStatus'),
      { cue: 'warn', priority: 'critical' }
    ));
  }
  if (tab?.followRedirects) {
    segments.push(renderStatusStripSegment(
      tr('webview.followRedirectsStatus'),
      'is-info',
      'switch-tab',
      'settings:follow-redirects',
      tr('webview.followRedirectsStatus'),
      { priority: 'medium' }
    ));
  }
  if (tab?.stopAfterHeaders) {
    segments.push(renderStatusStripSegment(
      tr('webview.stopAfterHeadersStatus'),
      'is-warn',
      'switch-tab',
      'settings:stop-after-headers',
      tr('webview.stopAfterHeadersStatus'),
      { cue: 'warn', priority: 'high' }
    ));
  }

  // 6) Request variable usage — distinct from active env's defined var count.
  // Click opens strip disclosure with the same {{var}} + scope list 1.0.9 showed (not a permanent card).
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  if (unresolved.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripVarsCount', unresolved.length),
      'is-warn',
      'reveal-variable-usage',
      null,
      unresolved.map(function(n) { return '{{' + n + '}}'; }).join(', '),
      {
        cue: 'warn',
        priority: 'high',
        count: unresolved.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  } else if (usage.length > 0) {
    segments.push(renderStatusStripSegment(
      tfCount('webview.stripUsedCount', usage.length),
      'is-info',
      'reveal-variable-usage',
      null,
      usage.map(function(u) { return '{{' + u.name + '}}'; }).join(', '),
      {
        priority: 'low',
        count: usage.length,
        ariaExpanded: isStatusStripExpanded(),
        ariaControls: 'statusStripVariableUsage'
      }
    ));
  }

  // Profile stays in expand disclosure only — not on the always-visible line.
  return segments;
}

function renderStatusStripExpandDetails(tab) {
  var usage = collectVariableUsage(tab);
  var unresolved = getUnresolvedDraftVariableNames(tab);
  var applied = getAppliedDefaultHeaders(tab);
  var parts = [];
  parts.push('<div class="status-strip-detail-block">' +
    '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(currentEnvName ? tf('webview.summaryEnvironment', { name: currentEnvName }) : tr('webview.noEnvironment')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="change-workspace-profile" title="' + escapeAttr(tr(currentWorkspaceProfile === 'default' ? 'webview.profileDefaultTooltip' : 'webview.profileCustomTooltip')) + '">' + escapeHtml(renderProfileIndicator(currentWorkspaceProfile)) + '</button>' +
    '<button type="button" class="status-strip-link" data-action="open-default-headers">' + escapeHtml(tr('webview.defaultHeaders')) + '</button>' +
  '</div>');
  if (unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block warning js-status-strip-unresolved">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.unresolvedVariablesCount', unresolved.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(unresolved.map(function(name) { return '{{' + name + '}}'; }).join(', ')) + '</div>' +
      '<button type="button" class="status-strip-link" data-action="edit-environment">' + escapeHtml(tr('webview.editEnvironmentVariables')) + '</button>' +
      '<button type="button" class="status-strip-link" data-action="switch-environment">' + escapeHtml(tr('webview.openEnvironmentPicker')) + '</button>' +
    '</div>');
  }
  // Visible variable-usage list lives in strip disclosure (Quiet Instrument); keep js-variable-usage-wrap for refresh.
  if (usage.length > 0 || unresolved.length > 0) {
    parts.push('<div class="status-strip-detail-block js-status-strip-var-usage" id="statusStripVariableUsage" data-testid="variable-usage-disclosure">' +
      '<div class="js-variable-usage-wrap">' + renderVariableUsage(tab) + '</div>' +
    '</div>');
  }
  if (applied.length > 0 && !tab?.skipDefaultHeaders) {
    parts.push('<div class="status-strip-detail-block">' +
      '<div class="status-strip-detail-title">' + escapeHtml(tfCount('webview.defaultHeadersApplied', applied.length)) + '</div>' +
      '<div class="status-strip-detail-copy">' + escapeHtml(applied.map(function(h) { return h.key; }).join(', ')) + '</div>' +
    '</div>');
  }
  var warnings = [];
  var expandHasScripts = hasExecutableScripts(tab?.scripts);
  var expandScriptsOff = !!(tab?.disableScripts || (expandHasScripts && tab?.scriptsTrusted === false));
  if (expandScriptsOff) {
    warnings.push({
      label: tr('webview.disableScriptsStatus'),
      action: 'switch-tab',
      meta: tab?.disableScripts ? 'settings:disable-scripts' : 'scripts:pre-request'
    });
  } else if (expandHasScripts) {
    warnings.push({ label: tr('webview.scriptsPresentStatus'), action: 'switch-tab', meta: 'scripts:pre-request' });
  }
  if (tab?.followRedirects) warnings.push({ label: tr('webview.followRedirectsStatus'), action: 'switch-tab', meta: 'settings:follow-redirects' });
  if (tab?.stopAfterHeaders) warnings.push({ label: tr('webview.stopAfterHeadersStatus'), action: 'switch-tab', meta: 'settings:stop-after-headers' });
  if (tab?.saveToHistory === false) warnings.push({ label: tr('webview.saveToHistoryOffStatus'), action: 'switch-tab', meta: 'settings:save-history' });
  if (tab?.skipDefaultHeaders) warnings.push({ label: tr('webview.skipDefaultHeadersStatus'), action: 'switch-tab', meta: 'settings:skip-default-headers' });
  if (normalizeTlsValidation(tab?.tlsValidation) === 'insecure') {
    warnings.push({ label: tr('webview.tlsInsecureStatus'), action: 'switch-tab', meta: 'settings:tls-validation' });
  }
  if (warnings.length) {
    parts.push('<div class="status-strip-detail-block">' + warnings.map(function(w) {
      return '<button type="button" class="status-strip-link" data-action="' + escapeAttr(w.action) + '" data-meta="' + escapeAttr(w.meta) + '">' + escapeHtml(w.label) + '</button>';
    }).join('') + '</div>');
  }
  // 레거시 선택자는 유지하되, aria-hidden 영역 안에 포커스 가능한 버튼을 만들지 않는다.
  // 실제 상태 액션은 위 disclosure의 일반 버튼에서 제공한다.
  parts.push('<div class="request-status-chips js-topline-status-chips visually-hidden" aria-hidden="true"></div>');
  parts.push('<div class="js-request-preflight-wrap visually-hidden" aria-hidden="true">' + renderRequestPreflight(tab) + '</div>');
  return parts.join('');
}

function renderStatusStrip(tab) {
  var segments = buildStatusStripSegments(tab);
  var sep = '<span class="status-strip-sep" aria-hidden="true">│</span>';
  return '<div class="status-strip js-status-strip" data-expanded="0">' +
    '<div class="status-strip-line">' +
      '<div class="status-strip-segments">' + segments.join(sep) + '</div>' +
      '<button type="button" class="status-strip-toggle js-status-strip-toggle" aria-expanded="false" aria-label="' + escapeAttr(tr('webview.expand')) + '" title="' + escapeAttr(tr('webview.expand')) + '">▾</button>' +
    '</div>' +
    '<div class="status-strip-panel js-status-strip-panel hidden">' + renderStatusStripExpandDetails(tab) + '</div>' +
  '</div>';
}

function refreshStatusStrip(mc) {
  var wrap = mc?.querySelector('.js-status-strip-host');
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!wrap || !tab) return;
  var draftTab = buildDraftTabFromContent(mc);
  var wasExpanded = isStatusStripExpanded();
  wrap.innerHTML = renderStatusStrip(draftTab);
  if (wasExpanded) {
    setStatusStripExpanded(true);
  }
  syncEnvironmentStripDisclosureState();
}
`;
}
