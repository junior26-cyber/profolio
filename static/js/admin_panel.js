(function () {
  function parseJson(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || "");
    } catch (_) {
      return fallback;
    }
  }

  function animateCounters() {
    document.querySelectorAll(".kpi-value[data-count], .kpi-value[data-float]").forEach((el) => {
      const integerTarget = Number(el.getAttribute("data-count"));
      const floatTarget = Number(el.getAttribute("data-float"));
      const isFloat = Number.isFinite(floatTarget) && !Number.isFinite(integerTarget);
      const target = isFloat ? floatTarget : integerTarget;
      if (!Number.isFinite(target)) return;

      const duration = 800;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = target * eased;
        el.textContent = isFloat ? value.toFixed(2) : String(Math.round(value));
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function makePolyline(values, width, height, padding) {
    const max = Math.max(...values, 1);
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;
    return values
      .map((v, i) => {
        const x = padding + (innerW * i) / Math.max(values.length - 1, 1);
        const y = padding + innerH - (v / max) * innerH;
        return `${x},${y}`;
      })
      .join(" ");
  }

  function renderChart() {
    const svg = document.getElementById("activityChart");
    if (!svg) return;

    const labels = parseJson("chartLabels", []);
    const users = parseJson("chartUsers", []);
    const resumes = parseJson("chartResumes", []);
    const letters = parseJson("chartLetters", []);

    const width = 760;
    const height = 280;
    const pad = 28;

    const all = [...users, ...resumes, ...letters];
    const max = Math.max(...all, 1);

    const ns = "http://www.w3.org/2000/svg";
    for (let i = 0; i <= 4; i += 1) {
      const y = pad + ((height - pad * 2) * i) / 4;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(pad));
      line.setAttribute("x2", String(width - pad));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", "rgba(160,194,224,.2)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", "4");
      label.setAttribute("y", String(y + 4));
      label.setAttribute("fill", "#98b8d6");
      label.setAttribute("font-size", "11");
      label.textContent = String(Math.round(max - (max * i) / 4));
      svg.appendChild(label);
    }

    function drawSeries(values, color) {
      const path = document.createElementNS(ns, "polyline");
      path.setAttribute("points", makePolyline(values, width, height, pad));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "3");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.style.strokeDasharray = "1200";
      path.style.strokeDashoffset = "1200";
      path.style.animation = "dash 1s ease forwards";
      svg.appendChild(path);
    }

    drawSeries(users, "#41c6ff");
    drawSeries(resumes, "#27e0b0");
    drawSeries(letters, "#ffc658");

    labels.forEach((labelText, i) => {
      const x = pad + ((width - pad * 2) * i) / Math.max(labels.length - 1, 1);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", String(x));
      text.setAttribute("y", String(height - 5));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#9ab8d5");
      text.setAttribute("font-size", "11");
      text.textContent = labelText;
      svg.appendChild(text);
    });
  }

  const style = document.createElement("style");
  style.textContent = "@keyframes dash{to{stroke-dashoffset:0}}";
  document.head.appendChild(style);

  animateCounters();
  renderChart();
})();
