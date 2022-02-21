const { ipcRenderer, contextBridge, webFrame, shell } = require("electron")
const { join } = require("path")
const fs = require("fs")

webFrame.setVisualZoomLevelLimits(1, 1)

const getPath = ipcRenderer.sendSync.bind(null, "getPath")
const showMessageBox = ipcRenderer.invoke.bind(null, "showMessageBox")
function quit() { ipcRenderer.sendSync("quit") }

function makeWindowItem(key, value) {
  contextBridge.exposeInMainWorld(key, value)
  Object.defineProperty(global, key, { value })
}

Object.defineProperty(global, "require", { value: require })
makeWindowItem("getPath", getPath)

window.onkeydown = function(evt) {
  if ((evt.code == "Minus" || evt.code == "Equal") && (evt.ctrlKey || evt.metaKey)) evt.preventDefault()
}

const DrDir = join(getPath("appData"), "Discord_Re-envisioned")

function makeDrDir() {
  if (!fs.existsSync(DrDir)) fs.mkdirSync(DrDir)
  fs.copyFileSync(join(__dirname, "dr", "index.js"), join(DrDir, "index.js"))
  fs.copyFileSync(join(__dirname, "dr", "preload.js"), join(DrDir, "preload.js"))
}
makeDrDir()

function getDiscordResources(type) {
  if (process.platform === "darwin") {
    const dir = `/Applications/Discord${type === "stable" ? "" : ` ${type}`}.app/Contents/Resources`
    if (!fs.existsSync(dir)) return
    return dir
  }
  if (process.platform === "linux") {
    const dir = `/usr/share/discord${type === "stable" ? "" : ` ${type}`}/Resources`
    if (!fs.existsSync(dir)) return
    return dir
  }
  if (process.platform === "win32") {
    let version = ["app-0", 0]
    const dir = join(process.env.LOCALAPPDATA, `Discord${type === "stable" ? "" : ` ${type}`}`)
    if (!fs.existsSync(dir)) return
    let versionFolders = fs.readdirSync(dir).filter(e => e.startsWith("app-"))
    for (let versionFolder of versionFolders) {
      let num = Number(versionFolder.replace("app-", "").replaceAll(".", ""))
      if (num > version[1]) {
        version = [
          versionFolder, num
        ]
      }
    }
    return join(dir, version[0], "resources")
  }
}

