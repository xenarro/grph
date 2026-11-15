import { App } from "./app";
import { mountCanvas } from "./canvas";
import { mountConverter } from "./converter";
import { mountDocs } from "./docs";
import { mountInspector } from "./inspector";
import { mountPlayer } from "./player";
import { mountStructures } from "./structures";
import { mountToolbar } from "./toolbar";

const app = new App();

mountToolbar(document.getElementById("toolbar")!, app);
mountCanvas(document.getElementById("canvas") as HTMLCanvasElement, app);
mountInspector(document.getElementById("inspector")!, app);
mountPlayer(document.getElementById("player")!, app);
mountStructures(document.getElementById("structures")!, app);
mountConverter(document.getElementById("convert")!, app);
mountDocs(document.getElementById("docs")!, app);
