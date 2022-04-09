const { join } = require("path")
const electron = require("electron")
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
    
    if (typeof transparent === "boolean" && transparent === true) {
      opts.transparent = true
      opts.backgroundColor = "#00000000"
    }
    const oldPreload = opts.webPreferences.preload
    opts.webPreferences.preload = join(__dirname, "preload.js")

    super(opts)

    electron.ipcMain.on("DR_DISCORD_PRELOAD", (event) => event.returnValue = oldPreload)
    
    this.webContents.on("did-finish-load", () => { this.webContents.executeJavaScript("window.__DR_ELECTRON_BACKEND__.init((c) => window.eval(c))") })
  }
}

// Enable DevTools on Stable.
try {
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
    }
  })
} catch (error) {}

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

const basePath = join(process.resourcesPath, "app.asar")
const pkg = require(join(basePath, "package.json"))
electron.app.setAppPath(basePath)
electron.app.name = pkg.name

const electronPath = require.resolve("electron")
const cached = require.cache[electronPath]
const propertyNames = Object.getOwnPropertyNames(cached.exports)
delete cached.exports

const newElectron = {}
for (const propertyName of propertyNames) {
  Object.defineProperty(newElectron, propertyName, {
    ...Object.getOwnPropertyDescriptor(electron, propertyName),
    get: () => propertyName === "BrowserWindow" ? BrowserWindow : electron[propertyName]
  })
}
cached.exports = newElectron

// Load other discord mods | 'app-old' and if the 'module.exports' is a function it runs it and with the arg to load discord
const appOld = join(process.resourcesPath, "app-old")
if (existsSync(appOld)) {
  const res = require(appOld)
  if (typeof res === "function") res(() => require(join(basePath, pkg.main)))
}
else require(join(basePath, pkg.main))