const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const { join } = require("path")
const { format } = require("url")

app.commandLine.appendSwitch("disable-pinch")

ipcMain.on("getPath", (event, id) => event.returnValue = app.getPath(id))
ipcMain.on("quit", (event) => event.returnValue = app.quit())

app.whenReady().then(() => {
  const page = format({
    protocol: "file",
    slashes: true,
    pathname: join(__dirname, "..", "page", "index.html") 
  })
  const win = new BrowserWindow({ 
    width: 500,
    height: 330,
    resizable: false,
    frame: false,
    thickFrame: false,
    title: "Discord Re-envisioned - Installer",
    backgroundColor: "#202225",
    show: false,
    webPreferences: {
      webSecurity: true,
      preload: join(__dirname, "preload.js"),
      allowRunningInsecureContent: false
    }
  })
  win.loadURL(page)
  win.once("ready-to-show", () => win.show())
  
  ipcMain.handle("showMessageBox", (event, options) => dialog.showMessageBox(win, options))

  ipcMain.handle("selectDirectory", (event, path) => new Promise(res => {
    dialog.showOpenDialog(win, {
      title: "Select The Resources Folder",
      properties: ["openDirectory"],
      defaultPath: path ?? app.getPath("userData")
    }).then((result) => {
      if (result.canceled) return
      res(result.filePaths[0])
    })
  }))
})