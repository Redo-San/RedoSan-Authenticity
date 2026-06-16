(function () {
  // ── Compute audio path relative to current page ──
  function audioSrc() {
    var depth = 0;
    var p = window.location.pathname;
    var parts = p.replace(/\/+$/, "").split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") {
        depth = parts.length - i - 1;
        break;
      }
    }
    if (depth === 0) depth = 1;
    var prefix = "";
    for (var j = 0; j < depth; j++) prefix += "../";
    return prefix + "RedoSan_Music.mp3";
  }

  // ── Inject HTML once ──
  var _injected = false;
  function inject() {
    if (_injected) return;
    _injected = true;
    var div = document.createElement("div");
    div.innerHTML =
      '<audio id="bg-music" src="' +
      audioSrc() +
      '" loop></audio>' +
      '<button id="music-btn" class="music-btn" aria-label="Toggle Music">&#x1F3B5;</button>' +
      '<div id="music-credit" class="music-credit" role="contentinfo" aria-label="Music credit">RedoSan</div>';
    while (div.firstChild) document.body.appendChild(div.firstChild);
  }

  // ── Music state ──
  var _musicStarted = false;

  window.toggleMusic = function () {
    var audio = document.getElementById("bg-music");
    var btn = document.getElementById("music-btn");
    var credit = document.getElementById("music-credit");
    if (!audio || !btn) return;
    if (audio.paused) {
      try {
        sessionStorage.setItem("musicInteracted", "true");
      } catch (e) {}
      _musicStarted = true;
      audio
        .play()
        .then(function () {
          btn.textContent = "\uD83D\uDD0A";
          btn.classList.add("playing");
          if (credit) credit.classList.add("show");
        })
        .catch(function () {});
    } else {
      audio.pause();
      btn.textContent = "\uD83C\uDFB5";
      btn.classList.remove("playing");
      if (credit) credit.classList.remove("show");
    }
  };

  function saveState() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    try {
      sessionStorage.setItem(
        "musicState",
        JSON.stringify({
          isPlaying: !audio.paused,
          currentTime: audio.currentTime,
        }),
      );
    } catch (e) {}
  }

  function restoreState() {
    var audio = document.getElementById("bg-music");
    var credit = document.getElementById("music-credit");
    if (!audio) return;
    if (credit) credit.classList.remove("show");
    try {
      var saved = sessionStorage.getItem("musicState");
      if (!saved) return;
      var state = JSON.parse(saved);
      if (state.currentTime) audio.currentTime = state.currentTime;
      if (sessionStorage.getItem("musicInteracted") === "true") {
        _musicStarted = true;
        document.removeEventListener("click", firstClick);
      }
      if (state.isPlaying) {
        _musicStarted = true;
        audio
          .play()
          .then(function () {
            var btn = document.getElementById("music-btn");
            var c = document.getElementById("music-credit");
            if (btn) {
              btn.textContent = "\uD83D\uDD0A";
              btn.classList.add("playing");
            }
            if (c) c.classList.add("show");
          })
          .catch(function () {});
      }
    } catch (e) {}
  }

  function firstClick() {
    if (_musicStarted) return;
    _musicStarted = true;
    var audio = document.getElementById("bg-music");
    var btn = document.getElementById("music-btn");
    var credit = document.getElementById("music-credit");
    if (audio && audio.paused) {
      audio
        .play()
        .then(function () {
          try {
            sessionStorage.setItem("musicInteracted", "true");
          } catch (e) {}
          if (btn) {
            btn.textContent = "\uD83D\uDD0A";
            btn.classList.add("playing");
          }
          if (credit) credit.classList.add("show");
        })
        .catch(function () {});
    }
    document.removeEventListener("click", firstClick);
  }

  // ── Init: inject, attach events, restore state ──
  function init() {
    inject();
    document.getElementById("music-btn").onclick = window.toggleMusic;
    document.addEventListener("click", firstClick);
    window.addEventListener("beforeunload", saveState);
    restoreState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
