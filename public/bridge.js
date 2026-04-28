/**
 * Sight Seers Caribbean Adventures – Vercel Data Bridge
 */
(function () {
  'use strict';

  const SS_KEYS = [
    'ss_site_settings',
    'ss_page_editor_settings',
    'ss_customer_gallery',
    'ss_stay_page_settings',
    'ss_tours_data'
  ];

  function syncFromServer() {
    fetch('/api/settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        SS_KEYS.forEach(key => {
          if (data[key]) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });
      })
      .catch(() => {});
  }

  function patchLocalStorage() {
    const original = localStorage.setItem;

    localStorage.setItem = function (key, value) {
      original.apply(this, arguments);

      if (key.startsWith('ss_')) {
        try {
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key,
              value: JSON.parse(value)
            })
          });
        } catch (e) {}
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncFromServer();
    patchLocalStorage();
  });

})();
