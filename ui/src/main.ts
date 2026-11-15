import { App } from "./app";
import { mountCanvas } from "./canvas";
import { mountExplainer } from "./explainer";
import { mountInspector } from "./inspector";
import { mountPlayer } from "./player";
import { mountStructures } from "./structures";
import { mountToolbar } from "./toolbar";

const app = new App();

mountToolbar(document.getElementById("toolbar")!, app);
mountCanvas(document.getElementById("canvas") as HTMLCanvasElement, app);
mountInspector(document.getElementById("inspector")!, app);
mountPlayer(document.getElementById("player")!, app);
mountExplainer(document.getElementById("explainer")!, app);
mountStructures(document.getElementById("structure-views")!, app);
