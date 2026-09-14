import {dateFromKey, historyDates} from './model.js';

const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const noteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></svg>';
const weekday = new Intl.DateTimeFormat(undefined, {weekday: 'short'});
const dateLabel = new Intl.DateTimeFormat(undefined, {weekday: 'short', day: '2-digit', month: 'short'});
const fullDate = new Intl.DateTimeFormat(undefined, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});

export function renderGrid(table, log, today, limit) {
  const head = document.createElement('thead');
  const headers = document.createElement('tr');
  const dateHeader = document.createElement('th');
  dateHeader.className = 'date-cell';
  dateHeader.scope = 'col';
  dateHeader.textContent = 'Date';
  headers.append(dateHeader);
  for (const exercise of log.exercises) {
    const header = document.createElement('th');
    header.className = 'exercise-header';
    header.scope = 'col';
    const name = document.createElement('span');
    name.textContent = exercise.name;
    header.append(name);
    headers.append(header);
  }
  const notesHeader = document.createElement('th');
  notesHeader.className = 'notes-cell';
  notesHeader.scope = 'col';
  notesHeader.innerHTML = `<span class="note-text">Notes</span><span class="note-icon">${noteIcon}</span><span class="sr-only">Daily notes</span>`;
  headers.append(notesHeader);
  head.append(headers);
  const body = document.createElement('tbody');
  for (const day of historyDates(log, today, limit)) {
    const row = document.createElement('tr');
    const dateCell = document.createElement('th');
    dateCell.className = 'date-cell';
    dateCell.scope = 'row';
    const time = document.createElement('time');
    time.dateTime = day;
    time.setAttribute('aria-label', fullDate.format(dateFromKey(day)));
    const wide = document.createElement('span');
    wide.className = 'date-wide';
    wide.textContent = day === today ? 'Today' : dateLabel.format(dateFromKey(day));
    const short = document.createElement('span');
    short.className = 'date-short';
    short.textContent = day === today ? 'Today' : weekday.format(dateFromKey(day));
    time.append(wide, short);
    dateCell.append(time);
    row.append(dateCell);
    for (const exercise of log.exercises) {
      const cell = document.createElement('td');
      cell.className = 'exercise-cell';
      const button = document.createElement('button');
      button.className = 'toggle';
      button.dataset.day = day;
      button.dataset.exercise = exercise.id;
      button.setAttribute('aria-label', `${exercise.name}, ${fullDate.format(dateFromKey(day))}`);
      button.setAttribute('aria-pressed', String(log.days[day]?.done.includes(exercise.id) ?? false));
      button.innerHTML = tick;
      cell.append(button);
      row.append(cell);
    }
    const notes = log.days[day]?.notes ?? '';
    const cell = document.createElement('td');
    cell.className = 'notes-cell';
    const button = document.createElement('button');
    button.className = `note-button${notes ? ' has-note' : ''}`;
    button.dataset.notesDay = day;
    button.setAttribute('aria-label', `${notes ? 'Edit' : 'Add'} notes for ${fullDate.format(dateFromKey(day))}${notes ? `: ${notes}` : ''}`);
    const preview = document.createElement('span');
    preview.className = 'note-text';
    preview.textContent = notes || '+';
    const icon = document.createElement('span');
    icon.className = 'note-icon';
    icon.innerHTML = noteIcon;
    button.append(preview, icon);
    cell.append(button);
    row.append(cell);
    body.append(row);
  }
  table.replaceChildren(head, body);
}

export function fitGrid(region, table, count) {
  const styles = getComputedStyle(region);
  const cell = Number.parseFloat(styles.getPropertyValue('--cell'));
  const date = Number.parseFloat(styles.getPropertyValue('--date-width'));
  const remaining = region.clientWidth - date - count * cell;
  const compact = remaining < document.querySelector('#note-measure').getBoundingClientRect().width;
  const notes = Math.max(compact ? cell : 0, remaining);
  region.classList.toggle('compact-notes', compact);
  table.style.setProperty('--notes-width', `${notes}px`);
  table.style.width = `${date + count * cell + notes}px`;
}
