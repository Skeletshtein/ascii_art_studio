(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const state = {
    mode: 'text',
    image: null,
    imageName: '',
    text: 'ASCII\nSTUDIO',
    latestRows: [],
    latestTone: [],
    latestPlain: '',
    sourceCanvas: document.createElement('canvas'),
    toastTimeout: null,
    renderTimeout: null,
    cellWidth: 4,
    cellHeight: 8,
  };

  const colors = {
    mint: { hex: '#b7ff64', rgb: [183, 255, 100] },
    green: { hex: '#65ff9b', rgb: [101, 255, 155] },
    blue: { hex: '#78bfff', rgb: [120, 191, 255] },
    pink: { hex: '#ff85d4', rgb: [255, 133, 212] },
    amber: { hex: '#ffc46b', rgb: [255, 196, 107] },
    white: { hex: '#e3f3ff', rgb: [227, 243, 255] },
  };

  const defaults = {
    text: 'ASCII\nSTUDIO', width: 100, brightness: 0, contrast: 100,
    charset: ' .:-=+*#%@', invert: false, glow: true, glowIntensity: 65, color: 'mint',
  };

  const els = {
    textTab: $('#textTab'), imageTab: $('#imageTab'), textPanel: $('#textPanel'), imagePanel: $('#imagePanel'),
    sourceText: $('#sourceText'), textCount: $('#textCount'), imageFile: $('#imageFile'), dropzone: $('#dropzone'),
    dropzoneTitle: $('#dropzoneTitle'), dropzoneSubtitle: $('#dropzoneSubtitle'), fileStatus: $('#fileStatus'),
    widthRange: $('#widthRange'), widthValue: $('#widthValue'), brightnessRange: $('#brightnessRange'), brightnessValue: $('#brightnessValue'),
    contrastRange: $('#contrastRange'), contrastValue: $('#contrastValue'), charsetSelect: $('#charsetSelect'), customCharset: $('#customCharset'),
    invertToggle: $('#invertToggle'), glowToggle: $('#glowToggle'), glowControls: $('#glowControls'), glowRange: $('#glowRange'), glowValue: $('#glowValue'),
    colorSelect: $('#colorSelect'), colorSwatch: $('#colorSwatch'), asciiOutput: $('#asciiOutput'), outputViewport: $('#outputViewport'),
    canvasFrame: $('#canvasFrame'), emptyState: $('#emptyState'), outputDimensions: $('#outputDimensions'), renderStatus: $('#renderStatus'),
    charCount: $('#charCount'), copyButton: $('#copyButton'), downloadTextButton: $('#downloadTextButton'), downloadPngButton: $('#downloadPngButton'),
    resetButton: $('#resetButton'), toast: $('#toast'),
  };

  function getCharset() {
    if (els.charsetSelect.value === 'custom') {
      const custom = [...els.customCharset.value].filter((character) => character !== '\n' && character !== '\r');
      const unique = [...new Set(custom)];
      return unique.length > 1 ? unique.join('') : ' .:-=+*#%@';
    }
    return els.charsetSelect.value || defaults.charset;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 2400);
  }

  function scheduleRender() {
    clearTimeout(state.renderTimeout);
    state.renderTimeout = setTimeout(render, 45);
  }

  function setMode(mode) {
    state.mode = mode;
    const textMode = mode === 'text';
    els.textTab.classList.toggle('active', textMode);
    els.imageTab.classList.toggle('active', !textMode);
    els.textTab.setAttribute('aria-selected', String(textMode));
    els.imageTab.setAttribute('aria-selected', String(!textMode));
    els.textPanel.classList.toggle('hidden', !textMode);
    els.imagePanel.classList.toggle('hidden', textMode);
    els.textPanel.setAttribute('aria-hidden', String(!textMode));
    els.imagePanel.setAttribute('aria-hidden', String(textMode));
    scheduleRender();
  }

  function setFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Обери файл зображення (PNG, JPG, WEBP тощо).');
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      showToast('Файл завеликий. Максимальний розмір — 18 МБ.');
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
      state.imageUrl = imageUrl;
      state.image = image;
      state.imageName = file.name;
      els.dropzoneTitle.textContent = file.name.length > 30 ? file.name.slice(0, 27) + '…' : file.name;
      els.dropzoneSubtitle.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
      els.fileStatus.classList.add('has-file');
      els.fileStatus.innerHTML = '<span class="file-status-dot"></span><span>Зображення готове до конвертації</span>';
      setMode('image');
      showToast('Зображення завантажено — налаштування застосовано.');
      URL.revokeObjectURL(imageUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      showToast('Не вдалося відкрити це зображення. Спробуй інший файл.');
    };
    image.src = imageUrl;
  }

  function canvasSize(columns, aspectRatio) {
    // ASCII-символ зазвичай приблизно вдвічі вищий за свою ширину.
    let rows = Math.max(8, Math.round(columns * aspectRatio / 2));
    rows = Math.min(rows, 150);
    return { columns, rows };
  }

  function prepareCanvas(columns, rows) {
    const canvas = state.sourceCanvas;
    canvas.width = columns * state.cellWidth;
    canvas.height = rows * state.cellHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas, context, width: canvas.width, height: canvas.height };
  }

  function drawTextSource(columns) {
    const lines = (els.sourceText.value || ' ').replace(/\t/g, '    ').split('\n').slice(0, 8);
    const longest = Math.max(1, ...lines.map((line) => [...line].length));
    const roughRatio = Math.max(0.1, lines.length / Math.max(3, longest * 0.58));
    const desiredRatio = Math.min(1.4, Math.max(0.12, roughRatio));
    const size = canvasSize(columns, desiredRatio);
    const { canvas, context } = prepareCanvas(size.columns, size.rows);
    const marginX = canvas.width * 0.06;
    const marginY = canvas.height * 0.12;
    const lineHeight = (canvas.height - marginY * 2) / Math.max(1, lines.length);
    let fontSize = Math.max(7, Math.min(lineHeight * 0.82, (canvas.width - marginX * 2) / (longest * 0.64)));
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    context.font = `800 ${fontSize}px Arial, sans-serif`;
    // Підганяємо шрифт, щоб навіть довгий напис помістився в полотно.
    while (fontSize > 5 && Math.max(...lines.map((line) => context.measureText(line || ' ').width)) > canvas.width - marginX * 2) {
      fontSize -= 1;
      context.font = `800 ${fontSize}px Arial, sans-serif`;
    }
    const actualLineHeight = Math.min(lineHeight, fontSize * 1.18);
    const totalTextHeight = actualLineHeight * lines.length;
    const startY = (canvas.height - totalTextHeight) / 2 + actualLineHeight / 2;
    lines.forEach((line, index) => {
      context.fillText(line, canvas.width / 2, startY + index * actualLineHeight, canvas.width - marginX * 2);
    });
    return { canvas, columns: size.columns, rows: size.rows };
  }

  function drawImageSource(columns) {
    const image = state.image;
    const aspect = image.naturalHeight / Math.max(1, image.naturalWidth);
    const size = canvasSize(columns, aspect);
    const { canvas, context } = prepareCanvas(size.columns, size.rows);
    // Вписуємо картинку без спотворення пропорцій.
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return { canvas, columns: size.columns, rows: size.rows };
  }

  function charForTone(tone, charset, invert) {
    const brightness = Math.max(0, Math.min(255, tone));
    let level = Math.round((brightness / 255) * (charset.length - 1));
    if (invert) level = charset.length - 1 - level;
    return charset[level] || ' ';
  }

  function analyzeCanvas(source) {
    const { canvas, columns, rows } = source;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const brightnessShift = Number(els.brightnessRange.value) * 1.28;
    const contrast = Number(els.contrastRange.value) / 100;
    const charset = getCharset();
    const invert = els.invertToggle.checked;
    const results = [];
    const tones = [];
    let plain = '';

    for (let y = 0; y < rows; y++) {
      const row = [];
      const toneRow = [];
      for (let x = 0; x < columns; x++) {
        const startX = x * state.cellWidth;
        const startY = y * state.cellHeight;
        let weightedSum = 0;
        let pixelCount = 0;
        for (let dy = 0; dy < state.cellHeight; dy++) {
          let pixelIndex = ((startY + dy) * canvas.width + startX) * 4;
          for (let dx = 0; dx < state.cellWidth; dx++, pixelIndex += 4) {
            const r = pixels[pixelIndex];
            const g = pixels[pixelIndex + 1];
            const b = pixels[pixelIndex + 2];
            const alpha = pixels[pixelIndex + 3] / 255;
            // Перцептивна яскравість з урахуванням прозорості.
            weightedSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * alpha;
            pixelCount++;
          }
        }
        const original = weightedSum / Math.max(1, pixelCount);
        let tone = (original - 127.5) * contrast + 127.5 + brightnessShift;
        tone = Math.max(0, Math.min(255, tone));
        const mappedTone = invert ? 255 - tone : tone;
        row.push(charForTone(tone, charset, invert));
        toneRow.push(mappedTone / 255);
      }
      results.push(row);
      tones.push(toneRow);
      plain += row.join('') + (y < rows - 1 ? '\n' : '');
    }
    return { rows: results, tones, plain, columns, rowCount: rows };
  }

  function colorForTone(tone) {
    const base = colors[els.colorSelect.value] || colors.mint;
    const brightness = 0.18 + Math.max(0, Math.min(1, tone)) * 0.82;
    return `rgb(${Math.round(base.rgb[0] * brightness)}, ${Math.round(base.rgb[1] * brightness)}, ${Math.round(base.rgb[2] * brightness)})`;
  }

  function drawOutput(result) {
    const fragment = document.createDocumentFragment();
    const glow = els.glowToggle.checked;
    const intensity = Number(els.glowRange.value) / 100;
    const baseColor = colors[els.colorSelect.value] || colors.mint;
    const output = els.asciiOutput;
    output.replaceChildren();
    output.classList.toggle('led-mode', glow && intensity > 0);
    output.style.setProperty('--glow-color', baseColor.hex);
    output.style.setProperty('--glow-blur', `${Math.round(1 + intensity * 7)}px`);
    output.style.color = baseColor.hex;

    result.rows.forEach((row, y) => {
      row.forEach((character, x) => {
        const tone = result.tones[y][x];
        const span = document.createElement('span');
        span.className = 'cell ' + (tone > 0.18 ? 'lit' : 'dim');
        span.textContent = character === ' ' ? '\u00a0' : character;
        if (glow) {
          span.style.color = colorForTone(tone);
          span.style.textShadow = tone > 0.22 && intensity > 0
            ? `0 0 ${Math.max(1, intensity * 5)}px ${baseColor.hex}${Math.round(35 + intensity * 80).toString(16).padStart(2, '0')}`
            : 'none';
        } else {
          span.style.color = baseColor.hex;
          span.style.textShadow = 'none';
          span.style.opacity = String(0.35 + tone * 0.65);
        }
        fragment.appendChild(span);
      });
      if (y < result.rows.length - 1) fragment.appendChild(document.createTextNode('\n'));
    });
    output.appendChild(fragment);
    els.emptyState.classList.add('hidden');
    els.outputViewport.classList.remove('hidden');
    els.outputDimensions.textContent = `${result.columns} × ${result.rowCount}`;
    els.charCount.textContent = `${(result.columns * result.rowCount).toLocaleString('uk-UA')} символів`;
    els.renderStatus.textContent = els.glowToggle.checked ? 'Світіння активне · готово' : 'Візуалізацію оновлено';
    state.latestRows = result.rows;
    state.latestTone = result.tones;
    state.latestPlain = result.plain;
    state.latestResult = result;
  }

  function render() {
    updateValues();
    const columns = Number(els.widthRange.value);
    let source;
    if (state.mode === 'image') {
      if (!state.image) {
        els.asciiOutput.replaceChildren();
        els.emptyState.classList.remove('hidden');
        els.outputDimensions.textContent = '— × —';
        els.charCount.textContent = '0 символів';
        els.renderStatus.textContent = 'Очікує зображення';
        state.latestPlain = '';
        return;
      }
      source = drawImageSource(columns);
    } else {
      source = drawTextSource(columns);
    }
    const result = analyzeCanvas(source);
    drawOutput(result);
  }

  function updateValues() {
    els.textCount.textContent = `${[...els.sourceText.value].length} / 120`;
    els.widthValue.textContent = `${els.widthRange.value} символів`;
    els.brightnessValue.textContent = `${Number(els.brightnessRange.value) > 0 ? '+' : ''}${els.brightnessRange.value}`;
    els.contrastValue.textContent = `${els.contrastRange.value}%`;
    els.glowValue.textContent = `${els.glowRange.value}%`;
    els.glowControls.classList.toggle('disabled', !els.glowToggle.checked);
    const color = colors[els.colorSelect.value] || colors.mint;
    els.colorSwatch.style.background = color.hex;
    els.colorSwatch.style.color = color.hex;
  }

  function copyText() {
    if (!state.latestPlain) { showToast('Спочатку створи ASCII-art.'); return; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(state.latestPlain).then(() => showToast('ASCII-art скопійовано в буфер обміну.')).catch(() => fallbackCopy());
    } else fallbackCopy();
  }

  function fallbackCopy() {
    const textarea = document.createElement('textarea');
    textarea.value = state.latestPlain;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      showToast(ok ? 'ASCII-art скопійовано в буфер обміну.' : 'Не вдалося скопіювати. Скористайся файлом TXT.');
    } catch {
      showToast('Не вдалося скопіювати. Скористайся файлом TXT.');
    } finally { textarea.remove(); }
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(name) {
    return (name || 'ascii-art').replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'ascii-art';
  }

  function downloadText() {
    if (!state.latestPlain) { showToast('Спочатку створи ASCII-art.'); return; }
    const blob = new Blob([state.latestPlain], { type: 'text/plain;charset=utf-8' });
    saveBlob(blob, `${state.mode === 'image' ? safeFilename(state.imageName) : 'ascii-art'}.txt`);
    showToast('TXT-файл підготовлено.');
  }

  function drawPngCell(context, character, tone, x, y, fontSize, options) {
    const { color, glow, intensity, cellWidth, cellHeight } = options;
    if (character === ' ') return;
    const brightness = 0.18 + tone * 0.82;
    const rgb = color.rgb.map((part) => Math.round(part * brightness));
    context.font = `500 ${fontSize}px "DM Mono", Consolas, monospace`;
    context.textBaseline = 'top';
    context.textAlign = 'left';
    context.fillStyle = `rgb(${rgb.join(',')})`;
    if (glow && intensity > 0 && tone > 0.18) {
      context.shadowColor = color.hex;
      context.shadowBlur = intensity * 9;
    } else {
      context.shadowBlur = 0;
    }
    context.fillText(character, x, y, cellWidth + 1);
    context.shadowBlur = 0;
  }

  function downloadPng() {
    const result = state.latestResult;
    if (!result) { showToast('Спочатку створи ASCII-art.'); return; }
    const fontSize = 13;
    const cellWidth = 8.05;
    const cellHeight = 15.7;
    const padding = 38;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(360, Math.ceil(result.columns * cellWidth + padding * 2));
    canvas.height = Math.max(180, Math.ceil(result.rowCount * cellHeight + padding * 2));
    const context = canvas.getContext('2d');
    context.fillStyle = '#05080b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Делікатна сітка на фоні, як на полотні перегляду.
    context.strokeStyle = 'rgba(101,127,143,.055)';
    context.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 22) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke(); }
    for (let y = 0; y < canvas.height; y += 22) { context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke(); }
    const options = {
      color: colors[els.colorSelect.value] || colors.mint,
      glow: els.glowToggle.checked,
      intensity: Number(els.glowRange.value) / 100,
      cellWidth, cellHeight,
    };
    result.rows.forEach((row, y) => {
      row.forEach((character, x) => drawPngCell(context, character, result.tones[y][x], padding + x * cellWidth, padding + y * cellHeight, fontSize, options));
    });
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Не вдалося створити PNG. Спробуй меншу ширину.'); return; }
      saveBlob(blob, `${state.mode === 'image' ? safeFilename(state.imageName) : 'ascii-art'}.png`);
      showToast('PNG із поточними кольорами підготовлено.');
    }, 'image/png');
  }

  function resetSettings() {
    els.sourceText.value = defaults.text;
    els.widthRange.value = defaults.width;
    els.brightnessRange.value = defaults.brightness;
    els.contrastRange.value = defaults.contrast;
    els.charsetSelect.value = defaults.charset;
    els.customCharset.value = '';
    els.customCharset.classList.add('hidden');
    els.invertToggle.checked = defaults.invert;
    els.glowToggle.checked = defaults.glow;
    els.glowRange.value = defaults.glowIntensity;
    els.colorSelect.value = defaults.color;
    updateValues();
    render();
    showToast('Налаштування скинуто до початкових.');
  }

  // Перемикання режимів і введення даних.
  els.textTab.addEventListener('click', () => setMode('text'));
  els.imageTab.addEventListener('click', () => setMode('image'));
  els.sourceText.addEventListener('input', () => {
    state.text = els.sourceText.value;
    scheduleRender();
  });
  els.imageFile.addEventListener('change', (event) => setFile(event.target.files && event.target.files[0]));
  els.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); els.imageFile.click(); }
  });
  ['dragenter', 'dragover'].forEach((eventName) => els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault(); els.dropzone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((eventName) => els.dropzone.addEventListener(eventName, (event) => {
    event.preventDefault(); els.dropzone.classList.remove('dragover');
  }));
  els.dropzone.addEventListener('drop', (event) => setFile(event.dataTransfer && event.dataTransfer.files[0]));

  [els.widthRange, els.brightnessRange, els.contrastRange, els.invertToggle, els.glowToggle, els.glowRange, els.colorSelect].forEach((control) => {
    control.addEventListener('input', scheduleRender);
    control.addEventListener('change', scheduleRender);
  });
  els.charsetSelect.addEventListener('change', () => {
    els.customCharset.classList.toggle('hidden', els.charsetSelect.value !== 'custom');
    scheduleRender();
  });
  els.customCharset.addEventListener('input', scheduleRender);
  els.copyButton.addEventListener('click', copyText);
  els.downloadTextButton.addEventListener('click', downloadText);
  els.downloadPngButton.addEventListener('click', downloadPng);
  els.resetButton.addEventListener('click', resetSettings);

  // Підтримка вставлення скопійованого зображення з буфера обміну.
  document.addEventListener('paste', (event) => {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { setFile(file); break; }
      }
    }
  });

  updateValues();
  render();
})();
