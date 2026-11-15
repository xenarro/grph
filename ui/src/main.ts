import { App } from "./app";
import { mountCanvas } from "./canvas";
import { mountInspector } from "./inspector";
import { mountStructures } from "./structures";
import { mountToolbar } from "./toolbar";

const app = new App();

mountToolbar(document.getElementById("toolbar")!, app);
mountCanvas(document.getElementById("canvas") as unknown as SVGSVGElement, app);
mountInspector(document.getElementById("inspector")!, app);
mountStructures(document.getElementById("structures")!, app);
