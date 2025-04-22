// A11Y Bot ar AI ieteikumiem – puppeteer + axe-core + PDF atskaite + CLI URL atbalsts

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');

const args = process.argv.slice(2);
const targetURL = args[0] || "https://example.com";

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    await page.goto(targetURL, { waitUntil: 'networkidle0', timeout: 60000 });

    const axeResults = await new AxePuppeteer(page).analyze();

    let reportHTML = `<h1>A11Y BOT Atzinums – ${targetURL}</h1>`;

    axeResults.violations.forEach((violation, i) => {
      reportHTML += `<h2>🔴 Problēma #${i + 1}: ${violation.help}</h2>`;
      reportHTML += `<p><b>Ieteikums:</b> ${violation.description}</p>`;
      violation.nodes.forEach((node, j) => {
        reportHTML += `<p>➤ Elementa selektors: <code>${node.target.join(", ")}</code></p>`;
      });
    });

    const aiSuggestions = await page.evaluate(() => {
      const suggestions = [];
      const images = document.querySelectorAll('img');
      images.forEach((img, i) => {
        const src = img.getAttribute('src') || "";
        const alt = img.getAttribute('alt') || "";
        if (!alt || /^(image|img|photo|picture)[0-9]*$/i.test(alt)) {
          suggestions.push(`🧠 AI ieteikums attēlam #${i + 1}: Alt teksts '${alt}' nav aprakstošs. Ieteikums: 'Attēlā redzams objekts no '${src}'.`);
        }
      });

      const aria = [];
      document.querySelectorAll('[role]').forEach((el) => {
        const role = el.getAttribute('role');
        if (!/^(button|navigation|main|dialog|alert|checkbox|tab|tooltip)$/.test(role)) {
          aria.push(`⚠️ AI ieteikums: Nestandarta ARIA loma '<b>${role}</b>' elementam <${el.tagName.toLowerCase()}>.`);
        }
      });
      // ---------------
      // Contrast
      // ---------------
      const contrast = [];
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

    aiSuggestions.suggestions.forEach(s => reportHTML += `<p>${s}</p>`);
    aiSuggestions.aria.forEach(s => reportHTML += `<p>${s}</p>`);
    aiSuggestions.contrast.forEach(s => reportHTML += `<p>${s}</p>`);

    const reportFilename = `a11y-report-${new URL(targetURL).hostname.replace(/\./g, '-')}.pdf`;
    const filePath = path.join(__dirname, reportFilename);

    pdf.create(reportHTML, { format: 'A4' }).toFile(filePath, (err, res) => {
      if (err) return console.error("❌ PDF ģenerēšanas kļūda:", err);
      console.log("✅ A11Y PDF atskaite saglabāta:", res.filename);
    });

  } catch (err) {
    console.error("❌ Kļūda lapas analizēšanā:", err);
  } finally {
    await browser.close();
  }
})();
