/**
 * WeatherScope support + feedback behaviour
 * ==========================================================================
 * Owns the two dialogs from the footer:
 *
 *   #support-dialog    - the donation/support surface (Ko-fi, PayPal.Me, sponsor)
 *   #feedback-dialog   - the visitor feedback surface (helpful vote + GitHub issues)
 *
 * Both are plain <dialog> elements from the shared markup, so this file only
 * wires behaviour. All strings come from the i18n dictionaries through the
 * data-i18n attributes; no text lives here.
 *
 * Analytics: donations and feedback votes are sent as Umami custom events via
 * `window.weatherscopeAnalytics.trackEvent`, so they never pollute the pageview
 * counts. Events are no-ops when analytics is unconfigured or opted out.
 */
(function () {
  'use strict';

  function element(id) {
    return document.getElementById(id);
  }

  function analyticsApi() {
    return window.weatherscopeAnalytics || {};
  }

  function trackEvent(name, data) {
    const api = analyticsApi();
    if (typeof api.trackEvent === 'function') api.trackEvent(name, data);
  }

  function openDialog(id) {
    const dialog = element(id);
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else if (typeof dialog.show === 'function') {
      dialog.show();
    }
  }

  function closeDialog(id) {
    const dialog = element(id);
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.hidden = true;
  }

  function init() {
    const config = window.WEATHERSCOPE_SUPPORT || {};

    // ---- Donation surface -------------------------------------------------
    const donations = element('support-donations');
    const donationButtons = {
      kofi: element('support-donate-kofi'),
      paypal: element('support-donate-paypal'),
      sponsor: element('support-donate-sponsor'),
    };

    if (donations) {
      const links = [
        { key: 'kofi', url: config.koFiUrl },
        { key: 'paypal', url: config.payPalMeUrl },
        { key: 'sponsor', url: config.githubSponsorUrl },
      ];
      links.forEach((link) => {
        const node = donationButtons[link.key];
        if (!node) return;
        if (link.url) {
          node.hidden = false;
          node.href = link.url;
          node.target = '_blank';
          node.rel = 'noopener noreferrer';
        } else {
          node.hidden = true;
        }
      });
      if (!config.koFiUrl && !config.payPalMeUrl && !config.githubSponsorUrl) {
        donations.hidden = true;
      }
      // Donation clicks are tracked before the browser opens the fundraising
      // page, so the analytics event never distorts pageview counts.
      Object.keys(donationButtons).forEach((key) => {
        const node = donationButtons[key];
        if (!node || node.hidden) return;
        node.addEventListener('click', function () {
          trackEvent('donate_click', { provider: key });
        });
      });
    }

    // ---- Bug / feature links ----------------------------------------------
    const bugLink = element('feedback-bug-link');
    const featureLink = element('feedback-feature-link');
    if (bugLink) bugLink.href = config.bugIssueUrl || '';
    if (featureLink) featureLink.href = config.featureIssueUrl || '';

    // ---- Dialog openers wired from the footer -----------------------------
    const supportLink = element('footer-support-link');
    const feedbackLink = element('footer-feedback-link');
    const feedbackThanks = element('feedback-thanks');

    if (supportLink) {
      supportLink.addEventListener('click', function (event) {
        event.preventDefault();
        trackEvent('support_open', { source: 'footer' });
        openDialog('support-dialog');
      });
    }
    if (feedbackLink) {
      feedbackLink.addEventListener('click', function (event) {
        event.preventDefault();
        trackEvent('feedback_open', { source: 'footer' });
        openDialog('feedback-dialog');
      });
    }
    const closeButtons = [element('support-close'), element('feedback-close')];
    closeButtons.forEach((button) => {
      if (!button) return;
      button.addEventListener('click', function () {
        const dialogId = button.getAttribute('data-dialog');
        const dialog = dialogId ? element(dialogId) : null;
        if (dialog) closeDialog(dialog.id);
      });
    });

    // ---- Helpful vote (dialog widget + generated city pages) --------------
    // The dialog widget uses #feedback-helpful-yes / #feedback-helpful-no, the
    // city guides use buttons carrying data-helpful-vote. Both funnel into the
    // same Umami event with the page they were answered on.
    const helpfulButtons = document.querySelectorAll('[data-helpful-vote]');
    helpfulButtons.forEach((node) => {
      node.addEventListener('click', function () {
        const value = node.getAttribute('data-value') || 'no';
        trackEvent('helpful_vote', { value: value, page: String(window.location.pathname || '') });
        const thanks = element('feedback-thanks');
        if (thanks) thanks.hidden = false;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public hook for the generated city pages, which carry the helpful-vote
  // buttons outside the dialog markup.
  window.WeatherScopeSupport = {
    trackHelpful: function (value) {
      trackEvent('helpful_vote', { value: value, page: String(window.location.pathname || '') });
    },
  };
})();
