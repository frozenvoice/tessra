/** Request panel Path Variables client fragment (same Webview lexical scope as main client script). */

export function getRequestPanelPathVariablesClientScript(): string {
  return /*js*/ `
var PATH_VAR_FULL_SEGMENT = /^\\{\\{\\s*([^}]+?)\\s*\\}\\}$/;

function splitUrlBaseForPathVars(rawUrl) {
  var raw = String(rawUrl || '');
  var working = raw;
  var fragment = '';
  var hashIndex = working.indexOf('#');
  if (hashIndex >= 0) {
    fragment = working.substring(hashIndex);
    working = working.substring(0, hashIndex);
  }
  var base = working;
  var query = '';
  var questionIndex = working.indexOf('?');
  if (questionIndex >= 0) {
    base = working.substring(0, questionIndex);
    query = working.substring(questionIndex + 1);
  }
  return { base: base, query: query, fragment: fragment };
}

function getPathSegmentsForPathVars(base) {
  var raw = String(base || '');
  if (!raw) return [];
  var schemeAuthority = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\//);
  if (schemeAuthority) {
    var afterScheme = raw.substring(schemeAuthority[0].length);
    var slash = afterScheme.indexOf('/');
    if (slash < 0) return [];
    return afterScheme.substring(slash + 1).split('/').filter(function(segment) { return segment.length > 0; });
  }
  if (raw.charAt(0) === '/') {
    return raw.split('/').filter(function(segment) { return segment.length > 0; });
  }
  var segments = raw.split('/');
  if (segments.length <= 1) return [];
  if (PATH_VAR_FULL_SEGMENT.test(segments[0])) {
    return segments.slice(1).filter(function(segment) { return segment.length > 0; });
  }
  return segments.filter(function(segment) { return segment.length > 0; });
}

function extractPathVariableNames(rawUrl) {
  var segments = getPathSegmentsForPathVars(splitUrlBaseForPathVars(rawUrl).base);
  var names = [];
  var seen = {};
  segments.forEach(function(segment) {
    var match = segment.match(PATH_VAR_FULL_SEGMENT);
    if (!match) return;
    var name = String(match[1] || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    names.push(name);
  });
  return names;
}

function normalizePathVariableOverrides(value) {
  if (!Array.isArray(value)) return [];
  var out = [];
  var seen = {};
  value.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    var key = typeof item.key === 'string' ? item.key.trim() : '';
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push({
      key: key,
      value: typeof item.value === 'string' ? item.value : String(item.value == null ? '' : item.value)
    });
  });
  return out;
}

function prunePathVariableOverrides(url, overrides) {
  var active = {};
  extractPathVariableNames(url).forEach(function(name) { active[name] = true; });
  return normalizePathVariableOverrides(overrides).filter(function(item) { return !!active[item.key]; });
}

function applyPathVariableOverridesToUrl(rawUrl, overrides) {
  var overrideMap = {};
  normalizePathVariableOverrides(overrides).forEach(function(item) {
    overrideMap[item.key] = item.value;
  });
  var keys = Object.keys(overrideMap);
  if (!keys.length) return String(rawUrl || '');
  var parts = splitUrlBaseForPathVars(rawUrl);
  var nextBase = rewritePathBaseForPathVars(parts.base, overrideMap);
  return nextBase + (parts.query ? ('?' + parts.query) : '') + parts.fragment;
}

function rewritePathBaseForPathVars(base, overrideMap) {
  var raw = String(base || '');
  if (!raw) return raw;
  var schemeAuthority = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\//);
  if (schemeAuthority) {
    var prefix = schemeAuthority[0];
    var afterScheme = raw.substring(prefix.length);
    var slash = afterScheme.indexOf('/');
    if (slash < 0) return raw;
    var authority = afterScheme.substring(0, slash);
    var pathAndRest = afterScheme.substring(slash);
    return prefix + authority + rewriteSlashPathForPathVars(pathAndRest, overrideMap);
  }
  if (raw.charAt(0) === '/') {
    return rewriteSlashPathForPathVars(raw, overrideMap);
  }
  var segments = raw.split('/');
  if (segments.length <= 1) return raw;
  var startIndex = PATH_VAR_FULL_SEGMENT.test(segments[0]) ? 1 : 0;
  for (var i = startIndex; i < segments.length; i++) {
    var match = segments[i].match(PATH_VAR_FULL_SEGMENT);
    if (!match) continue;
    var name = String(match[1] || '').trim();
    if (Object.prototype.hasOwnProperty.call(overrideMap, name)) {
      segments[i] = overrideMap[name];
    }
  }
  return segments.join('/');
}

function rewriteSlashPathForPathVars(pathWithLeadingSlash, overrideMap) {
  var leadingSlash = pathWithLeadingSlash.charAt(0) === '/';
  var body = leadingSlash ? pathWithLeadingSlash.substring(1) : pathWithLeadingSlash;
  if (!body) return leadingSlash ? '/' : '';
  var next = body.split('/').map(function(segment) {
    var match = segment.match(PATH_VAR_FULL_SEGMENT);
    if (!match) return segment;
    var name = String(match[1] || '').trim();
    return Object.prototype.hasOwnProperty.call(overrideMap, name) ? overrideMap[name] : segment;
  });
  return (leadingSlash ? '/' : '') + next.join('/');
}

function getPathVariableOverrideMap(overrides) {
  var map = {};
  normalizePathVariableOverrides(overrides).forEach(function(item) {
    map[item.key] = item.value;
  });
  return map;
}

function hasEnvironmentPathVariable(name) {
  return activeVarKeys.indexOf(name) >= 0;
}

function getEnvironmentPathVariableValue(name) {
  return Object.prototype.hasOwnProperty.call(activeVarValues, name)
    ? String(activeVarValues[name] ?? '')
    : '';
}

/**
 * Occurrence-level URL template analysis for underline / popover.
 * Path overrides resolve only full path-segment occurrences.
 */
function analyzeUrlVariableOccurrencesForUi(rawUrl, overrides) {
  var url = String(rawUrl || '');
  var parts = splitUrlBaseForPathVars(url);
  var overrideMap = getPathVariableOverrideMap(overrides);
  var pathNames = {};
  extractPathVariableNames(url).forEach(function(name) { pathNames[name] = true; });
  var out = [];
  var re = /\\{\\{([^}]+)\\}\\}/g;
  var match;
  while ((match = re.exec(url)) !== null) {
    var raw = match[0];
    var name = String(match[1] || '').trim();
    if (!name) continue;
    var index = match.index;
    var end = index + raw.length;
    var inPathPortion = end <= parts.base.length;
    var prev = index > 0 ? url.charAt(index - 1) : '';
    var next = end < parts.base.length ? parts.base.charAt(end) : '';
    var boundedAsSegment = inPathPortion
      && (index === 0 || prev === '/')
      && (end === parts.base.length || next === '/');
    var scope = (boundedAsSegment && pathNames[name]) ? 'path' : 'other';
    var resolvedBy = null;
    var value = '';
    if (scope === 'path' && Object.prototype.hasOwnProperty.call(overrideMap, name)) {
      resolvedBy = 'path-override';
      value = String(overrideMap[name] ?? '');
    } else if (hasEnvironmentPathVariable(name)) {
      resolvedBy = 'environment';
      value = getEnvironmentPathVariableValue(name);
    }
    out.push({
      index: index,
      end: end,
      name: name,
      raw: raw,
      scope: scope,
      resolvedBy: resolvedBy,
      value: value,
      missing: resolvedBy === null
    });
  }
  return out;
}

function renderPathVariablesSection(tab) {
  var names = extractPathVariableNames(tab && tab.url ? tab.url : '');
  if (!names.length) return '';
  var overrideMap = getPathVariableOverrideMap(tab.pathVariableOverrides);
  var rows = names.map(function(name) {
    var hasOverride = Object.prototype.hasOwnProperty.call(overrideMap, name);
    var hasEnv = hasEnvironmentPathVariable(name);
    var envValue = hasEnv ? getEnvironmentPathVariableValue(name) : '';
    if (hasOverride || !hasEnv) {
      var value = hasOverride ? overrideMap[name] : '';
      var actionLabel = hasEnv ? tr('webview.pathVarReset') : tr('webview.pathVarClear');
      var actionClass = hasEnv ? 'js-path-var-reset' : 'js-path-var-clear';
      var showAction = hasOverride;
      var envHint = hasEnv && hasOverride
        ? '<span class="path-var-env-hint">' + escapeHtml(tf('webview.pathVarEnvHint', { value: envValue })) + '</span>'
        : '';
      return '<div class="path-var-row js-path-var-row" data-key="' + escapeAttr(name) + '" data-mode="request" data-override="' + (hasOverride ? '1' : '0') + '" data-testid="path-variable-row">' +
        '<div class="path-var-key" title="{{' + escapeAttr(name) + '}}">' + escapeHtml(name) + '</div>' +
        '<div class="path-var-value-wrap">' +
          '<input class="path-var-input js-path-var-value" type="text" data-testid="path-variable-value" spellcheck="false" placeholder="' + escapeAttr(tr('webview.pathVarEnterValue')) + '" value="' + escapeAttr(value) + '" aria-label="' + escapeAttr(tf('webview.pathVarValueAria', { name: name })) + '"/>' +
          envHint +
        '</div>' +
        '<div class="path-var-meta">' + escapeHtml(hasOverride ? tr('webview.pathVarSourceRequest') : tr('webview.pathVarSourceUnresolved')) + '</div>' +
        (showAction
          ? '<button class="ghost-btn path-var-action ' + actionClass + '" type="button" data-testid="path-variable-reset">' + escapeHtml(actionLabel) + '</button>'
          : '<span class="path-var-action-spacer" aria-hidden="true"></span>') +
      '</div>';
    }
    return '<div class="path-var-row js-path-var-row" data-key="' + escapeAttr(name) + '" data-mode="environment" data-testid="path-variable-row">' +
      '<div class="path-var-key" title="{{' + escapeAttr(name) + '}}">' + escapeHtml(name) + '</div>' +
      '<div class="path-var-value-wrap">' +
        '<div class="path-var-readonly" data-testid="path-variable-env-value">' + escapeHtml(envValue) + '</div>' +
      '</div>' +
      '<div class="path-var-meta">' + escapeHtml(tr('webview.pathVarSourceEnvironment')) + '</div>' +
      '<button class="ghost-btn path-var-action js-path-var-override" type="button" data-testid="path-variable-override">' + escapeHtml(tr('webview.pathVarOverride')) + '</button>' +
    '</div>';
  }).join('');

  return '<section class="path-variables js-path-variables" data-testid="path-variables" aria-label="' + escapeAttr(tr('webview.pathVariables')) + '">' +
    '<div class="path-variables-head">' +
      '<div class="path-variables-title">' + escapeHtml(tr('webview.pathVariables')) + '</div>' +
    '</div>' +
    '<div class="path-variables-rows js-path-variables-rows">' + rows + '</div>' +
  '</section>';
}

function collectPathVariableOverridesFromContent(mc, url) {
  var active = {};
  extractPathVariableNames(url || '').forEach(function(name) { active[name] = true; });
  var overrides = [];
  if (!mc) return overrides;
  mc.querySelectorAll('.js-path-var-row').forEach(function(row) {
    var key = row.dataset.key;
    if (!key || !active[key]) return;
    if (row.dataset.mode !== 'request' || row.dataset.override !== '1') return;
    var input = row.querySelector('.js-path-var-value');
    overrides.push({ key: key, value: input ? (input.value || '') : '' });
  });
  return overrides;
}

function setTabPathVariableOverrides(tab, overrides) {
  if (!tab) return;
  tab.pathVariableOverrides = prunePathVariableOverrides(tab.url || '', overrides);
}

function refreshPathVariablesSection(mc) {
  if (!mc) return;
  var tab = tabs.find(function(t) { return t.id === activeTabId; });
  if (!tab) return;
  tab.pathVariableOverrides = prunePathVariableOverrides(tab.url || '', tab.pathVariableOverrides);
  var html = renderPathVariablesSection(tab);
  var existing = mc.querySelector('.js-path-variables');
  if (!html) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.outerHTML = html;
  } else {
    var urlBar = mc.querySelector('.url-bar');
    if (urlBar) {
      urlBar.insertAdjacentHTML('afterend', html);
    }
  }
  bindPathVariablesSection(mc);
}

function upsertPathVariableOverride(tab, key, value) {
  if (!tab || !key) return;
  var next = normalizePathVariableOverrides(tab.pathVariableOverrides).filter(function(item) {
    return item.key !== key;
  });
  next.push({ key: key, value: value == null ? '' : String(value) });
  setTabPathVariableOverrides(tab, next);
}

function removePathVariableOverride(tab, key) {
  if (!tab || !key) return;
  setTabPathVariableOverrides(tab, normalizePathVariableOverrides(tab.pathVariableOverrides).filter(function(item) {
    return item.key !== key;
  }));
}

function bindPathVariablesSection(mc) {
  var section = mc && mc.querySelector('.js-path-variables');
  if (!section || section.dataset.bound === '1') return;
  section.dataset.bound = '1';

  section.addEventListener('input', function(e) {
    var input = e.target.closest('.js-path-var-value');
    if (!input) return;
    var row = input.closest('.js-path-var-row');
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (!tab || !row || !row.dataset.key) return;
    var wasOverride = row.dataset.override === '1';
    row.dataset.override = '1';
    row.dataset.mode = 'request';
    upsertPathVariableOverride(tab, row.dataset.key, input.value || '');
    if (!wasOverride) {
      refreshPathVariablesSection(mc);
      var nextInput = mc.querySelector('.js-path-var-row[data-key="' + row.dataset.key + '"] .js-path-var-value');
      if (nextInput) {
        nextInput.focus();
        try { nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length); } catch (_) {}
      }
    }
    markDirty();
    refreshDraftInsights(mc);
    debouncePersist();
  });

  section.addEventListener('click', function(e) {
    var tab = tabs.find(function(t) { return t.id === activeTabId; });
    if (!tab) return;
    var overrideBtn = e.target.closest('.js-path-var-override');
    if (overrideBtn) {
      var overrideRow = overrideBtn.closest('.js-path-var-row');
      if (!overrideRow || !overrideRow.dataset.key) return;
      var envSeed = hasEnvironmentPathVariable(overrideRow.dataset.key)
        ? getEnvironmentPathVariableValue(overrideRow.dataset.key)
        : '';
      upsertPathVariableOverride(tab, overrideRow.dataset.key, envSeed);
      refreshPathVariablesSection(mc);
      markDirty();
      refreshDraftInsights(mc);
      debouncePersist();
      var focusInput = mc.querySelector('.js-path-var-row[data-key="' + overrideRow.dataset.key + '"] .js-path-var-value');
      focusInput?.focus();
      focusInput?.select?.();
      return;
    }
    var resetBtn = e.target.closest('.js-path-var-reset, .js-path-var-clear');
    if (resetBtn) {
      var resetRow = resetBtn.closest('.js-path-var-row');
      if (!resetRow || !resetRow.dataset.key) return;
      removePathVariableOverride(tab, resetRow.dataset.key);
      refreshPathVariablesSection(mc);
      markDirty();
      refreshDraftInsights(mc);
      debouncePersist();
    }
  });
}

function focusPathVariablesSection(mc) {
  var section = mc && mc.querySelector('.js-path-variables');
  if (!section) return false;
  var target = section.querySelector('.js-path-var-value, .js-path-var-override, .path-var-readonly') || section;
  if (typeof target.scrollIntoView === 'function') {
    try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (_) { target.scrollIntoView(); }
  }
  if (typeof target.focus === 'function') target.focus();
  return true;
}
`;
}
