// checks/focusTrapCheck.js

async function simulateFocusTrap(page) {
  const issues = [];

  const modalSelector = '[role="dialog"], [role="alertdialog"]';
  const modal = await page.$(modalSelector);

  if (!modal) {
    issues.push('⚠️ Modal dialog not found on page.');
    return issues;
  }

  const focusableSelectors = 'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
  const focusableElements = await page.$$(focusableSelectors);

  if (focusableElements.length === 0) {
    issues.push('⚠️ No focusable elements found inside modal.');
    return issues;
  }

  // Fokusē pirmo modāļa elementu
  await focusableElements[0].focus();

  for (let i = 0; i < focusableElements.length + 5; i++) {
    await page.keyboard.press('Tab');

    const activeTagName = await page.evaluate(() => {
      return document.activeElement ? document.activeElement.tagName.toLowerCase() : null;
    });

    const isInModal = await page.evaluate((selector) => {
      const modal = document.querySelector(selector);
      if (!modal) return false;
      return modal.contains(document.activeElement);
    }, modalSelector);

    if (!isInModal) {
      issues.push(`⚠️ Focus escaped modal! Focus is now on <${activeTagName}> element.`);
      break;
    }
  }

  if (issues.length === 0) {
    issues.push('✅ Focus trap works correctly inside modal.');
  }

  return issues;
}

module.exports = { simulateFocusTrap };