function domLoaded() {
  document.getElementById("github").onclick = () => shell.openExternal("https://github.com/Dr-Discord")
  document.getElementById("website").onclick = () => shell.openExternal("https://Dr-Discord.github.io")
  document.getElementById("close-app").onclick = () => quit()
  document.getElementById("close").onclick = () => quit()

  function showClose() {
    document.getElementById("close").hidden = false
    document.getElementById("install").hidden = true
    document.getElementById("uninstall").hidden = true
  }

  fetch("https://discord.com/api/guilds/864267123694370836/widget.json").then(e => e.json()).then(json => {
    document.getElementById("discord").onclick = () => shell.openExternal(json.instant_invite)
  })
  const install = {
    stable: {
      path: null,
      selected: false
    },
    ptb: {
      path: null,
      selected: false
    },
    canary: {
      path: null,
      selected: false
    }
  }
  for (const discord of Array.from(document.querySelectorAll(".discord-type"))) {
    let path = getDiscordResources(discord.id)
    const pathChild = discord.children[1].children[1].children[0]
    pathChild.innerHTML = path
    install[discord.id].path = path
    discord.children[3].onclick = () => require("electron").ipcRenderer.invoke("selectDirectory", install[discord.id].path).then((path) => {
      pathChild.innerHTML = path
      install[discord.id].path = path
    })
    if (path) {
      discord.classList.remove("doesnt-exist")
      discord.onclick = () => {
        discord.classList.toggle("selected")
        install[discord.id].selected = !install[discord.id].selected
        updateInstallButton()
        updateUnInstallButton()
      }
    }
  }
  function updateUnInstallButton() {
    const uninstallButton = document.getElementById("uninstall")
    if (!Object.values(install).find(e => e.selected === true)) {
      uninstallButton.onclick = null
      return uninstallButton.classList.add("disabled")
    }
    uninstallButton.classList.remove("disabled")
    uninstallButton.onclick = () => {
      uninstallButton.onclick = null
      showClose()
      document.getElementById("select-discord").hidden = true
      document.getElementById("installing-discord").hidden = false
      const uninstallingFrom = Object.keys(install).map(e => install[e].selected && e).filter(e => e)
      document.getElementById("installing-into").innerHTML = `Uninstalling from ${uninstallingFrom.join(", ")}`
      function addlog(log) {
        document.getElementById("installing-logs").append(Object.assign(document.createElement("div"), {
          class: "log",
          innerHTML: log
        }))
      }
      for (const vers of uninstallingFrom) {
        const { path } = install[vers]
        if (fs.existsSync(join(path, "app-old"))) {
          addlog("'app-old' folder exists! prompting user.")
          showMessageBox({
            title: "You have a 'app-old' folder",
            message: "You have a 'app-old' folder want to rename that to 'app'?",
            type: "question",
            buttons: [
              "Rename",
              "Delete"
            ],
            cancelId: 1
          }).then(({ response }) => {
            addlog("Deleting App Folder...")
            fs.rmSync(join(path, "app"), { recursive: true, force: true })
            if (!response) {
              addlog("Renaming 'app-old' Folder...")
              fs.renameSync(join(path, "app-old"), join(path, "app"))
            }
          })
        }
        else {
          addlog("Deleting App Folder...")
          fs.rmSync(join(path, "app"), { recursive: true, force: true })
        }
        addlog("Uninstalled!")
        showClose()
      }
    }
  }
  function updateInstallButton() {
    const installButton = document.getElementById("install")
    if (!Object.values(install).find(e => e.selected === true)) {
      installButton.onclick = null
      return installButton.classList.add("disabled")
    }
    installButton.classList.remove("disabled")
    installButton.onclick = () => {
      installButton.onclick = null
      showClose()
      document.getElementById("select-discord").hidden = true
      document.getElementById("installing-discord").hidden = false
      const installingInto = Object.keys(install).map(e => install[e].selected && e).filter(e => e)
      document.getElementById("installing-into").innerHTML = `installing into ${installingInto.join(", ")}`
      function addlog(log) {
        document.getElementById("installing-logs").append(Object.assign(document.createElement("div"), {
          class: "log",
          innerHTML: log
        }))
      }
      for (const vers of installingInto) {
        const { path } = install[vers]
        function makeTheStuff() {
          addlog("Making app folder...")
          fs.mkdirSync(join(path, "app"))
          addlog("Making app folder contents...")
          fs.writeFileSync(join(path, "app", "index.js"), `require("${DrDir.replaceAll("\\", "/")}")`)
          fs.writeFileSync(join(path, "app", "package.json"), JSON.stringify({ name:"discord", main:"index.js" }))
          addlog("Installed!")
        }
        if (fs.existsSync(join(path, "app"))) {
          addlog("'app' folder exists! prompting user.")
          showMessageBox({
            title: "You already have a app folder",
            message: "You have a 'app' folder already do you want to rename it to 'app-old'? Also your client mod will be loaded too.",
            type: "question",
            buttons: [
              "Rename",
              "Delete"
            ],
            cancelId: 1
          }).then(({ response }) => {
            addlog(response ? "Deleting App Folder..." : "Renaming App Folder...")
            if (!response) fs.renameSync(join(path, "app"), join(path, "app-old"))
            else fs.rmSync(join(path, "app"), { recursive: true, force: true })
            makeTheStuff()
          })
        }
        else makeTheStuff()
      }
    }
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", domLoaded)
else domLoaded()