window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);

  const origTitle = urlParams.get('title');
  console.log(origTitle);
  document.title = `🗿${origTitle}`;

  const origUrl = urlParams.get('url');
  console.log(origUrl);
  const linkEl = document.createElement('a');
  linkEl.href = origUrl;
  linkEl.innerText = `${origTitle}\n\n${origUrl}`;
  document.body.append(linkEl);

  const origFavIconUrl = urlParams.get('favIcon');
  console.log(origFavIconUrl);
  const faviconLinkEl = document.createElement('link');
  faviconLinkEl.type = 'image/x-icon';
  faviconLinkEl.rel = 'shortcut icon';
  faviconLinkEl.href = origFavIconUrl;
  document.head.appendChild(faviconLinkEl);
};
