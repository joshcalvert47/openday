// Small, safe bridge between the page and the desktop app (main.cjs).
// The page uses it from frontend/src/desktop.ts.

const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') {
  // The setup page (setup.html).
  contextBridge.exposeInMainWorld('openDaySetup', {
    connect: (url) => ipcRenderer.invoke('openday:connect', String(url)),
  });
} else {
  // The OpenDay web app from the server.
  contextBridge.exposeInMainWorld('openDayDesktop', {
    notify: (n) =>
      ipcRenderer.send('openday:notify', {
        title: String(n?.title ?? ''),
        body: String(n?.body ?? ''),
        tag: String(n?.tag ?? ''),
        data: n?.data,
      }),
    showWindow: () => ipcRenderer.send('openday:show-window'),
    onSnooze: (fn) => {
      const listener = (_e, data) => fn(data);
      ipcRenderer.on('openday:snooze', listener);
      return () => ipcRenderer.removeListener('openday:snooze', listener);
    },
  });
}
