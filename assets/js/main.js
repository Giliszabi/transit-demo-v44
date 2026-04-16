import { FUVAROK } from "./data/fuvarok.js";
import { SOFOROK } from "./data/soforok.js";
import { VONTATOK } from "./data/vontatok.js";
import { POTKOCSIK } from "./data/potkocsik.js";
import { loadGeneratedPlanningData } from "./data/generated-loader.js";
import { renderTimeline } from "./ui/timeline.js";

window.addEventListener("DOMContentLoaded", async () => {
  await loadGeneratedPlanningData();
  console.log("TransIT v4.4 UI ready.");

  // Példa: sofőr timeline render
  renderTimeline("timeline-container", []);
});
