import { App } from "./app";
import { mountCanvas } from "./canvas";
import { mountConverter } from "./converter";
import { mountDocs } from "./docs";
import { mountInspector } from "./inspector";
import { mountNav } from "./nav";
import { mountPlayer } from "./player";
import { mountStructures } from "./structures";
import { mountToolbar } from "./toolbar";

const app = new App();

const byId = (id: string) => document.getElementById(id)!;
mountNav(byId("tagline"), byId("site-nav"), byId("topbar-end"), app);
mountToolbar(byId("toolbar"), app);
mountCanvas(byId("canvas") as HTMLCanvasElement, app);
mountInspector(byId("inspector"), app);
mountPlayer(byId("player"), app);
mountStructures(byId("structures"), app);
mountConverter(byId("convert"), app);
mountDocs(byId("docs"), app);
