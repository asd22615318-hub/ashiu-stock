// Keep the stock identity visible while each information card can be expanded independently.
document.querySelectorAll('#detail > .detail-section').forEach((section, index) => {
  const heading = section.querySelector(':scope > h3');
  if (!heading) return;
  const body = document.createElement('div');
  body.className = 'detail-collapse-body';
  body.id = `detail-collapse-body-${index}`;
  while (heading.nextSibling) body.append(heading.nextSibling);
  section.append(body);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'detail-collapse-toggle';
  button.setAttribute('aria-controls', body.id);
  button.setAttribute('aria-expanded', 'false');
  while (heading.firstChild) button.append(heading.firstChild);
  const indicator = document.createElement('span');
  indicator.className = 'detail-collapse-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = '展開 ＋';
  button.append(indicator);
  heading.append(button);
  body.hidden = true;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(expanded));
    indicator.textContent = expanded ? '收合 −' : '展開 ＋';
    body.hidden = !expanded;
    if (expanded && section.classList.contains('daily-chart-card')) {
      const plot = body.querySelector('.daily-plot');
      if (plot) plot.scrollLeft = plot.scrollWidth - plot.clientWidth;
    }
  });
});

