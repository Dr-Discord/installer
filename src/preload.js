const { ipcRenderer, webFrame, shell } = require("electron")
const { join } = require("path")
const fs = require("fs")

webFrame.setVisualZoomLevelLimits(1, 1)

const getPath = ipcRenderer.sendSync.bind(null, "getPath")
function quit() { ipcRenderer.sendSync("quit") }

const showMessageBox = ipcRenderer.invoke.bind(null, "showMessageBox")

Object.defineProperty(global, "require", { value: require })

window.onkeydown = function(evt) {
  if ((evt.code == "Minus" || evt.code == "Equal") && (evt.ctrlKey || evt.metaKey)) evt.preventDefault()
}

const DrDir = join(getPath("appData"), "Discord_Re-envisioned")

function makeDrDir() {
  if (fs.existsSync(DrDir)) fs.rmSync(DrDir, { recursive: true, force: true })
  fs.mkdirSync(DrDir)
  fs.copyFileSync(join(__dirname, "..", "injection", "index.js"), join(DrDir, "index.js"))
  fs.copyFileSync(join(__dirname, "..", "injection", "preload.js"), join(DrDir, "preload.js"))
}
if (!eval(localStorage.getItem("hasMadeDir") ?? "false")) {
  makeDrDir()
  localStorage.setItem("hasMadeDir", true)
}

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
    const dir = join(process.env.LOCALAPPDATA, `Discord${type === "stable" ? "" : `${type}`}`)
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
    if (!fs.existsSync(join(dir, version[0], "resources"))) return
    return join(dir, version[0], "resources")
  }
}

