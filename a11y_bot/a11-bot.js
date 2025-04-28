// A11Y Bot: Puppeteer + axe-core + PDF Report + AI Suggestions + Focus Trap Check

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');
const { simulateFocusTrap } = require('./checks/focusTrapCheck');

const args = process.argv.slice(2);
const targetURL = args[0] || "https://example.com";

function sanitizeText(input) {
  if (typeof input !== 'string') {
    try {
      input = JSON.stringify(input);
    } catch (e) {
      input = String(input);
    }
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // remove hidden chars
}

// Basic function
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    console.log(`Opening a page: ${targetURL}`);
    await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log(`Scan with axe-core...`);
    const axeResults = await new AxePuppeteer(page).analyze();

    console.log(`Harvest AI suggestions...`);
    const aiSuggestions = await getAISuggestions(page);

    console.log(`Testing focus-trap...`);
    const focusTrapResults = await simulateFocusTrap(page);

    console.log(`Generating a report...`);
    const reportHTML = await generateReport(targetURL, axeResults, aiSuggestions, focusTrapResults);

    console.log(`Generating PDF...`);
    await generatePDF(targetURL, reportHTML);

    console.log("Completed!");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await browser.close();
  }
})();

// Funkcija: Savāc AI ieteikumus no lapas
async function getAISuggestions(page) {
  return await page.evaluate(() => {
    const suggestions = [];
    const aria = [];
    const contrast = [];

    // Alt teksti
    document.querySelectorAll('img').forEach((img, i) => {
      const src = img.getAttribute('src') || "";
      const alt = img.getAttribute('alt') || "";
      if (!alt || /^(image|img|photo|picture)[0-9]*$/i.test(alt)) {
        suggestions.push(`🧠 AI ieteikums attēlam #${i + 1}: Alt teksts '${alt}' nav aprakstošs. Ieteikums: 'Attēlā redzams objekts no '${src}'.`);
      }
    });

    // ARIA lomas
    document.querySelectorAll('[role]').forEach((el) => {
      const role = el.getAttribute('role');
      if (!/^(button|navigation|main|dialog|alert|checkbox|tab|tooltip)$/.test(role)) {
        aria.push(`⚠️ AI ieteikums: Nestandarta ARIA loma '<b>${role}</b>' elementam <${el.tagName.toLowerCase()}>.`);
      }
    });

    // Kontrasts
    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const fg = style.color;
      const bg = style.backgroundColor;

      function parseRGB(color) {
        const match = color.match(/rgba?\((\d+), (\d+), (\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
      }

      function luminance([r, g, b]) {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      function contrastRatio(rgb1, rgb2) {
        const lum1 = luminance(rgb1);
        const lum2 = luminance(rgb2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      }

      const fgRGB = parseRGB(fg);
      const bgRGB = parseRGB(bg);

      if (fgRGB && bgRGB) {
        const ratio = contrastRatio(fgRGB, bgRGB);
        if (ratio < 4.5) {
          contrast.push(`⚠️ AI ieteikums: Zems kontrasts (${ratio.toFixed(2)}:1) starp tekstu <b>${fg}</b> un fonu <b>${bg}</b> elementam <${el.tagName.toLowerCase()}>.`);
        }
      }
    });

    return { suggestions, aria, contrast };
  });
}

// Funkcija: Izveido HTML atskaiti
async function generateReport(url, axeResults, aiSuggestions, focusTrapResults) {
  console.log("DEBUG: Ieslēdzas generateReport()");
  console.log("DEBUG: focusTrapResults = ", focusTrapResults);
  let reportHTML = `<h1>A11Y BOT Atzinums – ${url}</h1>`;

  // 1. axe-core pārkāpumi
  axeResults.violations.forEach((violation, i) => {
    const count = violation.nodes.length;
    reportHTML += `<h2>🔴 Problēma #${i + 1}: ${violation.help} <span style="font-weight:normal;">(${count} elementi)</span></h2>`;
    reportHTML += `<p><b>Ieteikums:</b> ${violation.description}</p>`;
    violation.nodes.forEach((node) => {
      reportHTML += `<p>➤ Elementa selektors: <code>${node.target.join(", ")}</code></p>`;
    });
  });

  // 2. AI ieteikumi
  reportHTML += `<h2>AI Ieteikumi</h2>`;
  aiSuggestions.suggestions.forEach(s => reportHTML += `<p>${s}</p>`);
  aiSuggestions.aria.forEach(s => reportHTML += `<p>${s}</p>`);
  if (aiSuggestions.contrast && aiSuggestions.contrast.length > 0) {
    aiSuggestions.contrast.forEach(s => reportHTML += `<p>${sanitizeText(s)}</p>`);
  }

  // 3. Focus Trap Testi
  reportHTML += `<h2>Focus Trap Tests</h2>`;
  if (focusTrapResults && focusTrapResults.length > 0) {
    focusTrapResults.forEach(s => {
      reportHTML += `<p>${sanitizeText(s)}</p>`;
    });
  } else {
    reportHTML += `<p>✅ No focus trap issues detected.</p>`;
  }

  return reportHTML;
}

// Funkcija: Ģenerē PDF no HTML
async function generatePDF(url, reportHTML) {
  return new Promise((resolve, reject) => {
    const reportFilename = `a11y-report-${new URL(url).hostname.replace(/\./g, '-')}.pdf`;
    const filePath = path.join(__dirname, reportFilename);

    pdf.create(reportHTML, { format: 'A4' }).toFile(filePath, (err, res) => {
      if (err) {
        console.error("❌ PDF ģenerēšanas kļūda:", err);
        reject(err);
      } else {
        console.log(`✅ PDF saglabāts: ${res.filename}`);
        resolve(res);
      }
    });
  });
}
