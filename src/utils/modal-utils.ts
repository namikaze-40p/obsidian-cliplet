let _clipletModalCount = 0;

export function onClipletModalOpen(): void {
  _clipletModalCount++;
  activeDocument.body.classList.add('cliplet-modal-open');
}

export function onClipletModalClose(): void {
  _clipletModalCount = Math.max(0, _clipletModalCount - 1);
  if (_clipletModalCount === 0) {
    activeDocument.body.classList.remove('cliplet-modal-open');
  }
}
