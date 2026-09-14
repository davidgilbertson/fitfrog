import {dateFromKey, updateExercises} from './model.js';
import {userId} from './storage.js';

const cross = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

export function setupDialogs(getLog, commit, render) {
  const settingsDialog = document.querySelector('#settings-dialog');
  const notesDialog = document.querySelector('#notes-dialog');
  const list = document.querySelector('#exercise-list');
  let draft = [];
  let originalExercises;
  let notesDay;
  let originalNote;

  for (const dialog of [settingsDialog, notesDialog]) {
    dialog.querySelector('.icon-button[data-close]').innerHTML = cross;
    dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  }

  function renderExercises(focusId) {
    const items = draft.map((exercise, index) => {
      const row = document.createElement('div');
      row.className = `exercise-editor${exercise.deleted ? ' pending-delete' : ''}`;
      const input = document.createElement('input');
      input.value = exercise.name;
      input.disabled = exercise.deleted ?? false;
      input.setAttribute('aria-label', `Exercise ${index + 1} name`);
      input.dataset.id = exercise.id;
      input.addEventListener('input', () => {exercise.name = input.value;});
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.shiftKey && !event.isComposing) {
          event.preventDefault();
          document.querySelector('#add-exercise').click();
        }
      });
      row.append(input);
      if (exercise.deleted) {
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'secondary undo-delete';
        undo.innerHTML = '<span>Undo delete</span>';
        undo.addEventListener('click', () => {exercise.deleted = false; renderExercises(exercise.id);});
        row.append(undo);
      } else {
        for (const direction of [-1, 1]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'icon-button';
          button.innerHTML = `<svg class="triangle" viewBox="0 0 24 24" aria-hidden="true"><path d="${direction === -1 ? 'm5 16 7-10 7 10z' : 'm5 8 7 10 7-10z'}"/></svg>`;
          button.setAttribute('aria-label', `Move ${exercise.name || 'exercise'} ${direction === -1 ? 'up' : 'down'}`);
          button.disabled = index + direction < 0 || index + direction >= draft.length;
          button.addEventListener('click', () => {
            [draft[index], draft[index + direction]] = [draft[index + direction], draft[index]];
            renderExercises(exercise.id);
          });
          row.append(button);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'icon-button delete-button';
        remove.innerHTML = cross;
        remove.setAttribute('aria-label', `Delete ${exercise.name || 'exercise'}`);
        remove.addEventListener('click', () => {
          exercise.deleted = true;
          renderExercises();
          list.querySelector(`input[data-id="${CSS.escape(exercise.id)}"]`).parentElement.querySelector('.undo-delete').focus();
        });
        row.append(remove);
      }
      return row;
    });
    list.replaceChildren(...items);
    if (focusId) list.querySelector(`input[data-id="${CSS.escape(focusId)}"]`)?.focus();
  }

  document.querySelector('#open-settings').addEventListener('click', () => {
    originalExercises = JSON.stringify(getLog().exercises);
    draft = structuredClone(getLog().exercises);
    document.querySelector('#exercise-error').hidden = true;
    renderExercises();
    settingsDialog.showModal();
  });
  const shareLink = document.querySelector('#share-link');
  shareLink.value = `${location.origin}${location.pathname}?id=${userId()}`;
  document.querySelector('#copy-link').addEventListener('click', async () => {
    const label = document.querySelector('#copy-link span');
    try {
      await navigator.clipboard.writeText(shareLink.value);
      label.textContent = 'Copied';
    } catch {
      // No clipboard API (e.g. plain http on the LAN); the link is still there to select by hand.
      shareLink.select();
      label.textContent = 'Select and copy';
    }
    setTimeout(() => {label.textContent = 'Copy';}, 2000);
  });
  document.querySelector('#add-exercise').addEventListener('click', () => {
    const exercise = {id: crypto.randomUUID(), name: ''};
    draft.push(exercise);
    renderExercises(exercise.id);
  });
  document.querySelector('#exercise-form').addEventListener('submit', event => {
    event.preventDefault();
    const error = document.querySelector('#exercise-error');
    const success = commit(log => {
      if (JSON.stringify(log.exercises) !== originalExercises) throw new Error('Exercises changed in another tab. Cancel and reopen this dialog.');
      updateExercises(log, draft.filter(exercise => !exercise.deleted));
    }, error);
    if (success) {settingsDialog.close(); render();}
  });
  document.querySelector('#notes-form').addEventListener('submit', event => {
    event.preventDefault();
    const success = commit(log => {
      if ((log.days[notesDay]?.notes ?? '') !== originalNote) throw new Error('This note changed in another tab. Cancel and reopen it.');
      const entry = log.days[notesDay] ??= {done: [], notes: ''};
      entry.notes = document.querySelector('#day-notes').value;
    }, document.querySelector('#notes-error'));
    if (success) {notesDialog.close(); render();}
  });
  document.querySelector('#day-notes').addEventListener('keydown', event => {
    // Leave Shift+Enter and IME composition to the native textarea.
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      document.querySelector('#notes-form').requestSubmit();
    }
  });

  return function openNotes(day) {
    notesDay = day;
    originalNote = getLog().days[day]?.notes ?? '';
    document.querySelector('#notes-title').textContent = new Intl.DateTimeFormat(undefined, {weekday: 'long', day: 'numeric', month: 'long'}).format(dateFromKey(day));
    document.querySelector('#day-notes').value = originalNote;
    document.querySelector('#notes-error').hidden = true;
    notesDialog.showModal();
    document.querySelector('#day-notes').focus();
  };
}
