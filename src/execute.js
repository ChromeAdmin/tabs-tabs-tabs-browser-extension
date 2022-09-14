var init = () => {
  log('init...');

  injectOntoDocument(document);

  reportActivity({ init: true });

  return Date.now();
}

var hook = (doc) => {
  log('init...');

  doc.addEventListener('keydown', (event) => {
    log(`keydown: ${event.key}`);
    reportActivity({ keyDown: event.key });
  }, true);

  doc.addEventListener('visibilitychange', (event) => {
    log(`visibilitychange`);
    reportActivity({
      visibilityChanged: true,
      isVisible: !doc.hidden,
    });
  }, true);

}

var injectOntoDocument = (doc) => {
  if (!doc) { return; }

  if (!doc.didInjectTabsTabsTabs) {
    hook(doc);
    doc.didInjectTabsTabsTabs = true;
  }

  let contentDocument;
  for (let i = 0; i < frames.length; i++) {
    try {
      contentDocument = iframes[i].document;
    } catch (e) {
      continue; // Same-origin policy violation?
    }
    if (contentDocument && !contentDocument.didInjectTabsTabsTabs) {
      // Add poller to the new iframe
      injectOntoDocument(iframes[i].contentDocument);
    }
  }
}

var reportActivity = (json) => {
  try {
    chrome.runtime.sendMessage({
      activeElementTag: document?.activeElement?.tagName?.toUpperCase(),
      isEditable: document?.activeElement?.getAttribute('contenteditable'),
      isIframe: isIframe(),
      ...json
    });
  } catch (e) {
    // Ignoring a TypeError: Cannot read property 'sendMessage' of undefined
    // that happens when the extension updates and Error: Extension context invalidated.
    // console.error(e);
  }
}

var isIframe = () => {
  try {
      return window.self !== window.top;
  } catch (e) {
      return true;
  }
}

var log = (text) => {
  console.log(`TTT.e: ${text}`);
}

if (!didInit) {
  try { var didInit = init(); }
  catch (e) { console.error(e); }
} else {
  log(`after: ${didInit}`);
  injectOntoDocument(document);
  reportActivity({ ping: true });
}
