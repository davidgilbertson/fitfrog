import {daysSinceLastDone, todayExercises} from './model.js';

export function renderToday(section, log, today) {
  const daysSince = daysSinceLastDone(log, today);
  const groups = todayExercises(log, today).map(exercises => {
    const group = document.createElement('div');
    group.className = 'today-group';
    for (const exercise of exercises) {
      const label = document.createElement('label');
      label.className = 'today-exercise';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.exercise = exercise.id;
      const name = document.createElement('span');
      name.textContent = exercise.name;
      const recency = document.createElement('span');
      recency.className = 'today-recency';
      const days = daysSince.get(exercise.id);
      recency.textContent = days === undefined ? 'Never' : days === 1 ? 'Yesterday' : `${days} days ago`;
      const text = document.createElement('span');
      text.className = 'today-label';
      text.append(name, recency);
      label.append(checkbox, text);
      group.append(label);
    }
    return group;
  });
  section.querySelector('.today-list').replaceChildren(...groups.filter(group => group.childElementCount));
}
