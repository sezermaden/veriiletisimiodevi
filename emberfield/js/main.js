/* Boot: sets up the canvas, runs the frame loop and opens the title screen. */
(function () {
  var canvas = document.getElementById('screen');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var last = null;
  var start = performance.now();

  function frame(now) {
    if (last === null) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var t = (now - start) / 1000;

    EF.input.update(dt);
    if (EF.input.anyPressed()) EF.audio.unlock();
    EF.audio.update(dt);
    EF.ui.update(dt);
    EF.game.update(dt);
    EF.game.draw(ctx, t);

    requestAnimationFrame(frame);
  }

  EF.game.openTitle();
  requestAnimationFrame(frame);

  // Save when the tab is hidden so a closed tab does not lose progress.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && EF.game.state) EF.game.save();
  });
})();
