// Apex — terminal view: xterm mount + estimate-fit + theme-token mapping
// for PTY seats (R25). Vendored xterm 6.0.0 supplies window.Terminal.
// (Resident-Qwen implement-from-spec, offload-log row #8; verified + debounce
// and cell-height fixes from frontier review.)
'use strict';
(function() {
  const attach = (opts) => {
    const { container, post, seatId, themeVars } = opts;
    const theme = {
      background: themeVars.bg,
      foreground: themeVars.text,
      cursor: themeVars.accent,
      selectionBackground: themeVars.accent + '55',   // visible selection (copy needs to be seen)
      black: themeVars.surface,
      red: themeVars.critical,
      green: themeVars.good,
      yellow: themeVars.warning,
      blue: themeVars.accent,
      // TUIs draw dim chrome (and often their own caret) in brightBlack —
      // faint (#4a4560) vanished on the dark bg; lift it to stay legible
      brightBlack: '#8a84a8',
      white: themeVars.text,
      brightWhite: themeVars.text
    };
    theme.cursor = themeVars.accent;
    theme.cursorAccent = themeVars.bg;   // glyph under the block cursor stays legible
    const terminal = new window.Terminal({
      fontFamily: 'Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'block',              // a cursor you can actually SEE (the operator)
      cursorInactiveStyle: 'block',      // and see even when focus is elsewhere
      allowProposedApi: true,
      scrollback: 5000,
      theme
    });
    terminal.open(container);
    let lastCols = 0, lastRows = 0;
    let probe = null;
    let fitT = null;
    const observer = new ResizeObserver(() => { clearTimeout(fitT); fitT = setTimeout(() => fit(), 150); });
    observer.observe(container);
    // Cell size: after the first render, xterm's own screen element tells the
    // TRUTH (rect / rows). The probe estimate over-counted rows, clipping the
    // TUI's bottom lines — cursor and input row rendered past the pane edge.
    const cellSize = () => {
      const screen = container.querySelector('.xterm-screen');
      if (screen && terminal.rows > 0 && terminal.cols > 0) {
        const r = screen.getBoundingClientRect();
        if (r.height > 10) return { w: r.width / terminal.cols, h: r.height / terminal.rows };
      }
      if (!probe) {
        probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;visibility:hidden;font:13px Consolas,monospace;line-height:1;white-space:pre;';
        probe.textContent = 'W'.repeat(10);
        container.appendChild(probe);
      }
      return { w: probe.clientWidth / 10, h: probe.clientHeight * 1.2 };
    };
    const fit = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      const { w, h } = cellSize();
      const cols = Math.max(2, Math.floor((clientWidth - 8) / w));
      const rows = Math.max(2, Math.floor(clientHeight / h));
      if (cols !== lastCols || rows !== lastRows) {
        terminal.resize(cols, rows);
        post({ type: 'seatPtyResize', id: seatId, cols, rows });
        lastCols = cols;
        lastRows = rows;
        // measured-cell correction pass: the first fit used the estimate;
        // re-fit once against the real render (converges immediately)
        requestAnimationFrame(() => {
          const real = cellSize();
          if (Math.abs(real.h - h) > 0.5 || Math.abs(real.w - w) > 0.2) fit();
        });
      }
    };
    terminal.onData(data => post({ type: 'seatPtyInput', id: seatId, data }));

    // Clipboard, the way hands expect it (the operator):
    //   highlight        = copied automatically (classic terminal select-copy)
    //   Ctrl+C           = copy IF something is selected, else SIGINT to the TUI
    //   Ctrl+V / Ctrl+Shift+V = paste
    //   right-click      = copy if selected, else paste
    terminal.onSelectionChange(() => {
      const s = terminal.getSelection();
      if (s) apex.clipboard.write(s).catch(() => {});
    });
    terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true;
      if (e.ctrlKey && e.code === 'KeyC') {
        const sel = terminal.getSelection();
        if (sel) {
          apex.clipboard.write(sel).catch(() => {});
          terminal.clearSelection();
          return false;
        }
        return !e.shiftKey;   // bare Ctrl+C with no selection = the TUI's interrupt
      }
      // Ctrl+V: xterm's own key handling turns it into a control byte (\x16)
      // and preventDefaults — killing the browser's native paste. Returning
      // false here skips xterm's handling so the native paste lands, ONCE.
      // (Pasting ourselves too = double; letting xterm have it = none.)
      if (e.ctrlKey && e.code === 'KeyV') return false;
      return true;
    });
    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const sel = terminal.getSelection();
      if (sel) {
        apex.clipboard.write(sel).catch(() => {});
        terminal.clearSelection();
      } else {
        apex.clipboard.read().then((t) => { if (t) terminal.paste(t); }).catch(() => {});
      }
    });
    fit();
    return {
      write(data) { terminal.write(data); },
      fit,
      focus() { terminal.focus(); },
      reset() { terminal.reset(); },
      setLive() { terminal.options.cursorBlink = true; },
      setDead() { terminal.options.cursorBlink = false; },
      dispose() {
        observer.disconnect();
        terminal.dispose();
      }
    };
  };
  window.ApexTermView = attach;
})();
