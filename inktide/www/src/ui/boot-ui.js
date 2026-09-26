// Public entry point of the UI layer (imported by main.js and by gameplay modes).
//
//   showTitle(app)                    boot → animated title over the live plaza
//   showMainMenu(app)                 main menu (left rail)
//   showStoryMap(app, focusStageId?)  story map (main menu underneath, so B goes back)
//   modeFor(app, stageId, opts?)      StoryMode / TurfMode when available, else SandboxMode
//   startStage(app, stageId, opts?)   load + start a stage with the right mode and the saved kit
//   quitToMenu(app, stageId?)         end the session → story map (story stages) or main menu
//   notify({title, text, kind})       unlock / reward toast that survives screen changes
//   confirmDialog(app, {title, text}) Promise<boolean>
//
// Also sets app.onPause → pushes the pause screen.
import { install, modeFor, startStage, showMainMenu, showStoryMap, quitToMenu, ensureMenuScene, safePointerLock } from './flow.js';
import { notify, confirmDialog } from './widgets.js';
import { TitleScreen } from './title.js';
import { PauseScreen } from './pause.js';

export { modeFor, startStage, showMainMenu, showStoryMap, quitToMenu, notify, confirmDialog, safePointerLock, PauseScreen };

export async function showTitle(app) {
  install(app);
  ensureMenuScene(app);
  app.ui.clear();
  return app.ui.push(new TitleScreen(app));
}
