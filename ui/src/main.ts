import { App } from "./app";
import { mountToolbar } from "./toolbar";

const app = new App();

mountToolbar(document.getElementById("toolbar")!, app);
