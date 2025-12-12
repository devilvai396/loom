import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk";
import { mountLoom } from "./Loom-ui.js";

window.addEventListener("load", async () => {
  const $root = document.getElementById("app");
  const $status = document.getElementById("status");

  const env = { isMini: false, label: "Web" };

  try {
    env.isMini = await sdk.isInMiniApp();
    env.label = env.isMini ? "Mini App" : "Web";
  } catch (e) {
    env.isMini = false;
    env.label = "Web";
  }

  $status.textContent = env.isMini
    ? "Running inside Farcaster / Base Mini App"
    : "Running on the open web (Mini App-ready)";

  mountLoom($root, env);

  // ALWAYS call ready()
  try {
    await sdk.actions.ready();
  } catch (e) {
    // no-op on web preview
  }
});
