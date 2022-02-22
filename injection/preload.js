const { ipcRenderer, webFrame } = require("electron")
const preload = ipcRenderer.sendSync("DR_DISCORD_PRELOAD")

if (!preload) return
require(preload)

{
  ((window) => {
    // Expose require
    window.__DR__BACKEND__ = {
      require: (module) => require(module), app: true
    }
    function start() {
      fetch("https://raw.githubusercontent.com/Dr-Discord/Discord-Re-envisioned/main/build/index.js").then(e => e.text()).then((text) => setTimeout(() => window.eval(text), 1500))
    }
    if (window.document.readyState == "loading") window.document.addEventListener("DOMContentLoaded", start)
    else start()
  })(webFrame.top.context)
}
