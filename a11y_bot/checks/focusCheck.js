// checks/focusCheck.js

async function checkFocusTrap(page) {
  return await page.evaluate(() => {
    const issues = [];
    const focusableSelectors = 'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(document.querySelectorAll(focusableSelectors));

    if (focusableElements.length === 0) {
      issues.push('⚠️ There is no focusable element on the page.');
    }

    const modal = document.querySelector('[role="dialog"], [role="alertdialog"]');
    if (modal) {
      const modalFocusable = modal.querySelectorAll(focusableSelectors);
      if (modalFocusable.length === 0) {
        issues.push('⚠️ There are no focusable elements inside the modal window.');
      }
    }

    return issues;
  });
}

module.exports = { checkFocusTrap };
