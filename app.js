(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body;
  var knob = document.getElementById("knob");
  var knobLabel = document.getElementById("knobLabel");
  var menu = document.getElementById("menu");
  var menuStack = document.getElementById("menuStack");
  var panel = document.getElementById("panel");
  var panelInner = document.getElementById("panelInner");

  /* ================================================================
     THE WORD ABOVE THE MARK
     Set a letter at a time. On first load it holds until the hero has
     settled, then reveals — after that it re-sets whenever it changes.
     ================================================================ */
  var firstReveal = true;

  /* The word resolves the way the Thorne & Willow stats count up: it holds
     a fixed width so nothing reflows, and it eases out over the same 1100ms
     so the last characters settle rather than snap. Reduced motion gets the
     finished word immediately — the markup is never wrong, only unanimated. */
  var RESOLVE_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/#*";
  var resolveFrame = null;

  function resolveWord(word) {
    if (resolveFrame) cancelAnimationFrame(resolveFrame);

    // Lock the width to the finished word before scrambling, so the label
    // never changes size mid-run.
    knobLabel.style.minWidth = "";
    knobLabel.textContent = word;
    if (reduced) return;
    knobLabel.style.minWidth = knobLabel.offsetWidth + "px";

    var n = word.length, started = null, DUR = 1100;

    function step(now) {
      if (started === null) started = now;
      var t = Math.min(1, (now - started) / DUR);
      var eased = 1 - Math.pow(1 - t, 3);
      var settled = eased * n;

      var out = "";
      for (var i = 0; i < n; i++) {
        if (i < settled || word.charAt(i) === " ") out += word.charAt(i);
        else out += RESOLVE_GLYPHS.charAt((Math.random() * RESOLVE_GLYPHS.length) | 0);
      }
      knobLabel.textContent = out;

      if (t < 1) resolveFrame = requestAnimationFrame(step);
      else { knobLabel.textContent = word; resolveFrame = null; }
    }
    resolveFrame = requestAnimationFrame(step);
  }

  function setKnobWord(word) {
    if (knobLabel.dataset.word === word) return;
    knobLabel.dataset.word = word;

    // First load: the word resolves, then the mark arrives behind it —
    // the order the reference plays on a route change.
    if (firstReveal) {
      firstReveal = false;
      knobLabel.classList.add("in");
      setTimeout(function () { resolveWord(word); }, reduced ? 0 : 500);
      setTimeout(function () { knob.classList.add("in"); }, reduced ? 0 : 820);
      setTimeout(function () { replay("sweep"); }, reduced ? 0 : 980);
      setTimeout(function () { document.body.classList.add("socials-in"); }, reduced ? 0 : 1120);
      return;
    }
    resolveWord(word);
  }

  var ROUTES = ["home", "listen", "release", "releases", "the-artist", "bookings", "unreleased"];

  /* ================================================================
     ONE PAGE PER GROUP OF ROUTES
     The routes used to be hashes on a single document, which meant one
     URL for the whole site and 12MB arriving before any of it answered a
     tap. They are now four real pages. A route still names a view; this
     says which page that view lives on, so asking for a route the current
     page does not hold becomes a navigation instead of a dead call.

     ROOT is how far up the tree the assets are from the page asking. The
     pages in folders set it to "../" before this file runs; the one at
     the root leaves it alone. Stylesheet urls resolve against app.css so
     they need none of this, but markup and these clip maps resolve
     against the page.
     ================================================================ */
  var ROOT = window.ASTRO_ROOT || "";
  var PAGE_OF = {
    "home":       "",
    "listen":     "music/",
    "release":    "music/",
    "releases":   "music/",
    "unreleased": "vault/",
    "the-artist": "about/",
    "bookings":   "about/"
  };

  /* The route that page is showing when you land on it with no hash. */
  var LANDS_ON = { "": "home", "music/": "release", "vault/": "unreleased", "about/": "the-artist" };

  /* Where this page is, derived from where its assets are. */
  var HERE = ROOT === "" ? "" : (location.pathname.replace(/[^/]*$/, "").match(/[^/]+\/$/) || [""])[0];

  /* The url of a route, from here. */
  function urlFor(route) {
    var page = PAGE_OF[route];
    if (page === undefined) return null;
    var base = ROOT + page;
    if (base === "") base = "./";
    return base + (LANDS_ON[page] === route ? "" : "#" + route);
  }
  var views = {};
  Array.prototype.forEach.call(document.querySelectorAll(".view"), function (v) {
    views[v.getAttribute("data-route")] = v;
  });

  /* ================================================================
     ROUTER
     Each menu item is its own page. The frame never moves; only the
     view inside it swaps. Hash keeps a route linkable, but Back is a
     control on the page rather than the browser button — this runs in
     an embedded frame where browser history is not ours to drive.
     ================================================================ */
  /* Each project can carry its own footage. Muted + playsinline is what
     lets it start on a phone at all; a refused autoplay is caught and the
     page simply stays dark rather than throwing. */
  var CLIPS = {
    "release": "media/backdrop/release.mp4"
  };
  /* One clip per unreleased cut. Same treatment as the release footage —
     dimmed, desaturated and barely blurred by .bd-video, so it reads as
     the room the type is sitting in rather than something to watch. */
  var VAULT_CLIPS = {
    "basics":   "media/backdrop/basics.mp4",
    "chanel":   "media/backdrop/chanel.mp4",
    "candyman": "media/backdrop/candyman.mp4",
    "genesis":  "media/backdrop/genesis.mp4",
    "maria":    "media/backdrop/maria.mp4"
  };

  var bdWrap = document.getElementById("bdVideo");
  var bdVid = document.getElementById("bdVid");
  var bdNow = null;


  window.applyBackdrop = function (src, key) {
    if (!bdWrap || !bdVid) return;
    if (!src || reduced) {
      bdWrap.classList.remove("on");
      try { bdVid.pause(); } catch (e) {}
      return;
    }
    if (bdNow !== key) {
      bdNow = key;
      bdVid.muted = true;
      bdVid.setAttribute("src", src);
      try { bdVid.load(); } catch (e) {}
    }
    var played = bdVid.play();
    if (played && played.catch) played.catch(function () {});
    bdWrap.classList.add("on");
  };

  function setBackdrop(route) {
    if (!bdWrap || !bdVid) return;
    /* The vault picks its own footage per cut, so that route asks the
       list what is playing rather than the router deciding for it. */
    if (route === "releases" && window.reelBackdrop) { window.reelBackdrop(); return; }
    var src = CLIPS[route] ? ROOT + CLIPS[route] : null;
    if (!src || reduced) {
      bdWrap.classList.remove("on");
      try { bdVid.pause(); } catch (e) {}
      return;
    }
    if (bdNow !== route) {
      bdNow = route;
      bdVid.muted = true;            // Safari reads the property, not the attribute
      bdVid.setAttribute("src", src);
      try { bdVid.load(); } catch (e) {}
    }
    var played = bdVid.play();
    if (played && played.catch) played.catch(function () {});
    bdWrap.classList.add("on");
  }

  var current = null;
  var rackReady = null;
  var reelReady = null;
  var vaultReady = null;

  var trail = [];

  function go(route, fromHash, isBack) {
    if (ROUTES.indexOf(route) === -1) route = LANDS_ON[HERE] || "home";
    if (route === current) { closeMenu(); return; }

    /* Not on this page: hand it to the browser as a real navigation. The
       views for it are not in this document, so there is nothing to swap. */
    if (!views[route]) {
      var href = urlFor(route);
      if (href) { location.href = href; return; }
      route = LANDS_ON[HERE] || "home";
      if (!views[route]) return;
    }

    // remember where we were, so Back has somewhere real to return to
    if (!isBack && current) {
      trail.push(current);
      if (trail.length > 12) trail.shift();
    }

    if (current && views[current]) views[current].classList.remove("active");
    current = route;
    views[route].classList.add("active");
    body.setAttribute("data-route", route);
    if (route !== "unreleased" && window.stopSnippet) window.stopSnippet();

    // reset the scroll of the view we just entered
    views[route].scrollTop = 0;
    setBackdrop(route);

    /* The route's name lands the way a record's name lands on the reel:
       collapsed to a few characters, filled back out with noise, then
       locked in from the left. Held back to meet the heading's own rise so
       the two settle together rather than fighting each other. */
    decodeHeading(views[route]);

    // The rack measures itself from live layout, and a hidden route has
    // none — so re-measure the moment it becomes visible.
    if (route === "the-artist" && rackReady) requestAnimationFrame(rackReady);
    if (route === "releases" && reelReady) requestAnimationFrame(reelReady);
    if (route === "unreleased" && vaultReady) requestAnimationFrame(vaultReady);

    Array.prototype.forEach.call(menuStack.querySelectorAll("[data-go]"), function (b) {
      if (b.getAttribute("data-go") === route) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    if (!fromHash) {
      // replaceState, not location.hash: assigning the hash pushes an entry,
      // so the phone's back gesture walked back through every route visited
      // instead of leaving the page. Deep links still work.
      try {
        history.replaceState(null, "", LANDS_ON[HERE] === route ? location.pathname + location.search : "#" + route);
      } catch (e) { /* embedded — routing still works, the URL just will not track */ }
    }

    closeMenu();

    // Send focus to the new page's heading so the route change is announced
    // rather than silently swapping under a screen reader.
    var h = views[route].querySelector("h1[tabindex]");
    if (h) setTimeout(function () { h.focus(); }, reduced ? 0 : 120);
  }

  window.addEventListener("hashchange", function () {
    go((location.hash || "").replace(/^#\/?/, "") || LANDS_ON[HERE] || "home", true);
  });

  /* ================================================================
     PANEL — signup only; everything else is a route now
     ================================================================ */
  // Kept for a future mailing-list integration. Nothing is sent yet.
  var PANELS = { email: { title: "Email", type: "email" } };
  var openPanel = null;
  var lastFocus = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderPanel(name) {
    var data = PANELS[name];
    var isEmail = data.type === "email";
    panelInner.textContent = "";

    var h = el("h2", null, data.title);
    h.id = "panelTitle";
    panelInner.appendChild(h);

    var field = el("input", "field");
    field.type = data.type;
    field.placeholder = isEmail ? "Email address" : "Phone number";
    field.setAttribute("aria-label", isEmail ? "Email address" : "Phone number");

    var terms = el("label", "terms");
    var box = document.createElement("input");
    box.type = "checkbox";
    terms.appendChild(box);
    terms.appendChild(document.createTextNode("I accept the "));
    terms.appendChild(el("u", null, "terms"));

    var submit = el("button", "pill", "Submit");
    submit.type = "submit";

    var form = el("form");
    form.style.display = "grid";
    form.style.gap = "10px";
    form.noValidate = true;
    form.appendChild(field);
    form.appendChild(terms);
    form.appendChild(submit);

    var msg = el("p", "note", "Demo only. Nothing is stored and nothing is sent.");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!field.value.trim()) {
        msg.textContent = "Enter " + (isEmail ? "an email address" : "a phone number") + " first.";
        field.focus();
        return;
      }
      if (!box.checked) { msg.textContent = "Accept the terms to continue."; box.focus(); return; }
      form.textContent = "";
      form.appendChild(el("p", "note", "Thanks — you are on the list. (Demo: nothing was actually sent.)"));
    });

    panelInner.appendChild(form);
    panelInner.appendChild(msg);

    var back = el("button", "back", "Back");
    back.type = "button";
    back.addEventListener("click", closePanel);
    panelInner.appendChild(back);
  }

  function showPanel(name) {
    if (!PANELS[name]) return;
    lastFocus = document.activeElement;
    openPanel = name;
    renderPanel(name);
    panel.classList.add("open");
    var f = panelInner.querySelector(".field");
    if (f) f.focus();
  }

  function closePanel() {
    if (!openPanel) return;
    openPanel = null;
    panel.classList.remove("open");
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
  }

  /* ================================================================
     MENU
     ================================================================ */
  function openMenu() {
    body.classList.add("menu-open");
    knob.setAttribute("aria-expanded", "true");
    knob.setAttribute("aria-label", "Close menu");
    setKnobWord("Close");
    var first = menuStack.querySelector(".pill");
    if (first) first.focus();
  }

  function closeMenu() {
    if (!body.classList.contains("menu-open")) return;
    body.classList.remove("menu-open");
    knob.setAttribute("aria-expanded", "false");
    knob.setAttribute("aria-label", "Open menu");
    setKnobWord("Explore");
  }

  function toggleMenu() {
    if (body.classList.contains("menu-open")) { closeMenu(); knob.focus(); }
    else openMenu();
  }

  // Retriggering a CSS animation needs the class gone for a frame, or a
  // second press does nothing at all.
  function replay(cls) {
    if (reduced) return;
    knob.classList.remove(cls);
    void knob.offsetWidth;
    knob.classList.add(cls);
  }

  // The press: collapse to a point and spring back, with the light running
  // the rim alongside it.
  knob.addEventListener("click", function () { replay("pulse"); replay("sweep"); });
  knob.addEventListener("pointerenter", function () { replay("sweep"); });

  // Guard by name: both animations end on this element, and an unguarded
  // handler would strip the other one's class mid-run.
  knob.addEventListener("animationend", function (e) {
    if (e.animationName === "knobPulse") knob.classList.remove("pulse");
    if (e.animationName === "rimRunArc") knob.classList.remove("sweep");
  });

  knob.addEventListener("click", toggleMenu);

  // Back means back: return to the route you arrived from. From a page that
  // is usually the hero, but page -> menu -> page keeps its own trail, so it
  // never dumps you home when you came from somewhere else.
  document.getElementById("backBtn").addEventListener("click", function () {
    closeMenu();
    /* An empty trail on a folder page means you arrived here directly, so
       there is no earlier view to return to — go out to the landing page
       rather than sitting still. */
    var back = trail.pop();
    if (back) { go(back, false, true); return; }
    if (HERE === "") { go("home", false, true); return; }
    location.href = ROOT || "./";
  });

  document.addEventListener("click", function (e) {
    var nav = e.target.closest("[data-go]");
    if (nav) {
      var r = nav.getAttribute("data-go");
      /* Menu items are real anchors now, so a crawler can follow them and
         a middle-click opens a tab. Routes this page holds are still
         swapped in place; the rest are left to the browser. */
      if (views[r]) { e.preventDefault(); go(r); return; }
      if (nav.tagName === "A" && nav.getAttribute("href")) return;
      e.preventDefault(); go(r); return;
    }

    var trigger = e.target.closest("[data-panel]");
    if (trigger) { showPanel(trigger.getAttribute("data-panel")); return; }

    if (e.target === menu) closeMenu();
    if (e.target === panel) closePanel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (openPanel) closePanel();
      else if (body.classList.contains("menu-open")) { closeMenu(); knob.focus(); }
      else if (current !== "home") go("home");   // Escape is still "get me out"
      return;
    }
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMenu(); }
  });

  document.addEventListener("focusin", function (e) {
    if (openPanel && !panel.contains(e.target)) {
      var f = panelInner.querySelector(".field, .pill, .back");
      if (f) f.focus();
    }
  });

  // Placeholder destinations say so rather than silently doing nothing.
  Array.prototype.forEach.call(document.querySelectorAll("[data-placeholder]"), function (node) {
    node.addEventListener("click", function (e) {
      e.preventDefault();
      if (node.dataset.busy) return;
      node.dataset.busy = "1";
      var keep = node.innerHTML;
      node.textContent = "Link not supplied yet";
      setTimeout(function () { node.innerHTML = keep; delete node.dataset.busy; }, 1500);
    });
  });

  /* ================================================================
     THE RACK
     One card centred, neighbours peeking, a full-bleed backdrop carrying
     whichever is centred. Wheel, drag, arrow keys and taps all drive the
     same index — the wheel is one input among several, never the only way
     through, and it is only captured while the pointer is over the rack so
     the rest of the page still scrolls normally.
     ================================================================ */
  var rackView = document.getElementById("rackView");
  var rackTrack = document.getElementById("rackTrack");
  var rackDots = document.getElementById("rackDots");
  var rackBd = document.getElementById("rackBd");

  if (rackView) {
    var cards = Array.prototype.slice.call(rackTrack.children);
    var bds = Array.prototype.slice.call(rackBd.children);
    var rackI = 0;

    var dots = cards.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Show " + (i + 1) + " of " + cards.length);
      // stay on the dot — moving focus to the card loses your place in the row
      b.addEventListener("click", function () { goCard(i, true); });
      rackDots.appendChild(b);
      return b;
    });

    // Measure rather than compute from widths and gaps — it stays correct
    // when the cards reflow at a different viewport.
    function offsetFor(i) {
      var c = cards[i];
      return rackView.clientWidth / 2 - (c.offsetLeft + c.offsetWidth / 2);
    }

    /* Only the card in the middle plays. Three decoders running at once
       for cards nobody is looking at is a lot to ask of a phone, so the
       neighbours sit on their poster frame until they come round. */
    var shotVids = cards.map(function (c) { return c.querySelector("video"); });

    function playCard() {
      shotVids.forEach(function (v, n) {
        if (!v) return;
        if (n !== rackI || reduced) { try { v.pause(); } catch (e) {} return; }
        var played = v.play();
        if (played && played.catch) played.catch(function () {});
      });
    }

    function paint(x, glide) {
      rackTrack.classList.toggle("glide", !!glide && !reduced);
      rackTrack.style.transform = "translate3d(" + x + "px,0,0)";
    }

    function goCard(i, silent) {
      rackI = Math.max(0, Math.min(cards.length - 1, i));
      paint(offsetFor(rackI), true);

      cards.forEach(function (c, n) { c.classList.toggle("is-current", n === rackI); });
      playCard();
      bds.forEach(function (b, n) { b.classList.toggle("is-current", n === rackI); });
      dots.forEach(function (d, n) {
        if (n === rackI) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });

      if (!silent) cards[rackI].focus({ preventScroll: true });
    }

    cards.forEach(function (c, i) {
      c.addEventListener("click", function () { if (i !== rackI) goCard(i); });
    });

    /* wheel: horizontal gestures only.
       A trackpad swipe sideways or a shift+wheel moves the rack; a plain
       vertical wheel is the page's, not ours, so it is never swallowed —
       that is what used to strand the reader above the biography. */
    var wheelLock = false;
    rackView.addEventListener("wheel", function (e) {
      var dy = e.shiftKey ? 0 : e.deltaY;
      var dx = e.shiftKey ? e.deltaY : e.deltaX;
      var dir;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 4) dir = dx > 0 ? 1 : -1;
      else if (Math.abs(dy) >= 4) dir = dy > 0 ? 1 : -1;   // down walks forward
      else return;

      /* The wheel walks the row while there is still a photograph to walk
         to, and is handed straight back to the page at either end. That
         is the whole difference between a gallery and a trap: scrolling
         past the last shot has to reach the biography, or the route is
         stuck again. */
      var next = rackI + dir;
      if (next < 0 || next > cards.length - 1) return;

      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      setTimeout(function () { wheelLock = false; }, 260);
      goCard(next, true);
    }, { passive: false });

    /* drag and swipe share one path through pointer events.
       A gesture starts *armed* rather than dragging: until it has moved
       far enough to show an axis we neither capture the pointer nor move
       the track. Sideways wins the pointer; downwards is let go so the
       page scrolls, which is the behaviour a thumb expects on a phone. */
    var armed = false, dragging = false, startX = 0, startY = 0, startOff = 0, pid = null;
    var AXIS = 6;      // px of travel before the gesture has to declare itself
    var THROW = 46;    // px of travel that counts as moving to the next card

    function releaseDrag() {
      if (pid !== null) {
        try { if (rackView.hasPointerCapture(pid)) rackView.releasePointerCapture(pid); } catch (e) {}
      }
      armed = false; dragging = false; pid = null;
      rackView.classList.remove("dragging");
    }

    rackView.addEventListener("pointerdown", function (e) {
      armed = true;
      dragging = false;
      pid = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startOff = offsetFor(rackI);
    });

    rackView.addEventListener("pointermove", function (e) {
      if (!armed && !dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;

      if (!dragging) {
        if (Math.abs(dx) < AXIS && Math.abs(dy) < AXIS) return;  // too early to tell
        if (Math.abs(dy) > Math.abs(dx)) { armed = false; pid = null; return; }  // the page's gesture
        dragging = true;
        armed = false;
        rackView.classList.add("dragging");
        try { rackView.setPointerCapture(e.pointerId); } catch (err) {}
      }
      paint(startOff + dx, false);
    });

    function endDrag(e) {
      if (!dragging) { releaseDrag(); return; }
      var moved = e.clientX - startX;
      releaseDrag();
      if (Math.abs(moved) > THROW) goCard(rackI + (moved < 0 ? 1 : -1), true);
      else goCard(rackI, true);
    }
    rackView.addEventListener("pointerup", endDrag);
    rackView.addEventListener("pointercancel", endDrag);

    document.addEventListener("keydown", function (e) {
      if (current !== "the-artist" || body.classList.contains("menu-open")) return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goCard(rackI + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goCard(rackI - 1, true); }
    });

    window.addEventListener("resize", function () { paint(offsetFor(rackI), false); });

    // The rack is inside a hidden route at load, where every width is 0.
    // Re-measure when it is actually on screen or the first card sits wrong.
    rackReady = function () { goCard(rackI, true); };
    goCard(0, true);
  }

  /* ================================================================
     THE REEL
     One sleeve centred, its neighbours peeking past both edges, the
     record's name underneath and its clip behind the page. Moving to
     the next record swaps all three, and the name decodes into place
     rather than cutting — the change is the thing you are meant to see.
     ================================================================ */

  /* Where each record can be played. A record with no entries yet says
     so rather than opening an empty box — add its URLs here and the
     sleeve starts offering them with no other change. */
  var RELEASE_LINKS = {
    "basics":   [],
    "chanel":   [],
    "candyman": [
      { on: "soundcloud", label: "SoundCloud", href: "https://on.soundcloud.com/GMPRKoHCzL5GEKAPbW" }
    ],
    "genesis":  [
      { on: "apple", label: "Apple Music", href: "https://music.apple.com/gb/song/genesis-file13/1807418568" },
      { on: "youtube", label: "YouTube", href: "https://youtu.be/iV_TyMMWDoQ" }
    ],
    "maria":    [
      { on: "soundcloud", label: "SoundCloud", href: "https://on.soundcloud.com/8GmqvLqSBiHNDr9bf7" }
    ]
  };

  var MARKS = {
    spotify: '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.22.46.68.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.54-1.8c4.37-1.32 9.79-.68 13.5 1.6.44.27.58.85.3 1.29Zm.13-3.4C15.23 8.33 8.9 8.12 5.2 9.24a1.12 1.12 0 1 1-.65-2.15C8.8 5.8 15.8 6.05 20.24 8.69a1.12 1.12 0 1 1-1.14 1.94Z"/></svg>',
    apple:   '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.3 16.1V8.6l6-1.4v7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="8.75" cy="16.2" rx="1.75" ry="1.4" fill="currentColor"/><ellipse cx="14.75" cy="14.8" rx="1.75" ry="1.4" fill="currentColor"/></svg>',
    soundcloud: '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="0.8" y="12.8" width="1.5" height="4.8" rx=".75"/><rect x="3.6" y="11" width="1.5" height="6.6" rx=".75"/><rect x="6.4" y="9.2" width="1.5" height="8.4" rx=".75"/><rect x="9.2" y="11.6" width="1.5" height="6" rx=".75"/></g><path fill="currentColor" d="M12.4 17.6V9.6c.75-1.85 2.55-3.15 4.7-3.15 2.75 0 5 2.1 5.2 4.8 1 .35 1.7 1.3 1.7 2.4 0 1.45-1.15 2.6-2.6 2.6h-9Z"/></svg>',
    youtube: '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5.6" width="20" height="12.8" rx="4.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.2 9.3 15.6 12l-5.4 2.7Z" fill="currentColor"/></svg>'
  };

  /* The name does not cut from one record to the next: it collapses to a
     few characters, fills back out with noise and then locks in from the
     left until the real title is standing. Reduced motion gets the title
     with none of the theatre. */
  var SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$&@*+!?><[]{}%";
  function decodeInto(el, text) {
    if (!el) return;
    if (el._scramble) { cancelAnimationFrame(el._scramble); el._scramble = null; }
    if (el._settle) { clearTimeout(el._settle); el._settle = null; }
    if (reduced) { el.textContent = text; return; }
    /* Driven off elapsed time rather than a tick count: a decoding video
       behind the page is exactly when timers get throttled, and a title
       that takes three seconds to land because the phone was busy is not
       the effect. It redraws about sixteen times whatever the frame rate. */
    var DUR = 1000, REDRAWS = 16, t0 = performance.now(), lastStep = -1;
    function frame(now) {
      var p = Math.min(1, (now - t0) / DUR);
      var step = Math.floor(p * REDRAWS);
      if (step !== lastStep) {
        lastStep = step;
        var len = Math.max(3, Math.round(text.length * Math.min(1, p * 3.2)));
        var locked = Math.floor(text.length * Math.max(0, (p - 0.25) / 0.75));
        var out = "";
        for (var i = 0; i < len; i++) {
          var real = text.charAt(i);
          if (i < locked) out += real;
          else if (real === " ") out += " ";
          else out += SCRAMBLE_CHARS.charAt(Math.floor(Math.random() * SCRAMBLE_CHARS.length));
        }
        el.textContent = out;
      }
      if (p < 1) el._scramble = requestAnimationFrame(frame);
      else settle();
    }
    /* The last frame is what writes the real name, so a stalled rAF — a
       backgrounded tab, or a phone busy decoding the footage behind all
       this — would leave the title sitting in noise for good. A timer
       lands it regardless; whichever gets there first cancels the other. */
    function settle() {
      if (el._scramble) { cancelAnimationFrame(el._scramble); el._scramble = null; }
      if (el._settle) { clearTimeout(el._settle); el._settle = null; }
      el.textContent = text;
    }
    el._settle = setTimeout(settle, DUR + 120);
    el._scramble = requestAnimationFrame(frame);
  }

  /* Route headings get the same treatment as the reel's titles. The real
     text is cached on the node the first time through — after that the
     heading only ever holds noise mid-flight — and mirrored into aria-label
     so focus landing here never announces a frame of scramble. */
  function decodeHeading(view) {
    /* Only the ones that name a record. A section heading is furniture —
       Listen and Bookings decoding on arrival was noise, and it cheapened
       the effect where it means something. */
    var h = view && view.querySelector(".route-head h1[data-decode]");
    if (!h) return;
    var text = h.getAttribute("data-text");
    if (text == null) {
      text = h.textContent;
      h.setAttribute("data-text", text);
      h.setAttribute("aria-label", text);
    }
    if (reduced) { h.textContent = text; return; }
    if (h._decodeWait) clearTimeout(h._decodeWait);
    h._decodeWait = setTimeout(function () {
      h._decodeWait = null;
      decodeInto(h, text);
    }, 90);
  }

  /* ================================================================
     THE REEL
     One card centred, its neighbours peeking past both edges, the name
     under it decoding as the card changes. Releases and the vault are the
     same object with different cards — the catalogue brings up links over
     a sleeve, the vault plays a snippet — so the measuring, the wheel that
     walks and hands back at the ends, and the drag that only ever takes
     the horizontal axis all live here once. Two copies of this would have
     drifted apart by the second change.
     ================================================================ */
  function makeReel(root, opts) {
    if (!root) return null;
    var view = root.querySelector(".reel-view");
    var track = root.querySelector(".reel-track");
    var titleEl = root.querySelector(".reel-title");
    var cards = Array.prototype.slice.call(track.children);
    var i = 0;

    /* Read off computed style rather than offsetLeft/offsetWidth, which
       round to whole pixels. The card is sized in vh now, so it lands on a
       fraction, and rounding each card and each gap put the fifth sleeve
       twelve pixels left of the name underneath it. Computed width is the
       used value as a float and, unlike a bounding rect, is not disturbed
       by the scale a neighbour is sitting at. */
    function offset(n) {
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var w = parseFloat(getComputedStyle(cards[n]).width) || 0;
      var left = n * (w + gap);      // every card is one --card wide
      return view.getBoundingClientRect().width / 2 - (left + w / 2);
    }
    function paint(x, glide) {
      track.classList.toggle("glide", !!glide && !reduced);
      track.style.transform = "translate3d(" + x + "px,0,0)";
    }

    function goCard(n, quiet) {
      var was = i;
      i = Math.max(0, Math.min(cards.length - 1, n));
      paint(offset(i), true);
      cards.forEach(function (c, k) {
        c.classList.toggle("is-current", k === i);
        c.classList.toggle("is-left", k < i);
        c.classList.toggle("is-right", k > i);
      });
      if (opts.onChange) opts.onChange(cards[i], i, was);
      if (was !== i || quiet === "force") decodeInto(titleEl, cards[i].getAttribute("data-title"));
    }

    /* A tap on the centred card is that card's own business. A tap on a
       neighbour walks to it instead, and a drag is not a tap, so the
       pointer path below cancels the click it would otherwise fire. */
    var suppressClick = false;
    cards.forEach(function (c, n) {
      c.addEventListener("click", function () {
        if (suppressClick) { suppressClick = false; return; }
        if (n !== i) { goCard(n); return; }
        if (opts.onActivate) opts.onActivate(c, n);
      });
    });

    /* The wheel walks the reel, exactly as it walks the photographs on the
       artist route: down goes forward, up goes back, and at either end the
       gesture is handed straight back so the page still scrolls. */
    var lock = false;
    view.addEventListener("wheel", function (e) {
      var dy = e.shiftKey ? 0 : e.deltaY;
      var dx = e.shiftKey ? e.deltaY : e.deltaX;
      var dir;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) >= 4) dir = dx > 0 ? 1 : -1;
      else if (Math.abs(dy) >= 4) dir = dy > 0 ? 1 : -1;
      else return;

      var next = i + dir;
      if (next < 0 || next > cards.length - 1) return;

      e.preventDefault();
      if (lock) return;
      lock = true;
      setTimeout(function () { lock = false; }, 260);
      goCard(next);
    }, { passive: false });

    /* The gesture starts unarmed: until it has moved far enough to show a
       horizontal axis it neither captures the pointer nor moves the reel,
       so a thumb swiping down still scrolls the page. */
    var armed = false, drag = false, x0 = 0, y0 = 0, off0 = 0, pid = null;
    function release() {
      if (pid !== null) {
        try { if (view.hasPointerCapture(pid)) view.releasePointerCapture(pid); } catch (e) {}
      }
      armed = false; drag = false; pid = null;
      view.classList.remove("dragging");
    }
    view.addEventListener("pointerdown", function (e) {
      armed = true; drag = false; pid = e.pointerId;
      x0 = e.clientX; y0 = e.clientY; off0 = offset(i);
    });
    view.addEventListener("pointermove", function (e) {
      if (!armed && !drag) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      if (!drag) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx)) { armed = false; pid = null; return; }
        drag = true; armed = false;
        view.classList.add("dragging");
        try { view.setPointerCapture(e.pointerId); } catch (err) {}
      }
      paint(off0 + dx, false);
    });
    function end(e) {
      if (!drag) { release(); return; }
      var moved = e.clientX - x0;
      release();
      suppressClick = true;                 // this gesture was a drag, not a tap
      setTimeout(function () { suppressClick = false; }, 90);
      if (Math.abs(moved) > 46) goCard(i + (moved < 0 ? 1 : -1));
      else paint(offset(i), true);
    }
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);

    document.addEventListener("keydown", function (e) {
      if (current !== opts.route || body.classList.contains("menu-open")) return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goCard(i + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); goCard(i - 1); }
    });

    window.addEventListener("resize", function () { paint(offset(i), false); });

    return {
      cards: cards,
      card: function () { return cards[i]; },
      go: goCard,
      /* Arriving on the route. A reel sits inside a hidden route at load,
         where every width is 0, so it re-measures — and the name decodes
         again, the way the record's name does on the page above it. */
      reveal: function () {
        paint(offset(i), false);
        decodeInto(titleEl, cards[i].getAttribute("data-title"));
      }
    };
  }

  /* ---- the catalogue --------------------------------------------- */
  var reelRoot = document.getElementById("reel");
  var reel = null;
  if (reelRoot) {
    var reelLinks = document.getElementById("reelLinks");

    function fillLinks(key) {
      if (!reelLinks) return;
      var links = RELEASE_LINKS[key] || [];
      if (!links.length) {
        reelLinks.innerHTML = '<li><p class="note">Links to come.</p></li>';
        return;
      }
      reelLinks.innerHTML = links.map(function (l) {
        return '<li><a class="pill wide" href="' + l.href + '" target="_blank" rel="noopener">' +
               (MARKS[l.on] || "") + l.label + "</a></li>";
      }).join("");
    }

    window.reelBackdrop = function () {
      var c = reel && reel.card();
      var key = c && c.getAttribute("data-clip");
      window.applyBackdrop(key && VAULT_CLIPS[key] ? ROOT + VAULT_CLIPS[key] : null, "reel:" + key);
    };

    reel = makeReel(reelRoot, {
      route: "releases",
      onChange: function (card) {
        reelRoot.classList.remove("open");   // the links belong to one record
        fillLinks(card.getAttribute("data-clip"));
        window.reelBackdrop();
      },
      onActivate: function () { reelRoot.classList.toggle("open"); }
    });
    reelReady = function () { reel.reveal(); };
    reel.go(0, "force");
  }

  /* ---- the vault ---------------------------------------------------
     The snippets are the only sound on the site. The tap is the play, one
     runs at a time, and walking to another cut or leaving the route stops
     whichever is going — audio that follows you onto the next page is
     unforgivable. */
  var vaultRoot = document.getElementById("vault");
  if (vaultRoot) {
    /* A cut that arrived as audio has no footage of its own, so its card is
       a short loop of b-roll with the track alongside it. Everything below
       asks the card which element carries the sound rather than assuming
       it is the video: with a track, the picture is muted decoration that
       runs while the track does. */
    var cuts = Array.prototype.slice.call(vaultRoot.querySelectorAll("[data-snip]")).map(function (card) {
      var face = card.querySelector(".snip-vid");
      var track = card.querySelector(".snip-track");
      return { card: card, face: face, sound: track || face, silent: !!track };
    });
    function stopCut(c) {
      try { c.sound.pause(); } catch (e) {}
      if (c.silent) { try { c.face.pause(); } catch (e) {} }
    }
    function hushSnips(except) {
      cuts.forEach(function (c) { if (c.sound !== except) stopCut(c); });
    }
    cuts.forEach(function (c) {
      c.sound.addEventListener("play", function () {
        c.card.classList.add("playing");
        if (c.silent) {
          var p = c.face.play();            // the picture keeps time with it
          if (p && p.catch) p.catch(function () {});
        }
      });
      ["pause", "ended"].forEach(function (ev) {
        c.sound.addEventListener(ev, function () {
          c.card.classList.remove("playing");
          if (c.silent) { try { c.face.pause(); } catch (e) {} }
        });
      });
    });

    var vault = makeReel(vaultRoot, {
      route: "unreleased",
      onChange: function () { hushSnips(null); },   // walking off a cut stops it
      onActivate: function (card) {
        var c = cuts.filter(function (x) { return x.card === card; })[0];
        if (!c) return;
        if (c.sound.paused) {
          hushSnips(c.sound);               // starting one silences the rest
          var played = c.sound.play();
          if (played && played.catch) played.catch(function () {});
        } else {
          stopCut(c);
        }
      }
    });
    vaultReady = function () { vault.reveal(); };
    vault.go(0, "force");
    window.stopSnippet = function () { hushSnips(null); };
  }

  /* ================================================================
     SCROLLING THROUGH THE RECORDS
     The latest record, the catalogue and the vault are one run: keeping
     the wheel going at the bottom of each carries on into the next rather
     than stopping dead against a route that happens to fit the screen.

     On the two reel routes the last card has to be reached first — the
     reel takes the wheel while it still has somewhere to walk, and only
     hands it back at the end, which is when the route can scroll and this
     can pick it up. That is why the guard below is defaultPrevented: the
     reel's own listener sits on a descendant and runs first, so an event
     it has claimed arrives here already spoken for.

     It waits for a deliberate push — one trackpad nudge should never move
     you off the page you are reading — and it only ever runs forward.
     Scrolling back up is for reading what you scrolled past.
     ================================================================ */
  function carryOn(from, to) {
    var view = views[from];
    if (!view) return;
    var carry = 0, locked = false;
    view.addEventListener("wheel", function (e) {
      if (current !== from || locked || reduced) return;
      if (e.defaultPrevented) { carry = 0; return; }   // the reel is walking
      if (e.deltaY <= 0) { carry = 0; return; }
      var atEnd = view.scrollTop + view.clientHeight >= view.scrollHeight - 2;
      if (!atEnd) { carry = 0; return; }
      carry += e.deltaY;
      if (carry < 160) return;
      carry = 0;
      locked = true;
      setTimeout(function () { locked = false; }, 900);
      go(to);
    }, { passive: true });
  }
  carryOn("release", "releases");
  carryOn("releases", "unreleased");

  /* The cover opens the list rather than the page showing everything at
     once — it keeps the footage behind it visible, which is the point. */
  var releaseBlock = document.getElementById("releaseBlock");
  var sleeveBtn = document.getElementById("sleeveBtn");
  if (releaseBlock && sleeveBtn) {
    sleeveBtn.addEventListener("click", function () {
      var open = releaseBlock.classList.toggle("open");
      sleeveBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* ---- the sleeve tilts to the pointer now there is no scroll -------- */
  var sleeve = document.getElementById("sleeve");
  if (sleeve && !reduced) {
    window.addEventListener("pointermove", function (e) {
      if (current !== "release") return;
      var x = (e.clientX / window.innerWidth) * 2 - 1;
      var y = (e.clientY / window.innerHeight) * 2 - 1;
      sleeve.style.setProperty("--ry", (-14 + x * 16).toFixed(2) + "deg");
      sleeve.style.setProperty("--rx", (4 - y * 9).toFixed(2) + "deg");
    });
  }

  setKnobWord("Explore");
  go((location.hash || "").replace(/^#\/?/, "") || LANDS_ON[HERE] || "home", true);

  /* ================================================================
     THE GLASS OBJECT
     Two textures. The photograph is sampled straight and never displaced,
     so a face would stay sharp. Only the type is sampled three times at
     slightly different offsets along the surface normal, so the letter
     edges split into colour. The name is the thing made of glass.
     ================================================================ */
  var canvas = document.getElementById("gl");
  var plain = document.getElementById("plain");
  var stage = document.getElementById("object");

  var gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" })
        || canvas.getContext("experimental-webgl");
  if (!gl) return;                       // plain hero stays exactly as it is

  var typeCanvas = document.createElement("canvas"), tctx = typeCanvas.getContext("2d");
  var photoCanvas = document.createElement("canvas"), pctx = photoCanvas.getContext("2d");
  var photoImage = null;

  var grainTile = null;

  function makeGrainTile() {
    var t = document.createElement("canvas");
    t.width = t.height = 128;
    var c = t.getContext("2d");
    var img = c.createImageData(128, 128), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = n;
      d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return t;
  }

  /* The hero shot is portrait. Cover-filling it into a laptop window blows it
     up until only a sleeve and a hand are left on screen, so the zoom is
     capped here: never crop away more than MAX_CROP of the photo's height.
     Past that point the shot settles into a centred column and the rest of
     the frame is filled with a soft, dark blow-up of the same photo, so a
     wide screen reads as the same night carrying on rather than as bars. */
  var MAX_CROP = 0.34, MIN_COL = 0.42;
  var heroColW = 0;
  var bleedCanvas = null, bctx = null;
  var seamCanvas = null, sctx = null;

  function drawBleed(w, h, iw, ih) {
    // Blur by painting small and drawing back up. ctx.filter is missing on
    // older Safari and this costs nothing by comparison.
    if (!bleedCanvas) {
      bleedCanvas = document.createElement("canvas");
      bctx = bleedCanvas.getContext("2d");
    }
    var bw = 40, bh = Math.max(2, Math.round(bw * (h / w)));
    bleedCanvas.width = bw; bleedCanvas.height = bh;
    var bs = Math.max(bw / iw, bh / ih) * 1.18;
    bctx.clearRect(0, 0, bw, bh);
    bctx.drawImage(photoImage, (bw - iw * bs) / 2, (bh - ih * bs) * 0.3, iw * bs, ih * bs);

    pctx.save();
    pctx.imageSmoothingEnabled = true;
    pctx.globalAlpha = 0.62;
    pctx.drawImage(bleedCanvas, 0, 0, w, h);
    pctx.restore();

    var edge = pctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, "rgba(7,8,10,0.66)");
    edge.addColorStop(0.5, "rgba(7,8,10,0.08)");
    edge.addColorStop(1, "rgba(7,8,10,0.66)");
    pctx.fillStyle = edge;
    pctx.fillRect(0, 0, w, h);
  }

  function drawHero(w, h) {
    var iw = photoImage.width, ih = photoImage.height;
    var cover = Math.max(w / iw, h / ih);
    var capped = (h / ih) / (1 - MAX_CROP);
    // On a short, very wide window the height-led cap would shrink the shot
    // to a sliver, so it never gives up more than MIN_COL of the width.
    var floor = (w * MIN_COL) / iw;
    var s = Math.min(cover, Math.max(capped, floor));
    var dw = iw * s, dh = ih * s;
    var x = (w - dw) / 2, y = (h - dh) * 0.3;
    heroColW = Math.min(dw, w);

    if (dw >= w - 1) {                    // phone and anything tall: unchanged
      pctx.drawImage(photoImage, x, y, dw, dh);
      return;
    }

    drawBleed(w, h, iw, ih);

    // Feather both vertical seams so the sharp photo melts into the blur
    // instead of stopping on a hard edge. destination-out has to happen on
    // its own canvas or it would punch through the bleed underneath.
    if (!seamCanvas) {
      seamCanvas = document.createElement("canvas");
      sctx = seamCanvas.getContext("2d");
    }
    seamCanvas.width = w; seamCanvas.height = h;
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(photoImage, x, y, dw, dh);

    var f = Math.min(dw * 0.10, w * 0.06);
    sctx.globalCompositeOperation = "destination-out";
    var fadeL = sctx.createLinearGradient(x, 0, x + f, 0);
    fadeL.addColorStop(0, "rgba(0,0,0,1)");
    fadeL.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = fadeL;
    sctx.fillRect(x, 0, f, h);
    var fadeR = sctx.createLinearGradient(x + dw, 0, x + dw - f, 0);
    fadeR.addColorStop(0, "rgba(0,0,0,1)");
    fadeR.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = fadeR;
    sctx.fillRect(x + dw - f, 0, f, h);
    sctx.globalCompositeOperation = "source-over";

    pctx.drawImage(seamCanvas, 0, 0);
  }

  function paintType(w, h) {
    typeCanvas.width = w; typeCanvas.height = h;
    tctx.clearRect(0, 0, w, h);
    tctx.textAlign = "center";
    tctx.textBaseline = "middle";

    var word = "ASTRO";
    // Measure rather than guess — a guess overflows the moment the word
    // or the loaded face changes.
    var size = Math.min(w * 0.20, h * 0.36);
    tctx.font = '400 ' + size + 'px "Archivo Black", Arial, sans-serif';
    // The name belongs to the photo rather than to the window: once the shot
    // settles into a centred column a full-width wordmark hangs off both
    // sides of it. On a phone the column is the window, so nothing moves.
    var room = heroColW > 0 ? Math.min(w * 0.84, heroColW * 0.80) : w * 0.84;
    var fit = room / Math.max(1, tctx.measureText(word).width);
    if (fit < 1) { size *= fit; tctx.font = '400 ' + size + 'px "Archivo Black", Arial, sans-serif'; }

    // The name is the only thing in the glass now, so it sits on centre
    // rather than riding high to leave room for a line above it.
    tctx.fillStyle = "#eff0f4";
    tctx.letterSpacing = (size * 0.02) + "px";
    tctx.fillText(word, w / 2, h * 0.5);
    tctx.letterSpacing = "0px";
  }

  /* PHOTO SLOT. Until the hero shot lands this paints a nocturnal falloff
     so the composition can be judged. setHeroPhoto(url) swaps in the real
     file and nothing else has to change. */
  function paintPhoto(w, h) {
    photoCanvas.width = w; photoCanvas.height = h;
    pctx.fillStyle = "#07080a";
    pctx.fillRect(0, 0, w, h);

    if (photoImage) {
      drawHero(w, h);
      return;
    }

    var key = pctx.createRadialGradient(w * 0.6, h * 0.3, 0, w * 0.6, h * 0.3, Math.max(w, h) * 0.8);
    key.addColorStop(0, "rgba(128,154,198,0.30)");
    key.addColorStop(0.42, "rgba(52,66,94,0.12)");
    key.addColorStop(1, "rgba(7,8,10,0)");
    pctx.fillStyle = key;
    pctx.fillRect(0, 0, w, h);

    var rim = pctx.createLinearGradient(0, h, w * 0.42, 0);
    rim.addColorStop(0, "rgba(92,112,152,0.10)");
    rim.addColorStop(1, "rgba(7,8,10,0)");
    pctx.fillStyle = rim;
    pctx.fillRect(0, 0, w, h);

    // putImageData REPLACES pixels rather than compositing, so writing
    // low-alpha noise straight onto the canvas wiped the gradients above
    // and left the hero as full-intensity static. Composite a tile instead.
    if (!grainTile) grainTile = makeGrainTile();
    pctx.save();
    pctx.globalAlpha = 0.05;
    pctx.fillStyle = pctx.createPattern(grainTile, "repeat");
    pctx.fillRect(0, 0, w, h);
    pctx.restore();
  }

  window.setHeroPhoto = function (url) {
    var img = new Image();
    /* No crossOrigin: the photo now ships beside the page rather than as a
       data URI, and it is always same-origin, so asking for a CORS
       handshake only ever fails — notably when the folder is opened from
       disk, where there is no origin to satisfy. If a texture upload ever
       does hit a tainted canvas the frame loop catches it and keeps the
       gradient stand-in, so the object still renders. */
    img.onload = function () { photoImage = img; resize(); kick(); };
    img.onerror = function () { /* keep the gradient stand-in */ };
    img.src = url;
  };

  var VERT = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";

  var FRAG = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;",
    "uniform sampler2D uPhoto; uniform sampler2D uType;",

    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
    "float noise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),",
    "             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);",
    "}",
    "float fbm(vec2 p){",
    "  float v = 0.0, a = 0.5;",
    "  for(int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.02; a *= 0.5; }",
    "  return v;",
    "}",

    "float glass(vec2 uv){",
    "  float cx = 0.5 + uMouse.x * 0.20 + 0.13 * sin(uTime * 0.15);",
    "  float dx = uv.x - cx;",
    "  float w = 0.085",
    "          + 0.045 * fbm(vec2(uv.y * 3.2, uTime * 0.09))",
    "          + 0.018 * sin(uv.y * 11.0 - uTime * 0.35);",
    "  float t = clamp(abs(dx) / w, 0.0, 1.0);",
    "  float lens = sqrt(max(0.0, 1.0 - t * t));",
    "  float ripple = 0.075 * fbm(vec2(uv.x * 5.5, uv.y * 3.2 - uTime * 0.20));",
    "  return lens * (1.0 + ripple);",
    "}",

    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes;",
    "  vec2 px = 1.0 / uRes;",
    "  vec2 flip = vec2(uv.x, 1.0 - uv.y);",

    "  vec3 col = texture2D(uPhoto, flip).rgb;",   // straight. never displaced.

    "  float h = glass(uv);",
    "  float hx = glass(uv + vec2(px.x * 2.0, 0.0)) - glass(uv - vec2(px.x * 2.0, 0.0));",
    "  float hy = glass(uv + vec2(0.0, px.y * 2.0)) - glass(uv - vec2(0.0, px.y * 2.0));",
    "  vec3 n = normalize(vec3(-hx * 34.0, -hy * 34.0, 1.0));",

    "  float amt = 0.030 * h;",
    "  vec2 off = n.xy * amt;",
    "  vec4 sR = texture2D(uType, flip + off * 1.00);",
    "  vec4 sG = texture2D(uType, flip + off * 1.12);",
    "  vec4 sB = texture2D(uType, flip + off * 1.26);",
    "  vec3 typeCol = vec3(sR.r, sG.g, sB.b);",
    "  float ta = max(sR.a, max(sG.a, sB.a));",

    "  col = mix(col, typeCol, ta);",

    // Fresnel rim and specular belong to the column, not to the letters —
    // tying them to the type alpha is what made the glass invisible.
    "  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);",
    "  vec3 spectral = 0.5 + 0.5 * cos(6.28318 * (vec3(0.62, 0.48, 0.36) + n.x * 1.4 + uv.y * 0.4));",
    "  col += spectral * fres * 0.62 * step(0.001, h);",

    "  float spec = pow(max(0.0, dot(n, normalize(vec3(0.42, 0.62, 0.66)))), 26.0);",
    "  col += vec3(0.85, 0.90, 1.0) * spec * 0.5 * step(0.001, h);",

    // A body of glass lights what is behind it. The photograph is still
    // never displaced — only lit — so a face stays sharp.
    "  float body = smoothstep(0.0, 0.35, h);",
    "  col *= 1.0 + 0.42 * body;",
    "  col += vec3(0.055, 0.070, 0.105) * h;",

    "  vec2 d = uv - 0.5;",
    "  col *= 1.0 - 0.50 * dot(d, d);",

    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "uRes"),
      uTime = gl.getUniformLocation(prog, "uTime"),
      uMouse = gl.getUniformLocation(prog, "uMouse");

  function makeTex(unit) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  var photoTex = makeTex(0), typeTex = makeTex(1);
  gl.uniform1i(gl.getUniformLocation(prog, "uPhoto"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uType"), 1);

  var W = 0, H = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width * dpr));
    H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);

    paintPhoto(W, H);
    paintType(W, H);

    /* Opening the folder straight off disk makes every file its own origin,
       which taints the canvas the photo was drawn into and makes the upload
       throw. Dropping the photo and carrying on gives the gradient stand-in
       and a working page, rather than a dead object and a console full of
       errors. Served over http — any host, including a subfolder — this
       never trips. */
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photoCanvas);
    } catch (e) {
      if (photoImage) { photoImage = null; paintPhoto(W, H); }
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photoCanvas); }
      catch (e2) { /* nothing more to try; the object renders untextured */ }
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, typeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, typeCanvas);
  }

  var mx = 0, tmx = 0, my = 0, tmy = 0;
  window.addEventListener("pointermove", function (e) {
    tmx = (e.clientX / window.innerWidth) * 2 - 1;
    tmy = (e.clientY / window.innerHeight) * 2 - 1;
    kick();
  });

  var t0 = performance.now(), running = false;

  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function frame(now) {
    mx += (tmx - mx) * 0.06;
    my += (tmy - my) * 0.06;
    var t = reduced ? 6.0 : (now - t0) / 1000;

    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Under reduced motion the clock is frozen, so once the pointer easing
    // has settled every further frame is an identical image. Stop asking
    // for them rather than holding the GPU awake; input kicks it back.
    if (reduced && Math.abs(tmx - mx) < 0.0005 && Math.abs(tmy - my) < 0.0005) {
      mx = tmx; my = tmy;
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  var resizeQueued = false;
  window.addEventListener("resize", function () {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () { resizeQueued = false; resize(); kick(); });
  });

  // The hero photograph, embedded so the page carries its own assets and
  // makes no third-party request. Sampled straight by the shader — only the
  // type is refracted, so his face stays sharp.
  var HERO_SRC = "media/hero.jpg";

  function start() {
    resize();
    plain.hidden = true;
    kick();
    setHeroPhoto(ROOT + HERO_SRC);
  }

  // Canvas text does not trigger a webfont fetch the way DOM text does.
  // Load the face explicitly or the wordmark silently sets in Arial.
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('400 100px "Archivo Black"'),
      document.fonts.load('600 14px "Archivo"')
    ]).then(start).catch(start);
  } else {
    start();
  }
})();
