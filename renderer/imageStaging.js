// Apex — composer image staging (paste/drop, thumbs, 4MB cap, base64 blocks
// for seatSend — J19 semantics). Local-user input only, no model output.
// (Resident-Qwen implement-from-spec, offload-log row #7; verified + null-file
// guard added during frontier review.)
'use strict';
window.ApexImageStaging = (function() {
  function attach(opts) {
    const textarea = opts.textarea;
    const stageRow = opts.stageRow;
    const onChange = opts.onChange || function() {};
    const staged = [];

    function handleFiles(files) {
      Array.from(files).filter(Boolean).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        if (file.size > 4 * 1024 * 1024) {
          window.ApexToast && ApexToast('image too large (4MB cap): ' + file.name);
          return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
          const dataUrl = e.target.result;
          const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
          if (!match) return;
          const mediaType = match[1];
          const data = match[2];
          const entry = { mediaType, data };
          staged.push(entry);
          const div = document.createElement('div');
          div.className = 'stagedImg';
          const img = document.createElement('img');
          img.src = dataUrl;
          // click = inspect what you actually pasted (the operator, 2026-07-14) —
          // renders big in the VIEWER tab before it gets sent anywhere
          img.style.cursor = 'zoom-in';
          img.title = 'click to inspect in the Viewer tab';
          img.onclick = function() {
            if (window.ApexViewer) ApexViewer.show({ kind: 'img', uri: dataUrl,
              name: (file.name || 'pasted image') + ' (staged — not sent yet)' });
            if (window.ApexShell) ApexShell.openDock('viewer');
          };
          const btn = document.createElement('button');
          btn.title = 'remove';
          btn.textContent = '✕';
          btn.onclick = function() {
            const index = staged.indexOf(entry);
            if (index === -1) return;
            staged.splice(index, 1);
            div.remove();
            onChange(staged.length);
          };
          div.appendChild(img);
          div.appendChild(btn);
          stageRow.appendChild(div);
          onChange(staged.length);
        };
        reader.readAsDataURL(file);
      });
    }

    textarea.addEventListener('paste', function(e) {
      const items = e.clipboardData.items;
      if (!items) return;
      const files = Array.from(items).filter(item => item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
      if (files.length === 0) return;
      e.preventDefault();
      handleFiles(files);
    });

    [textarea, stageRow].forEach(el => {
      el.addEventListener('dragover', e => e.preventDefault());
      el.addEventListener('drop', e => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      });
    });

    return {
      list() {
        return staged.slice();
      },
      clear() {
        staged.length = 0;
        stageRow.innerHTML = '';
        onChange(0);
      },
      count() {
        return staged.length;
      }
    };
  }

  return attach;
})();
