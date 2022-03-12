const { ipcRenderer, contextBridge } = require("electron")
const preload = ipcRenderer.sendSync("DR_DISCORD_PRELOAD")
if (!preload) throw new Error("No preload found")
require(preload)

const transparent = ipcRenderer.sendSync("DR_TRANSPARENT")

contextBridge.exposeInMainWorld("__DR__ELECTRON__BACKEND__", {
  app: true,
  init: async function(eval) {
    const text = await fetch("https://raw.githubusercontent.com/Dr-Discord/Discord-Re-envisioned/main/build/index.js").then(e => e.text())
    eval(`try {\n${text}\n}catch (e) {console.error(e)}\n//# sourceURL=Discord%20Re-envisioned`)
  },
  transparent,
  toggleTransparency: async function() {
    await ipcRenderer.invoke("DR_TOGGLE_TRANSPARENCY")
  }
})