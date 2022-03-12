const { ipcRenderer, contextBridge } = require("electron")
const preload = ipcRenderer.sendSync("DR_DISCORD_PRELOAD")
if (!preload) throw new Error("No preload found")
require(preload)

const text = fetch("https://raw.githubusercontent.com/Dr-Discord/Discord-Re-envisioned/main/build/index.js").then(e => e.text())

contextBridge.exposeInMainWorld("__DR__ELECTRON__BACKEND__", {
  require: (id) => require(id),
  app: true,
  init: async function(eval) {
    eval(`try {\n${await text}\n}catch (e) {console.error(e)}\n//# sourceURL=Discord%20Re-envisioned`)
  }
})