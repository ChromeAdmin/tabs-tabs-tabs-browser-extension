// Background script
const IDLE_URL = `tabs.ChromeAdmin.com/idle`.toLowerCase();
const IDLE_URL_2 = `chromeadmin.github.io/tabs-tabs-tabs-browser-extension/idle`.toLowerCase();
const IDLE_URL_HTTPS = `https://${IDLE_URL_2}`.toLowerCase();
const IS_DEBUG = false;
const PING_DELAY_MS = IS_DEBUG ? 10 * 1000 : 1 * 60 * 1000;
const IDLE_TIME_AFTER_MS = IS_DEBUG ? 60 * 1000 : 20 * 60 * 1000;
const tabActivityMap = new Map();

function calcStat(tab) {
  if (isTabIdleForceDisabled(tab)) return 'disabled.system';

  const tabBusy = isTabBusy(tab);
  if (tabBusy.includes('pinned')) { return `disabled.${tabBusy}` }

  const tabActivity = getActivity(tab);
  if (tabActivity?.lastTypingReason) return 'disabled.typing';

  if (tabBusy) { return `temp.${tabBusy}` }

  const nowMs = Date.now();
  const timeIdleMs = nowMs - tabActivity.lastActivityMs;
  if (timeIdleMs < IDLE_TIME_AFTER_MS) { return 'pending'; }
  else { return 'idle' }
}

function init() {
  log(`tabs tabs tabs loaded.`);

  chrome.runtime.onMessage.addListener((request, sender, callback) => {
    log(`onMessage:\n${JSON.stringify(request, null, 2)}\n${JSON.stringify(sender, null, 2)}`);

    switch (request.activeElementTag) {
      case 'FORM':
      case 'SELECT':
      case 'TEXTAREA':
      case 'INPUT':
        reportActivity(sender.tab, 'typingElement');
        return;
    }

    if (request.init) {
      if (!request.isIframe) {
        clearActivity(sender.tab);
      }
      reportActivity(sender.tab, 'init');
      return;
    }

    if (request.isEditable) {
      reportActivity(sender.tab, 'typingContentIsEditable');
      return;
    }

    if (request.keyDown) {
      reportActivity(sender.tab, 'typingKeyDown');
      return;
    }

    if (request.visibilityChanged) {
      reportActivity(sender.tab, 'tabVisibilityChanged');
      return;
    }

    if (sender.tab.active) {
      reportActivity(sender.tab, 'tabActive');
      return;
    }

    if (sender.tab.audible) {
      reportActivity(sender.tab, 'tabAudible');
      return;
    }

    if (sender.tab.pinned) {
      reportActivity(sender.tab, 'tabPinned');
      return;
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // log(`onUpdated:\n${JSON.stringify(changeInfo, null, 2)}\n${JSON.stringify(tab, null, 2)}`);
    if (isTabIdleForceDisabled(tab)) {
      reportActivity(tab, 'force');
    } else {
      // This is to inject into the Activated tab
      injectAndCheckActivity(tab.id);
    }
  });

  chrome.action.onClicked.addListener((tab) => {
    // No tabs or host permissions needed!
    reportActivity(tab, `fake_ActionClicked`);
    let tA = getActivity(tab);
    log(`bA: ${JSON.stringify(tab, null, 2)}`);
    log(`bA: ${JSON.stringify(getActivity(tab), null, 2)}`);
    log(`bA: ${JSON.stringify(calcStat(tab), null, 2)}`);
    applyTabIconColor(tab);
    makeTabIdle(tab.id, getActivity(tab));
  });

  scanAllTabs();
}

function setIcon(color, tab) {
  chrome.action?.setIcon({
    tabId: tab.id,
    path: `/icons/${color}-icon-128.png`,
  });
}

function clearActivity(tab) {
  return tabActivityMap.delete(tab.id);
}

function getActivity(tab) {
  return tabActivityMap.get(tab.id);
}

function getActivityFromTabId(tabId) {
  return tabActivityMap.get(tabId);
}

function reportActivity(tab, reason) {
  // log(`reportActivity() ${tab.id} ${reason} ${tab.url}`);
  // log(`${JSON.stringify(tab, null, 2)}`);
  const previouslyKnownActivity = getActivity(tab);
  // log(`previouslyKnownActivity:\n${JSON.stringify(previouslyKnownActivity, null, 2)}`);
  // If there was typing on this exact url
  // if (previouslyKnownActivity?.tabUrl === tab.url && !reason.startsWith('typing') && previouslyKnownActivity?.lastActivityReason.startsWith('typing')) {
  //   reportActivity(tab, 'typing infered');
  //   return;
  // }

  const nowMs = Date.now();
  let typingMs, typingReason;
  if (reason.startsWith('typing')) {
    typingMs = nowMs;
    typingReason = reason;
  } else {
    typingMs = previouslyKnownActivity?.lastTypingMs;
    typingReason = previouslyKnownActivity?.lastTypingReason;
    
    if (tab.url !== previouslyKnownActivity?.tabUrl) {
      log(`old:${previouslyKnownActivity?.tabUrl}\nnew:${tab.url}`)
      typingMs = undefined;
      typingReason = undefined;
    }
  }

  tabActivityMap.set(tab.id, {
    lastActivityReason: reason,
    lastActivityMs: nowMs,
    lastTypingReason: typingReason,
    lastTypingMs: typingMs,
    tabUrl: tab.url,
    tabFavIconUrl: tab.favIconUrl,
    tabTitle: tab.title,
  });
  log(`reportActivity:${tab.active}\n${JSON.stringify(tabActivityMap.get(tab.id), null, 2)}`);

  if (tab.active) {
    setTimeout(() => {
      applyTabIconColor(tab);
    }, 333);
  }
}

function applyTabIconColor(tab) {
  if (!tab.active) { return; }

  const stat = calcStat(tab);
  log(`applyTabIconColor: ${stat} ${JSON.stringify(tab, null, 2)}`);
  if (stat.includes('disabled')) { setIcon('gray', tab); }
  if (stat.includes('pending')) { setIcon('green', tab); }
  if (stat.includes('temp')) { setIcon('green', tab); }
  if (stat.includes('idle')) { setIcon('red', tab); }

  // chrome.browserAction.setPopup({
  //   tabId: tab.id,
  //   popup: idleUrl.href,
  // });
}

function isTabIdleForceDisabled(tab) {
  if (tab.url?.startsWith('chrome-extension:')) { return true; }
  if (tab.pendingUrl?.startsWith('chrome-extension:')) { return true; }
  if (tab.url?.startsWith('chrome:')) { return true; }
  if (tab.pendingUrl?.startsWith('chrome:')) { return true; }
  if (tab.url?.includes(IDLE_URL)) { return true; }
  if (tab.url?.includes(IDLE_URL_2)) { return true; }
  if (tab.pendingUrl?.includes(IDLE_URL)) { return true; }
  if (tab.pendingUrl?.includes(IDLE_URL_2)) { return true; }

  return false;
}

function isTabBusy(tab) {
  if (tab?.active) { return 'active'; }
  if (tab?.audible) { return 'audible'; }
  if (tab?.pinned) { return 'pinned'; }

  return '';
}

async function injectAndCheckActivity(tabId) {
  let results;
  try {
    console.log(`injectAndCheckActivity`);
    results = await chrome.scripting.executeScript({
      target: {tabId: tabId, allFrames: true},
      files: ['src/execute.js']
    });
  } catch(e) {
    console.error(e);
  } finally {
    console.log(results);
  }
}

async function scanAllTabs() {
  const allTabsMap = await getAllTabsMap();
  // console.log(allTabs);

  allTabsMap.forEach(tab => {
    if (isTabIdleForceDisabled(tab)) {
      reportActivity(tab, 'force');
    } else if (!isTabBusy(tab)) {
      injectAndCheckActivity(tab.id);
    } else {
      injectAndCheckActivity(tab.id);
      reportActivity(tab, 'generic');
    }
  });


  // log(`Scan trigger... ${tabActivityMap.size}`);
  // log(JSON.stringify(tabActivityMap, null, 2));
  tabActivityMap.forEach((tabActivity, tabId) => {
    if (!allTabsMap.has(tabId)) {
      tabActivityMap.delete(tabId);
      return;
    }

    const stat = calcStat(allTabsMap.get(tabId));

    if (!stat.includes('idle')) { return; }

    log(`Making Idle ${tabId}: ${JSON.stringify(tabActivity, null, 2)}`);
    makeTabIdle(tabId, tabActivity);
  });


  setTimeout(scanAllTabs, PING_DELAY_MS);
}

async function getAllTabsMap() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      const allTabsMap = new Map();
      tabs.forEach((tab) => {
        allTabsMap.set(tab.id, tab);
      });
      resolve(allTabsMap);
    });
  });
}

