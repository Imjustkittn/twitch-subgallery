(() => {
  const $url = document.getElementById('url');
  const $title = document.getElementById('title');
  const $add = document.getElementById('add');
  const $oauth = document.getElementById('oauth');
  const $list = document.getElementById('list');
  const $queue = document.getElementById('queue');
  const tpl = document.getElementById('tile');
  let auth = null;
  async function fetchJSON(url, body) {
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'x-extension-jwt': auth.token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw await res.json().catch(() => ({ error: 'http_' + res.status }));
    return res.json();
  }
  async function load() {
    const photos = await fetchJSON('https://twitch-subgallery-1.onrender.com/api/photos');
    $list.innerHTML = '';
    photos.forEach(p => {
      const n = tpl.content.cloneNode(true);
      n.querySelector('.img').src = p.url;
      n.querySelector('.title').textContent = p.title || '';
      const wrap = n.querySelector('.photo');
      wrap.dataset.id = p.id;
      wrap.querySelector('.del').onclick = async () => {
        await fetch('https://twitch-subgallery-1.onrender.com/api/photos/' + p.id, { method: 'DELETE', headers: { 'x-extension-jwt': auth.token } });
        load();
      };
      $list.appendChild(n);
    });
    const q = await fetchJSON('https://twitch-subgallery-1.onrender.com/api/comments/queue');
    $queue.innerHTML = '';
    q.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.text} (photo ${c.photoId}) `;
      const a = document.createElement('button'); a.textContent = 'Approve'; a.onclick = async () => { await fetchJSON(`https://twitch-subgallery-1.onrender.com/api/comments/${c.id}/approve`, {}); li.remove(); };
      const d = document.createElement('button'); d.textContent = 'Remove'; d.onclick = async () => { await fetch(`https://twitch-subgallery-1.onrender.com/api/comments/${c.id}`, { method: 'DELETE', headers: { 'x-extension-jwt': auth.token } }); li.remove(); };
      li.appendChild(a); li.appendChild(d);
      $queue.appendChild(li);
    });
  }
  Twitch.ext.onAuthorized((_auth) => {
    auth = _auth;
    if (Twitch.ext.viewer?.role !== 'broadcaster') {
      document.body.innerHTML = '<div class="card">Broadcaster only.</div>';
      return;
    }
    $add.onclick = async () => {
      if (!$url.value) return alert('Image URL required');
      await fetchJSON('https://twitch-subgallery-1.onrender.com/api/photos', { url: $url.value, title: $title.value });
      $url.value=''; $title.value='';
      load();
    };
    $oauth.onclick = () => { window.open('https://twitch-subgallery-1.onrender.com/auth/login', '_blank'); };
    load();
  });
})();
