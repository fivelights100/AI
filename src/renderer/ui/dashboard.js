document.addEventListener('DOMContentLoaded', () => {
  const mainTabs = document.querySelectorAll('.dashboard-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const subButtons = document.querySelectorAll('.sidebar .sub-btn');

  mainTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      mainTabs.forEach((item) => item.classList.remove('active'));
      tabContents.forEach((content) => content.classList.add('hidden'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId)?.classList.remove('hidden');
    });
  });

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
});
