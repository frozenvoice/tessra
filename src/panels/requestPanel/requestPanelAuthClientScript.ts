/** Request panel Auth Editor client fragment (same Webview lexical scope as main client script). */

export function getRequestPanelAuthClientScript(): string {
  return /*js*/ `
function authTypeLabel(type) {
  var map = {
    none: tr('webview.noAuth'),
    basic: tr('webview.basicAuth'),
    bearer: tr('webview.bearerToken'),
    apikey: tr('webview.apiKey'),
  };
  return map[type] || type;
}

function authHtml(auth) {
  const type = auth?.type || 'none';
  return '<select class="js-auth-type">' +
    ['none','basic','bearer','apikey'].map(t =>
      '<option value="' + t + '"' + (t === type ? ' selected' : '') + '>' +
      authTypeLabel(t) + '</option>'
    ).join('') +
    '</select><div class="auth-fields js-auth-fields">' + authFieldsHtml(type, auth) + '</div>';
}

function maskedAuthInputHtml(label, className, value, sensitive) {
  return '<div class="auth-row"><label>' + escapeHtml(label) + '</label>' +
    '<input type="' + (sensitive ? 'password' : 'text') + '" class="' + className + '" value="' + escapeAttr(value) + '"/>' +
    (sensitive
      ? '<button class="ghost-btn auth-reveal js-auth-reveal" type="button">' + escapeHtml(tr('webview.revealShort')) + '</button>'
      : '') +
  '</div>';
}

function authFieldsHtml(type, auth) {
  if (type === 'basic') {
    const u = auth?.basic?.username || '';
    const p = auth?.basic?.password || '';
    return maskedAuthInputHtml(tr('webview.username'), 'js-auth-user', u, false) +
           maskedAuthInputHtml(tr('webview.password'), 'js-auth-pass', p, true);
  }
  if (type === 'bearer') {
    const t = auth?.bearer?.token || '';
    return maskedAuthInputHtml(tr('webview.token'), 'js-auth-token', t, true);
  }
  if (type === 'apikey') {
    const k = auth?.apikey?.key || '';
    const v = auth?.apikey?.value || '';
    const a = auth?.apikey?.addTo || 'header';
    return maskedAuthInputHtml(tr('webview.key'), 'js-auth-apikey', k, false) +
           maskedAuthInputHtml(tr('webview.value'), 'js-auth-apival', v, true) +
           '<div class="auth-row"><label>' + escapeHtml(tr('webview.addTo')) + '</label><select class="js-auth-addto"><option value="header"' + (a==='header'?' selected':'') + '>' + escapeHtml(tr('webview.header')) + '</option><option value="query"' + (a==='query'?' selected':'') + '>' + escapeHtml(tr('webview.query')) + '</option></select></div>';
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

function bindRequestAuthEditor(mc) {
  mc.querySelector('.js-auth-type')?.addEventListener('change', (e) => {
    const fields = mc.querySelector('.js-auth-fields');
    if (fields) fields.innerHTML = authFieldsHtml(e.target.value);
    markDirty();
    refreshDraftInsights(mc);
  });

  mc.querySelector('.js-auth-fields')?.addEventListener('input', function() {
    markDirty();
    refreshDraftInsights(mc);
  });
  mc.querySelector('.js-auth-fields')?.addEventListener('click', function(e) {
    if (!e.target.classList.contains('js-auth-reveal')) return;
    var wrap = e.target.closest('.auth-inline-control');
    var input = wrap?.querySelector('input');
    if (!input) return;
    var revealing = input.type === 'password';
    input.type = revealing ? 'text' : 'password';
    e.target.textContent = revealing ? tr('webview.hideShort') : tr('webview.revealShort');
  });
}
`;
}