function domLoaded() {
  setTimeout(() => {
    document.getElementById("loader").classList.add("fade")
    setTimeout(() => document.getElementById("loader").remove(), 350)
  }, 1650)
  document.getElementById("github").onclick = () => shell.openExternal("https://github.com/Dr-Discord")
  document.getElementById("website").onclick = () => shell.openExternal("https://Dr-Discord.github.io")
  document.getElementById("close-app").onclick = () => quit()

  for (const ele of Array.from(document.querySelectorAll("#footer-buttons > div"))) {
    let tooltip = {}
    ele.onmouseout = () => {
      tooltip.remove()
    }
    ele.onmouseover = () => {
      tooltip = document.createElement("div")
      tooltip.id = "tooltip"
      tooltip.style.position = "fixed"
      const bounding = ele.getBoundingClientRect()
      tooltip.style.left = `${bounding.right + 5}px`
      tooltip.innerHTML = ele.getAttribute("tooltip")
      document.body.appendChild(tooltip)
      tooltip.style.top = `${(bounding.top - tooltip.clientHeight) + 24}px`
    }
  }
  
  fetch("https://discord.com/api/guilds/864267123694370836/widget.json").then(e => e.json()).then(json => {
    document.getElementById("discord").onclick = () => shell.openExternal(json.instant_invite)
  })
  const { version } = require(join(__dirname, "..", "package.json"))
  fetch("https://api.github.com/repos/Dr-Discord/installer/releases").then(e => e.json()).then((e) => {
    console.log("test");
    if (e[0].tag_name !== version) showMessageBox({
      message: "Your installer is out of date! Want to make",
      buttons: ["Install", "Cancel"],
      cancelId: 1
    }).then(({ response }) => {
      if (!response) return
      shell.openExternal(e[0].assets.find(r => r.name.startsWith(process.platform === "linux" ? "linux" : process.platform === "win32" ? "windows" : "mac")).browser_download_url)
    })
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
  const con = {
    _log: (emoji, log) => document.getElementById("installing-logs").append(Object.assign(document.createElement("div"), {
      className: "log",
      innerHTML: `<span>${emoji}:</span><span>${log}</span>`
    })),
    error: function(err) {
      this._log("❌", err)
    },
    warn: function(warn) {
      this._log("⚠️", warn)
    },
    success: function(log) {
      this._log("✔️", log)
    },
    log: function(log) {
      this._log("✔️", log)
    },
    space: function() {
      document.getElementById("installing-logs").append(Object.assign(document.createElement("div"), {
        className: "space-log"
      }))
    },
    clear: function() { document.getElementById("installing-logs").innerHTML = "" }
  }
  function showOtherPage(title) {
    this.value = !this.value
    document.getElementById("install").hidden = this.value
    document.getElementById("uninstall").hidden = this.value
    document.getElementById("select-discord").hidden = this.value
    document.getElementById("installing-discord").hidden = !this.value
    document.getElementById("installing-into").innerHTML = title
    con.clear()
  }
  Object.defineProperty(global, "showOtherPage", { value: showOtherPage })
  Object.defineProperty(global, "con", { value: con })
  
  for (const discord of Array.from(document.querySelectorAll(".discord-type"))) {
    let path = getDiscordResources(discord.id)
    const pathChild = discord.children[1].children[1].children[0]
    function setPath(path) {
      if (!path) path = "???"
      pathChild.innerHTML = path
      install[discord.id].path = path
    }
    setPath(path)
    discord.children[3].onclick = () => require("electron").ipcRenderer.invoke("selectDirectory", install[discord.id].path).then((path) => setPath(path))
    if (path) {
      discord.classList.remove("doesnt-exist")
      discord.onclick = (event) => {
        if (event.path.includes(discord.children[3])) return
        discord.classList.toggle("selected")
        install[discord.id].selected = !install[discord.id].selected
        const versions = Object.keys(install).map(e => install[e].selected && e).filter(e => e)
        updateInstallButton(document.getElementById("install"), versions)
        updateUnInstallButton(document.getElementById("uninstall"), versions)
      }
    }
  }
  function updateUnInstallButton(ele, versions) {
    if (versions?.[0]) {
      ele.classList.remove("disabled")
      ele.onclick = () => {
        showOtherPage(`Uninstalling from ${versions.join(", ")}`)
        let ind = 1
        _uninstall()
        function _uninstall() {
          if (ind > versions.length) return
          if (ind !== 1) con.space()
          const { path } = install[versions[ind - 1]]
          con.log(`Uninstalling from Discord ${versions[ind - 1]}`)
          const app = join(path, "app")
          if (fs.existsSync(app)) {
            con.log("Deleting 'app' folder...")
            try {
              fs.rmSync(app, { recursive: true, force: true })
            } catch (error) { return con.error(error.message) }
            con.success("Deleted 'app' folder!")
          }
          con.success("Uninstalled perfectly!")
          setTimeout(_uninstall, 500)
          ind++
        }
      }
    }
    else {
      ele.classList.add("disabled")
      ele.onclick = null
    }
  }
  function updateInstallButton(ele, versions) {
    if (versions?.[0]) {
      ele.classList.remove("disabled")
      ele.onclick = () => {
        showOtherPage(`Installing into ${versions.join(", ")}`)
        let ind = 1
        _install()
        function _install() {
          if (ind > versions.length) return
          if (ind !== 1) con.space()
          const { path } = install[versions[ind - 1]]
          con.log(`Installing into Discord ${versions[ind - 1]}`)
          const app = join(path, "app")
          if (fs.existsSync(app)) {
            con.warn("'app' folder exists! Deleting folder...")
            try {
              fs.rmSync(app, { recursive: true, force: true })
            } catch (error) { return con.error(error.message) }
            con.success("Deleted 'app' folder!")
          }
          try {
            con.log("Making 'app' folder...")
            fs.mkdirSync(app)
          } catch (error) { return con.error(error.message) }
          con.success("Made 'app' folder!")
          try {
            con.log("Making 'index.js' file...")
            fs.writeFileSync(join(app, "index.js"), `require("${DrDir.replace("\\", "/")}")`)
          } catch (error) { return con.error(error.message) }
          con.success("Made 'index.js' file!")
          try {
            con.log("Making 'package.json' file...")
            fs.writeFileSync(join(app, "package.json"), JSON.stringify({
              name: "discord", index: "./index.js"
            }))
          } catch (error) { return con.error(error.message) }
          con.success("Made 'package.json' file!")
          con.success("Installed perfectly!")
          makeDrDir()
          setTimeout(_install, 500)
          ind++
        }
      }
    }
    else {
      ele.classList.add("disabled")
      ele.onclick = null
    }
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", domLoaded)
else domLoaded()