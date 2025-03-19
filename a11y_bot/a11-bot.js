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

      const contrast = [];
      document.querySelectorAll('*').forEach((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        if (color && bg && color === bg) {
          contrast.push(`⚠️ AI ieteikums: Zems kontrasts starp tekstu <b>${color}</b> un fonu <b>${bg}</b> elementam <${el.tagName.toLowerCase()}>.`);
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
