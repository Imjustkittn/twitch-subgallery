(() => {
  const $gallery = document.getElementById('gallery');
  const $gate = document.getElementById('gate');
  const tpl = document.getElementById('photo-tpl');

  let auth = null;
  let pendingComment = null;

  function gate(msg, withButton) {
    $gate.classList.remove('hidden');
    $gallery.classList.add('hidden');
    $gate.innerHTML = `<div class="card"><b>Subscriber‑only gallery</b><br><small>${msg}</small><br>${withButton ? '<p><button id="linkId">Share identity</button></p>' : ''}</div>`;
    if (withButton) document.getElementById('linkId').onclick = () => Twitch.ext.actions.requestIdShare();
  }

  function showGallery() { $gate.classList.add('hidden'); $gallery.classList.remove('hidden'); }

  async function fetchJSON(url, body) {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-extension-jwt': auth.token, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw await res.json().catch(() => ({ error: 'http_' + res.status }));
    return res.json();
  }

  function render(list) {
    $gallery.innerHTML = '';
    list.forEach(p => {
      const node = tpl.content.cloneNode(true);
      const img = node.querySelector('.img');
      const title = node.querySelector('.title');
      const statsBits = node.querySelector('.bits');
      const statsComments = node.querySelector('.comments');
      const buttons = node.querySelectorAll('button[data-sku]');
      const commentBtn = node.querySelector('button.comment');

      img.src = p.url; title.textContent = p.title || '';
      statsBits.textContent = p.totalBits; statsComments.textContent = p.comments;

      buttons.forEach(btn => btn.addEventListener('click', () => {
        Twitch.ext.bits.useBits(btn.dataset.sku);
        btn.disabled = true; setTimeout(() => (btn.disabled = false), 1500);
        btn.blur();
      }));

      commentBtn.addEventListener('click', () => {
        const text = prompt('Write your comment (costs 500 Bits):');
        if (!text) return;
        pendingComment = { photoId: p.id, text };
        Twitch.ext.bits.useBits('COMMENT_500');
      });

      node.querySelector('.photo').dataset.id = p.id;
      $gallery.appendChild(node);
    });
  }

  async function load() {
    try {
      const list = await fetchJSON('https://YOUR-EBS-DOMAIN/api/photos');
      render(list); showGallery();
    } catch (e) {
      if (e && e.error === 'link_identity') return gate('Please share your identity to verify your sub status.', true);
      if (e && e.error === 'not_subscribed') return gate('Subscribe to unlock this gallery.', false);
      gate('Temporarily unavailable.');
    }
  }

  Twitch.ext.onAuthorized(async (_auth) => {
    auth = { token: _auth.token, channelId: _auth.channelId, clientId: _auth.clientId, userId: _auth.userId };

    Twitch.ext.listen('broadcast', (_topic, _type, msg) => {
      try { const ev = JSON.parse(msg); if (ev.type === 'tip') {
        const el = $gallery.querySelector(`[data-id="${ev.photoId}"] .bits`);
        if (el) el.textContent = String(Number(el.textContent) + ev.bits);
      } else if (ev.type === 'comment:approved') {
        // Optional: show approved comments
      }} catch {}
    });

    Twitch.ext.bits.onTransactionComplete(async (tx) => {
      const payload = { transactionReceipt: tx.transactionReceipt, sku: tx.product.sku };
      if (tx.product.sku === 'COMMENT_500' && pendingComment) {
        payload.photoId = pendingComment.photoId;
        payload.commentText = pendingComment.text;
        pendingComment = null;
      } else {
        const sel = document.activeElement?.closest('.photo');
        if (sel) payload.photoId = sel.dataset.id;
      }
      try { await fetchJSON('https://YOUR-EBS-DOMAIN/api/transactions/complete', payload); }
      catch (e) { console.warn('receipt rejected', e); }
    });

    load();
  });
})();