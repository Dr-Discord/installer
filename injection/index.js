const { join } = require("path")
const electron = require("electron")
const Module = require("module")
const { readFileSync, existsSync } = require("fs")

electron.app.commandLine.appendSwitch("no-force-async-hooks-checks")

class BrowserWindow extends electron.BrowserWindow {
  constructor(opts) {
    if (opts.title != "Discord") return super(opts)
    opts.transparent = true
    opts.backgroundColor = "#00000000"
    const oldPreload = opts.webPreferences.preload

    opts.webPreferences.preload = join(__dirname, "preload.js")

    electron.ipcMain.on("DR_DISCORD_PRELOAD", (event) => event.returnValue = oldPreload)

    return super(opts)
  }
}

// Enable DevTools on Stable.
let fakeAppSettings;
Object.defineProperty(global, "appSettings", {
  configurable: true,
  get() {
    return fakeAppSettings;
  },
  set(value) {
    if (!value.hasOwnProperty("settings")) value.settings = {};
    value.settings.DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING = true;
    fakeAppSettings = value;
  },
})

electron.app.once("ready", () => {
  electron.session.defaultSession.webRequest.onHeadersReceived(function({ responseHeaders }, callback) {
    delete responseHeaders["content-security-policy-report-only"]
    delete responseHeaders["content-security-policy"]
    
    callback({ 
      cancel: false, 
      responseHeaders
    })
  })
  try {
    const { default: installExtension, REACT_DEVELOPER_TOOLS } = require("electron-devtools-installer")
    installExtension(REACT_DEVELOPER_TOOLS)
  } catch (error) {}
})

const Electron = new Proxy(electron, { get: (target, prop) => prop === "BrowserWindow" ? BrowserWindow : target[prop] })

const electronPath = require.resolve("electron")
delete require.cache[electronPath].exports
require.cache[electronPath].exports = Electron

function LoadDiscord() {
  const basePath = join(process.resourcesPath, "app.asar")
  const pkg = require(join(basePath, "package.json"))
  electron.app.setAppPath(basePath)
  electron.app.name = pkg.name
  Module._load(join(basePath, pkg.main), null, true)
}
const appOld = join(process.resourcesPath, "app-old")
if (existsSync(appOld)) require(appOld)
else LoadDiscord()
