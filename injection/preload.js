const { ipcRenderer, contextBridge } = require("electron")
const preload = ipcRenderer.sendSync("DR_DISCORD_PRELOAD")
if (!preload) throw new Error("No preload found")
require(preload)

const dates = [Date.now()]
contextBridge.exposeInMainWorld("__DR__ELECTRON__BACKEND__", {
  require: (id) => require(id),
  app: true,
  init: function(eval) {
    async function start() {
      dates.push(Date.now())
      try {
        setTimeout(() => {
          try {
            fetch("https://raw.githubusercontent.com/Dr-Discord/Discord-Re-envisioned/main/build/index.js").then(e => e.text()).then((text) => {
              dates.push(Date.now())
              eval(`try {\n${text}\n}catch (e) {console.error(e)}\n//# sourceURL=Discord%20Re-envisioned`)
            })
          } catch (error) {
            console.error(error)
          }
        }, 1750)
      } catch (error) {
        console.error(error)
      }
    }
    if (window.document.readyState == "loading") window.document.addEventListener("DOMContentLoaded", start)
    else start()
  }
})