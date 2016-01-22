var assign = require('object-assign');
var path = require('path');

var electron = require('electron');
var ipc = electron.ipcMain;
var BrowserWindow = electron.BrowserWindow;

module.exports = createMainWindow;
function createMainWindow (url, argv, onReady) {
  argv = argv || {};

  // We can't just use show: false apparently.
  // Instead we show a zero-size window and
  // hide it once the detached DevTools are opened.
  // https://github.com/Jam3/devtool/issues/2
  var emptyWindow = { width: 0, height: 0, x: 0, y: 0 };
  var bounds = argv.show ? undefined : emptyWindow;
  var opts = assign({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      webSecurity: false // To avoid errors on Windows
    }
  }, bounds);
  var mainWindow = new BrowserWindow(opts);

  // Close after timeout
  if (typeof argv.timeout === 'number') {
    setTimeout(function () {
      mainWindow.close();
    }, argv.timeout);
  }

  // On first load, we trigger the app execution
  var webContents = mainWindow.webContents;

  // Send along stdin after first run
  ipc.on('first-run', sendStdin);

  if (argv.headless) {
    // Run without any debugger/DevTools
    run();
  } else {
    // Run with a DevTools window and debugger instance
    webContents.once('devtools-opened', function () {
      // Hide the main window frame so windows
      // users aren't seeing a tiny frame.
      if (!argv.show) mainWindow.hide();

      // Run app
      run();
    });

    // Launch debugger
    webContents.openDevTools({ detach: true });
  }

  return mainWindow;

  function run () {
    // Called before we load the app
    onReady();

    // Ensure we run whenever the page is refreshed,
    // but only after domready.
    webContents.on('dom-ready', function () {
      webContents.send('run-entry');
    });

    // Load index.html
    mainWindow.loadURL(url);
  }

  function sendStdin () {
    process.stdin
      .on('data', function (data) {
        mainWindow.send('stdin', data);
      })
      .on('end', function () {
        mainWindow.send('stdin', null);
      })
      .resume();
  }
}