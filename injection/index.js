const { join } = require("path")
const electron = require("electron")
const Module = require("module")
const { existsSync, writeFileSync } = require("fs")

electron.app.commandLine.appendSwitch("no-force-async-hooks-checks")

if (!existsSync(join(__dirname, "settings.json"))) writeFileSync(join(__dirname, "settings.json"), "{\"transparent\":false}")
const { transparent } = require(join(__dirname, "settings.json"))

electron.ipcMain.handle("DR_TOGGLE_TRANSPARENCY", (event) => {
  writeFileSync(join(__dirname, "settings.json"), `{"transparent":${!transparent}}`)
  electron.app.relaunch()
  electron.app.quit()
})
electron.ipcMain.on("DR_TRANSPARENT", (event) => event.returnValue = transparent)

class BrowserWindow extends electron.BrowserWindow {
  constructor(opts) {
    if (opts.title != "Discord") return super(opts)
    if (typeof transparency === "boolean" && transparency === true) {
      opts.transparent = true
      opts.backgroundColor = "#00000000"
    }
    const oldPreload = opts.webPreferences.preload

    opts.webPreferences.preload = join(__dirname, "preload.js")

    electron.ipcMain.on("DR_DISCORD_PRELOAD", (event) => event.returnValue = oldPreload)

    const win = new electron.BrowserWindow(opts)
    win.webContents.on("did-finish-load", () => {
      win.webContents.executeJavaScript("window.__DR__ELECTRON__BACKEND__.init((code) => window.eval(code))")
    })
    
    return win 
  }
}

// Enable DevTools on Stable.
try {
  let fakeAppSettings
  Object.defineProperty(global, "appSettings", {
    configurable: true,
    get() { return fakeAppSettings },
    set(value) {
      if (!value.hasOwnProperty("settings")) value.settings = {}
      value.settings.DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING = true
      fakeAppSettings = value
    }
  })
} catch (error) {}

electron.app.once("ready", () => {
  electron.session.defaultSession.webRequest.onHeadersReceived(function({ responseHeaders }, callback) {
    for (const responseHeader in responseHeaders) 
      if (responseHeader.startsWith("content-security-policy"))
        delete responseHeaders[responseHeader]
    
    callback({ cancel: false, responseHeaders })
  })
})

Object.assign(BrowserWindow, electron.BrowserWindow)
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
// Load other discord mods | 'app-old' and if the 'module.exports' is a function it runs it and with the arg to load discord
const appOld = join(process.resourcesPath, "app-old")
if (existsSync(appOld)) {
  const res = require(appOld)
  if (typeof res === "function") res(() => LoadDiscord())
}
else LoadDiscord()
