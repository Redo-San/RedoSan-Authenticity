(function () {
  function audioSrc() {
    var p = window.location.pathname;
    var parts = p.replace(/\/+$/, "").split("/");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "pages") {
        var depth = parts.length - i - 1;
        var prefix = "";
        for (var j = 0; j < depth; j++) prefix += "../";
        return prefix + "RedoSan_Music.mp3";
      }
    }
    return "Style/RedoSan_Music.mp3";
  }

  var _playing = false;
  var _playPromise = null;

  function setUI(playing) {
    var btn = document.getElementById("music-btn");
    var credit = document.getElementById("music-credit");
    if (!btn) return;
    if (playing) {
      btn.textContent = "\uD83D\uDD0A";
      btn.classList.add("playing");
      if (credit) credit.classList.add("show");
    } else {
      btn.textContent = "\uD83C\uDFB5";
      btn.classList.remove("playing");
      if (credit) credit.classList.remove("show");
    }
  }

  function doPlay() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (!audio.paused) return;
    _playPromise = audio.play();
    _playPromise
      .then(function () {
        if (_playing === false) {
          audio.pause();
          return;
        }
        setUI(true);
      })
      .catch(function () {});
  }

  function doPause() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    _playing = false;
    audio.pause();
    setUI(false);
  }

  function preloadAudio() {
    if (document.querySelector('link[rel="preload"][as="audio"]')) return;
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "audio";
    link.href = audioSrc();
    document.head.appendChild(link);
  }

  function inject() {
    if (document.getElementById("bg-music")) return;
    var div = document.createElement("div");
    div.innerHTML =
      '<audio id="bg-music" src="' +
      audioSrc() +
      '" loop preload="auto"></audio>' +
      '<button id="music-btn" class="music-btn" aria-label="Toggle Music">&#x1F3B5;</button>' +
      '<div id="music-credit" class="music-credit" role="contentinfo" aria-label="Music credit">RedoSan</div>';
    while (div.firstChild) document.body.appendChild(div.firstChild);
  }

  function toggle() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (audio.paused) {
      sessionStorage.setItem("musicInteracted", "true");
      _playing = true;
      doPlay();
    } else {
      doPause();
    }
  }

  function saveState() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    sessionStorage.setItem(
      "musicState",
      JSON.stringify({
        isPlaying: _playing,
        currentTime: audio.currentTime,
      }),
    );
  }

  function restoreState() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    var saved = sessionStorage.getItem("musicState");
    var state = saved ? JSON.parse(saved) : null;
    if (state && state.currentTime) audio.currentTime = state.currentTime;
    if (sessionStorage.getItem("musicInteracted") === "true") {
      document.removeEventListener("click", firstClick);
      if (state && state.isPlaying) {
        _playing = true;
        doPlay();
        return;
      }
    }
    setUI(false);
  }

  function firstClick() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (sessionStorage.getItem("musicInteracted") === "true") {
      document.removeEventListener("click", firstClick);
      return;
    }
    sessionStorage.setItem("musicInteracted", "true");
    document.removeEventListener("click", firstClick);
    if (_playing) return;
    _playing = true;
    doPlay();
  }

  function init() {
    preloadAudio();
    inject();
    var btn = document.getElementById("music-btn");
    if (btn) btn.addEventListener("click", toggle);
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
