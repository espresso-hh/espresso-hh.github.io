(function () {
  var cycleDuration = 6000;
  var phase = Date.now() % cycleDuration;
  document.documentElement.style.setProperty(
    "--background-animation-delay",
    "-" + phase / 1000 + "s"
  );
})();
