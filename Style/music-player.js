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
  var _audioBaseSrc = "";

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

  var _seekTarget = -1;
  function playSeeked(audio) {
    var onReady = function () {
      audio.removeEventListener("canplay", onReady);
      if (!_playing) return;
      _playPromise = audio.play();
      _playPromise
        .then(function () {
          if (!_playing) { audio.pause(); return; }
          setUI(true);
        })
        .catch(function () {
          if (_playing) { _playing = false; setUI(false); }
        });
    };
    if (audio.readyState >= 3) {
      onReady();
    } else {
      audio.addEventListener("canplay", onReady, { once: true });
    }
  }
  function doPlay() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (!audio.paused) return;
    if (_seekTarget > 0) {
      var src = _audioBaseSrc || audioSrc();
      var seekTime = _seekTarget;
      audio.src = src + "#t=" + seekTime;
      audio.load();
      _seekTarget = -1;
      playSeeked(audio);
      return;
    }
    _playPromise = audio.play();
    _playPromise
      .then(function () {
        if (_playing === false) {
          audio.pause();
          return;
        }
        setUI(true);
      })
      .catch(function () {
        if (_playing) {
          _playing = false;
          setUI(false);
        }
      });
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

  function saveState() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    var st = JSON.stringify({
      isPlaying: _playing,
      currentTime: audio.currentTime,
    });
    sessionStorage.setItem("musicState", st);
  }

  function restoreState() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    var state = null;
    var interacted = false;
    try {
      var saved = sessionStorage.getItem("musicState");
      if (saved) state = JSON.parse(saved);
      interacted = sessionStorage.getItem("musicInteracted") === "true";
    } catch (_) {
      void _;
    }
    _audioBaseSrc = (audio.src || audioSrc()).split("#")[0];
    if (state && state.isPlaying === true && typeof state.currentTime === "number" && isFinite(state.currentTime) && state.currentTime > 0) {
      _seekTarget = state.currentTime;
      _lastSafeTime = state.currentTime;
    }
    if (interacted) {
      if (state && state.isPlaying === true) {
        _playing = true;
        setUI(true);
        return;
      }
      if (!state) {
        setUI(true);
        return;
      }
      document.removeEventListener("click", firstClick);
    }
    setUI(false);
  }

  function firstClick() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (sessionStorage.getItem("musicInteracted") === "true") {
      document.removeEventListener("click", firstClick);
      if (_playing) { _userPaused = false; doPlay(); }
      return;
    }
    sessionStorage.setItem("musicInteracted", "true");
    document.removeEventListener("click", firstClick);
    if (_playing) return;
    _playing = true;
    _userPaused = false;
    doPlay();
  }

  var _userPaused = false;

  function toggle() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    if (audio.paused) {
      _userPaused = false;
      sessionStorage.setItem("musicInteracted", "true");
      _playing = true;
      doPlay();
    } else {
      _userPaused = true;
      doPause();
    }
  }

  function initAudioProtection() {
    var audio = document.getElementById("bg-music");
    if (!audio) return;
    audio.addEventListener("pause", function onPause() {
      if (!_userPaused && _playing) {
        setTimeout(function () {
          var a = document.getElementById("bg-music");
          if (a && a.paused && _playing && !_userPaused) {
            a.play().catch(function () {});
          }
        }, 50);
      }
    });
  }

  function watchAudioElement() {
    var target = document.body || document.documentElement;
    var obs = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        for (var r = 0; r < mutations[m].removedNodes.length; r++) {
          if (mutations[m].removedNodes[r].id === "bg-music") {
            console.error("[music] bg-music REMOVED from DOM!");
          }
        }
      }
    });
    obs.observe(target, { childList: true, subtree: true });
    return obs;
  }

  var _guardianTimer = null;
  var _lastSafeTime = 0;
  function startGuardian() {
    stopGuardian();
    _guardianTimer = setInterval(function () {
      var a = document.getElementById("bg-music");
      if (a && !a.paused && a.currentTime > 0) _lastSafeTime = a.currentTime;
      if (!_playing || _userPaused) return;
      if (a && a.paused && a.src) {
        if (a.currentTime < 1 && _lastSafeTime > 0) {
          var seekTime = _lastSafeTime;
          var src = (_audioBaseSrc || audioSrc()) + "#t=" + seekTime;
          a.src = src;
          a.load();
          var onReady = function () {
            a.removeEventListener("canplay", onReady);
            a.play().catch(function(){});
          };
          if (a.readyState >= 3) { onReady(); }
          else { a.addEventListener("canplay", onReady, { once: true }); }
        } else {
          a.play().catch(function(){});
        }
      }
    }, 1000);
  }
  function stopGuardian() {
    if (_guardianTimer) {
      clearInterval(_guardianTimer);
      _guardianTimer = null;
    }
  }

  var _saveTimer = null;
  function startSaveTimer() {
    stopSaveTimer();
    _saveTimer = setInterval(function () {
      var a = document.getElementById("bg-music");
      if (a && _playing && !a.paused) saveState();
    }, 5000);
  }
  function stopSaveTimer() {
    if (_saveTimer) { clearInterval(_saveTimer); _saveTimer = null; }
  }

  function init() {
    preloadAudio();
    inject();
    initAudioProtection();
    watchAudioElement();
    startGuardian();
    startSaveTimer();
    var btn = document.getElementById("music-btn");
    if (btn) btn.addEventListener("click", toggle);
    document.addEventListener("click", firstClick);
    window.addEventListener("beforeunload", saveState);
    restoreState();
  }

  window.__musicPlayerState = function () { return { playing: _playing }; };
  window.__musicSaveTime = function () {
    var a = document.getElementById("bg-music");
    if (a && !a.paused) {
      _lastSafeTime = a.currentTime;
      saveState();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
