document.addEventListener('DOMContentLoaded', () => {
  const mainTabs = document.querySelectorAll('.dashboard-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const subButtons = document.querySelectorAll('.sidebar .sub-btn');

  initDashboardTabs(mainTabs, tabContents);
  initDashboardSubTabs(subButtons);
  initDashboardDrag();
});

function initDashboardTabs(mainTabs, tabContents) {
  mainTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      mainTabs.forEach((item) => item.classList.remove('active'));
      tabContents.forEach((content) => content.classList.add('hidden'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId)?.classList.remove('hidden');
    });
  });
}

function initDashboardSubTabs(subButtons) {
  subButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const parentTab = button.closest('.tab-content');
      if (!parentTab) return;

      const localButtons = parentTab.querySelectorAll('.sub-btn');
      const localContents = parentTab.querySelectorAll('.sub-content');

      localButtons.forEach((item) => item.classList.remove('active'));
      localContents.forEach((content) => content.classList.add('hidden'));

      button.classList.add('active');
      const targetId = button.getAttribute('data-target');
      document.getElementById(targetId)?.classList.remove('hidden');
    });
  });
}

function initDashboardDrag() {
  const dashboard = document.querySelector('.dashboard-container');
  const header = document.querySelector('.dashboard-header');
  if (!dashboard || !header) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;

    const rect = dashboard.getBoundingClientRect();
    isDragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    dashboard.style.transform = 'none';
    dashboard.style.left = `${rect.left}px`;
    dashboard.style.top = `${rect.top}px`;

    document.body.classList.add('dashboard-dragging');
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const rect = dashboard.getBoundingClientRect();
    const nextLeft = clamp(event.clientX - offsetX, 0, window.innerWidth - rect.width);
    const nextTop = clamp(event.clientY - offsetY, 0, window.innerHeight - rect.height);

    dashboard.style.left = `${nextLeft}px`;
    dashboard.style.top = `${nextTop}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;

    isDragging = false;
    document.body.classList.remove('dashboard-dragging');
  });
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}
