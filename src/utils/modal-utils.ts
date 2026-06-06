let _clipletModalCount = 0;

export function onClipletModalOpen(): void {
  _clipletModalCount++;
  document.body.classList.add('cliplet-modal-open');
}

export function onClipletModalClose(): void {
  _clipletModalCount = Math.max(0, _clipletModalCount - 1);
  if (_clipletModalCount === 0) {
    document.body.classList.remove('cliplet-modal-open');
  }
}
