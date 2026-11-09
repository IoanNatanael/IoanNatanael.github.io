/* V13-R20 — Inline schedule form and existing demo recovery default. */
document.addEventListener('DOMContentLoaded', () => {
  document.title = document.title.replace(/V13-R\d+/, 'V13-R20');
  const previewTitle = document.querySelector('.r3-preview-notice strong');
  if (previewTitle) previewTitle.textContent = 'PREVIEW V13-R20';
  const badge = document.getElementById('demoBadge');
  if (badge) badge.textContent = 'V13-R20 · preview';

  const refill = document.getElementById('autoRefillMinutes');
  const refillCard = refill?.closest('.r12-refill-box');
  if (refillCard) {
    refill.type = 'hidden';
    refill.value = '10';
    refillCard.replaceWith(refill);
  }

  const editor = document.getElementById('r18ScheduleEditor');
  if (!editor) return;
  const summary = editor.querySelector('summary');
  document.getElementById('r18CloseEditor')?.addEventListener('click', () => {
    if (!editor.open) return;
    editor.open = false;
    summary.focus();
  });
});
