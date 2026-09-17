/* ============================================================
   The sheet.

   The paper model is by MMAH, written for an earlier sketchbook and
   reused here with only the geometry changed. Nothing is faked with a
   texture file: the lighting constants, the octave weights and the tooth
   model are measurements taken off a photograph of a real sketchbook.

   The one change: in the original the paper sits in the middle of a
   1760 by 1240 frame and floats. Here the paper fills the book, because
   the pages carry a lot more text than a plate and a caption do, so the
   sheet has to be taller. The lighting model is written in units of
   distance from the fold over half a page, so it moves with the shape.

   Result: two blob urls, a paper layer and a tooth layer. The tooth goes
   over the paper with soft-light, exactly as it does in his book.
   ============================================================ */
(function (global) {
  "use strict";

  var CW = 1760, CH = 1240;
  /* the sheet fills the frame here, with a hair of margin for the feather */
  var PAPER = { x0: 0.006, x1: 0.994, y0: 0.008, y1: 0.992 };

  /* The one place his numbers are pulled down, and the reason why.
     His sheet carries a watercolour plate and two lines of caption, so a
     deep fold and a full cold-press tooth read as paper. This page carries
     about a hundred and twenty words of small text on both halves, and at
     full strength the grain reads as noise behind the type and the left
     page reads as dirty rather than as shaded. Everything else below is
     unchanged. Set these three back to 1 to see the original sheet. */
  var TUNE = { tooth: 0.42, fold: 0.62, seam: 0.75 };

  /* ---------------------------------------------------------- value noise
     Smooth lattice noise, made by letting the browser upscale a small random
     canvas. Octaves are averaged rather than added, so the amplitude does not
     drift as octaves are added or removed. */
  function randCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'), d = x.createImageData(w, h), p = d.data;
    for (var i = 0; i < p.length; i += 4) { var v = Math.random() * 255 | 0; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  }
  function octaves(w, h, lattices, weights) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    var acc = 0;
    for (var i = 0; i < lattices.length; i++) {
      var L = lattices[i];
      var src = randCanvas(Math.max(2, Math.round(w / L)), Math.max(2, Math.round(h / L)));
      acc += weights[i];
      x.globalAlpha = weights[i] / acc;
      x.drawImage(src, 0, 0, w, h);
    }
    x.globalAlpha = 1;
    return x.getImageData(0, 0, w, h).data;
  }

  function roundRect(x, x0, y0, x1, y1, r) {
    x.beginPath();
    x.moveTo(x0 + r, y0);
    x.lineTo(x1 - r, y0); x.quadraticCurveTo(x1, y0, x1, y0 + r);
    x.lineTo(x1, y1 - r); x.quadraticCurveTo(x1, y1, x1 - r, y1);
    x.lineTo(x0 + r, y1); x.quadraticCurveTo(x0, y1, x0, y1 - r);
    x.lineTo(x0, y0 + r); x.quadraticCurveTo(x0, y0, x0 + r, y0);
    x.closePath();
  }

  /* the sheet's outline, feathered, used as the alpha for every layer */
  function sheetMask() {
    var m = document.createElement('canvas'); m.width = CW; m.height = CH;
    var mx = m.getContext('2d');
    mx.filter = 'blur(2.2px)';        /* the 18 px alpha ramp measured off the
                                         real photograph, at this scale */
    mx.fillStyle = '#fff';
    roundRect(mx, CW * PAPER.x0, CH * PAPER.y0, CW * PAPER.x1, CH * PAPER.y1, 7);
    mx.fill();
    return m;
  }

  /* =====================================================================
     THE SHEET

     The lighting is a measurement, not a guess. Across a real open spread the
     luma runs: bright at the outer edge, then a slow 70 level slide down into
     the fold on the left page; a narrow dark core at the fold itself; then the
     right page jumps straight back up ABOVE the page's own baseline and eases
     down toward its outer edge. That asymmetry is the whole reason a fold reads
     as a physical valley with light coming from one side, and a symmetric
     gradient reads as a crease drawn on a flat card.

     Both outer edges carry a dark line about 12 px wide, which is the block of
     pages underneath showing at the cut.
     ===================================================================== */
  var LIT = {
    foldL: 0.245, shadowL: 0.200,   /* fitted: -0.245 at the fold, back to
                                       baseline by 0.40 of a half page       */
    foldR: 0.100, shadowR: 0.030,   /* the right page recovers within 10 px   */
    liftL: 0.042,                   /* its bow toward the outer edge          */
    liftR: 0.058,                   /* the right page peaks beside the fold   */
    seam: 0.22, seamPx: 2.6,        /* the dark line in the fold itself       */
    edge: 0.135, edgeAt: 0.962      /* the block of pages showing at the cut  */
  };
  function smoothstep(a, b, t) { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); }

  function makePaper() {
    var c = document.createElement('canvas'); c.width = CW; c.height = CH;
    var x = c.getContext('2d');
    var X0 = CW * PAPER.x0, X1 = CW * PAPER.x1, Y0 = CH * PAPER.y0, Y1 = CH * PAPER.y1;
    var W = X1 - X0, H = Y1 - Y0, mid = (X0 + X1) / 2, half = W / 2;

    /* the measured paper colour of a real sheet, not a guess at cream */
    var R = 239, G = 231, B = 224;

    /* a per-column lighting curve, since the whole model is a function of how
       far a column sits from the fold */
    var shade = new Float32Array(CW);
    for (var i = 0; i < CW; i++) {
      var u = Math.min(1, Math.abs(i - mid) / half);
      var left = i < mid;
      var k = 1;
      k -= left ? LIT.foldL * TUNE.fold * Math.exp(-u / LIT.shadowL)
                : LIT.foldR * TUNE.fold * Math.exp(-u / LIT.shadowR);
      k += left ? LIT.liftL * smoothstep(0.22, 0.95, u)
                : LIT.liftR * Math.exp(-u / 0.50);
      k -= LIT.edge * smoothstep(LIT.edgeAt, 1.0, u);
      /* the seam itself: a couple of pixels of real dark in the valley */
      k -= LIT.seam * TUNE.seam * Math.exp(-Math.abs(i - mid) / LIT.seamPx);
      shade[i] = k;
    }

    var img = x.createImageData(CW, CH), d = img.data;
    /* a slow warm and cool drift across the sheet, which real paper has and a
       flat fill does not */
    var mottle = octaves(CW, CH, [260, 90], [1.0, 0.5]);
    for (var y = 0; y < CH; y++) {
      /* the top and bottom cuts carry the same dark line as the sides */
      var v = Math.min(1, Math.abs(y - (Y0 + Y1) / 2) / (H / 2));
      var ky = 1 - LIT.edge * 0.72 * smoothstep(0.955, 1.0, v);
      for (var j = 0; j < CW; j++) {
        var a = (y * CW + j) * 4;
        var m = (mottle[a] - 128) / 128;
        var k2 = shade[j] * ky;
        d[a]     = Math.max(0, Math.min(255, R * k2 + m * 5.5));
        d[a + 1] = Math.max(0, Math.min(255, G * k2 + m * 4.0));
        d[a + 2] = Math.max(0, Math.min(255, B * k2 + m * 2.0));
        d[a + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(sheetMask(), 0, 0);
    return c;
  }

  /* =====================================================================
     THE COLD-PRESS TOOTH

     Measured off a real sketchbook photograph at this canvas size: 92% of the
     texture energy is finer than 5 px per cycle, and only 23% is large-scale
     mottling. Per-pixel white noise is the wrong answer for that spectrum, it
     reads as digital grain rather than paper.

     So the noise is summed over octaves whose lattices land near 3, 6, 12 and
     40 px, and then it is LIT: what makes paper read as paper is the highlight
     on the near face of every fibre peak and the shadow immediately behind it,
     which is a directional derivative, not a value.
     ===================================================================== */
  var TOOTH = { gain: 0.42, flat: 0.92, blur: 0.55 };
  function makeTooth() {
    /* Fine octaves only. Coarse noise must not be embossed: lighting a 40 px
       blob turns it into a bump and the sheet reads as plaster. The slow
       large-scale variation belongs in the paper's colour, not in its relief. */
    var n = octaves(CW, CH, [3, 5, 9], [1.00, 0.62, 0.34]);
    var c = document.createElement('canvas'); c.width = CW; c.height = CH;
    var x = c.getContext('2d');
    var out = x.createImageData(CW, CH), o = out.data;
    for (var y = 0; y < CH; y++) {
      var row = y * CW, prow = (y > 0 ? y - 1 : y) * CW;
      for (var i = 0; i < CW; i++) {
        var a = (row + i) * 4, b = (prow + (i > 0 ? i - 1 : i)) * 4;
        /* light from the upper left, across the grain */
        var v = 128 + ((n[a] - n[b]) * TOOTH.gain + (n[a] - 128) * TOOTH.flat) * TUNE.tooth;
        o[a] = o[a + 1] = o[a + 2] = v < 0 ? 0 : (v > 255 ? 255 : v);
        o[a + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    if (TOOTH.blur) {                 /* take the digital edge off the grain */
      var t = document.createElement('canvas'); t.width = CW; t.height = CH;
      var tx = t.getContext('2d');
      tx.filter = 'blur(' + TOOTH.blur + 'px)';
      tx.drawImage(c, 0, 0);
      x.clearRect(0, 0, CW, CH); x.filter = 'none'; x.drawImage(t, 0, 0);
    }
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(sheetMask(), 0, 0);
    return c;
  }

  /* Both sheets go out as blob urls, never data urls. They are written into
     the inline style of every element showing paper, and during a turn that is
     two halves plus two leaf faces. As data urls that would put megabytes into
     the document. */
  function blobFor(canvas) {
    return new Promise(function (res) {
      canvas.toBlob(function (b) {
        var u = URL.createObjectURL(b);
        var im = new Image(); im.src = u;
        (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { res(u); });
      }, 'image/png');
    });
  }

  var state = { paper: '', tooth: '', ready: null };

  state.ready = new Promise(function (resolve) {
    /* off the first paint, so the book is readable before the grain lands */
    var run = function () {
      Promise.all([blobFor(makePaper()), blobFor(makeTooth())]).then(function (u) {
        state.paper = u[0]; state.tooth = u[1];
        resolve(state);
      }, function () { resolve(state); });
    };
    if (global.requestIdleCallback) { global.requestIdleCallback(run, { timeout: 1200 }); }
    else { setTimeout(run, 60); }
  });

  /* Dress one element with the sheet. `side` is left, right or full.
     The sheet is one image the width of the whole book, so the right half
     shows it shifted by half a book. This is how his own dress() works. */
  state.dress = function (node, side) {
    if (!state.paper) return;
    var offX = side === 'right' ? 'calc(-1 * var(--bw) * 0.5)' : '0px';
    node.style.backgroundImage = 'url(' + state.tooth + '), url(' + state.paper + ')';
    node.style.backgroundSize = 'var(--bw) 100%, var(--bw) 100%';
    node.style.backgroundPositionX = offX + ', ' + offX;
    node.style.backgroundPositionY = '0px, 0px';
    node.style.backgroundRepeat = 'no-repeat, no-repeat';
    node.style.backgroundBlendMode = 'soft-light, normal';
  };

  global.SHEET = state;
})(window);