function makeTabIdle(tabId, tabActivity) {
  const idleUrl = new URL(IDLE_URL_HTTPS); //new URL(chrome.runtime.getURL('src/web/idle.html'));
  idleUrl.searchParams.append('title', `${tabActivity.tabTitle}`.substring(0, 100));
  idleUrl.searchParams.append('url', tabActivity.tabUrl);
  idleUrl.searchParams.append('favIcon', tabActivity.tabFavIconUrl);
  idleUrl.searchParams.append('date', `${Date.now()}`);
  chrome.tabs.update(Number(tabId), { url: idleUrl.href });
}

function log(text) {
  return;
  // if (!text.startsWith('bA')) { return; }
  // if (!text.includes('youtube')) { return; }
  if (!text.includes(`chrome.google.com`)) { return; }
  console.log(`TTT.b: ${text}`);
}


init();


const sampleTab = {
  active: false,
  audible: false,
  autoDiscardable: true,
  discarded: false,
  groupId: -1,
  height: 818,
  highlighted: false,
  id: 26,
  incognito: false,
  index: 1,
  mutedInfo: { muted: false },
  pinned: false,
  selected: false,
  status: "complete",
  width: 1205,
  windowId: 11,
};

const sampleSender = {
  "id": "cogaflbfggenkdbchciicibjhbihpfpl",
  "url": "https://www.youtube.com/watch?reload=9&v=sfv1QaRzJg8",
  "origin": "https://www.youtube.com",
  "frameId": 0,
  "tab": {
    "active": false,
    "audible": false,
    "autoDiscardable": true,
    "discarded": false,
    "favIconUrl": "https://www.youtube.com/s/desktop/e84fb691/img/favicon_32.png",
    "groupId": -1,
    "height": 818,
    "highlighted": false,
    "id": 26,
    "incognito": false,
    "index": 1,
    "mutedInfo": {
      "muted": false
    },
    "pinned": false,
    "selected": false,
    "status": "complete",
    "title": "(27) I Ordered Pizza And Tipped The House - YouTube",
    "url": "https://www.youtube.com/watch?v=sfv1QaRzJg8",
    "width": 1205,
    "windowId": 11
  }
};
