/**
 * WeatherAtlas support + feedback behaviour
 * ==========================================================================
 * Owns the two dialogs from the footer:
 *
 *   #support-dialog    - the donation/support surface (Ko-fi, PayPal.Me, sponsor)
 *   #feedback-dialog   - the visitor feedback surface (helpful vote + hosted form)
 *
 * Both are plain <dialog> elements from the shared markup, so this file only
 * wires behaviour. All strings come from the i18n dictionaries through the
 * data-i18n attributes; no text lives here.
 *
 * Analytics: donations and feedback votes are sent as Umami custom events via
 * `window.WeatherAtlasAnalytics.trackEvent`, so they never pollute the pageview
 * counts. Events are no-ops when analytics is unconfigured or opted out.
 */
(function () {
  'use strict';

  function element(id) {
    return document.getElementById(id);
  }

  function analyticsApi() {
    return window.WeatherAtlasAnalytics || {};
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
    const config = window.WEATHERATLAS_SUPPORT || {};

    // ---- Donation surface -------------------------------------------------
    const donations = element('support-donations');
    const supportEmpty = element('support-empty');
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
          node.removeAttribute('href');
        }
      });
      const anyLink = config.koFiUrl || config.payPalMeUrl || config.githubSponsorUrl;
      donations.hidden = !anyLink;
      // With no fundraising URL there is nothing to click, so the dialog says
      // so instead of showing dead cards.
      if (supportEmpty) supportEmpty.hidden = !!anyLink;

      // When donations are unavailable, the empty state offers a one-click
      // shortcut to the feedback dialog so support never dead-ends.
      const emptyFeedback = element('support-empty-feedback');
      if (emptyFeedback) {
        emptyFeedback.addEventListener('click', function () {
          trackEvent('feedback_open', { source: 'support_empty' });
          openDialog('feedback-dialog');
        });
      }
      // Donation clicks are tracked before the browser opens the fundraising
      // page, so the analytics event never distorts pageview counts. The
      // getAttribute guard keeps a card with no configured link inert even if
      // a stylesheet ever lets it peek through.
      Object.keys(donationButtons).forEach((key) => {
        const node = donationButtons[key];
        if (!node || node.hidden) return;
        node.addEventListener('click', function (event) {
          if (!node.getAttribute('href')) {
            event.preventDefault();
            return;
          }
          trackEvent('donate_click', { provider: key });
        });
      });
    }

    // ---- Hosted feedback form ---------------------------------------------
    // (GitHub issue links removed; feedback is collected via the hosted form.)
    // A Tally / Google Forms URL lets visitors send feedback without a GitHub
    // account. Empty (or not http(s)) keeps the button hidden, so the dialog
    // never offers a dead action.
    const feedbackFormLink = element('feedback-form-link');
    if (feedbackFormLink) {
      const formUrl = typeof config.feedbackFormUrl === 'string' ? config.feedbackFormUrl.trim() : '';
      if (/^https?:\/\//i.test(formUrl)) {
        feedbackFormLink.hidden = false;
        feedbackFormLink.target = '_blank';
        feedbackFormLink.rel = 'noopener noreferrer';
        // Append the current page so the Tally form can capture where the
        // feedback came from via a hidden field named "page".
        const withPage = function () {
          const page = String(window.location.pathname || '') + (window.location.search || '');
          const sep = formUrl.indexOf('?') === -1 ? '?' : '&';
          return formUrl + sep + 'page=' + encodeURIComponent(page || '/');
        };
        feedbackFormLink.href = withPage();
        feedbackFormLink.addEventListener('mouseenter', function () { feedbackFormLink.href = withPage(); });
        feedbackFormLink.addEventListener('focus', function () { feedbackFormLink.href = withPage(); });
        feedbackFormLink.addEventListener('click', function () {
          feedbackFormLink.href = withPage();
          trackEvent('feedback_form_click', { source: 'footer' });
        });
      } else {
        feedbackFormLink.hidden = true;
        feedbackFormLink.removeAttribute('href');
      }
    }

    // ---- Email capture (Mailchimp) ---------------------------------------
    // Optional newsletter signup. Hidden until mailchimpActionUrl is configured.
    const emailForm = element('email-capture-form');
    if (emailForm) {
      const actionUrl = typeof config.mailchimpActionUrl === 'string' ? config.mailchimpActionUrl.trim() : '';
      if (/^https?:\/\//i.test(actionUrl)) {
        emailForm.hidden = false;
        emailForm.action = actionUrl;
      } else {
        emailForm.hidden = true;
      }
    }

    // ---- Dialog openers wired from the footer and the free banner ----------
    const supportLink = element('footer-support-link');
    const bannerSupportBtn = element('banner-support-btn');
    const feedbackLink = element('footer-feedback-link');
    const feedbackThanks = element('feedback-thanks');

    if (supportLink) {
      supportLink.addEventListener('click', function (event) {
        event.preventDefault();
        trackEvent('support_open', { source: 'footer' });
        openDialog('support-dialog');
      });
    }
    // The banner makes the same ask as the footer, so it opens the same dialog
    // and only changes the `source` of the event. `banner-support-btn` is a real
    // <button>, so no default action needs preventing.
    if (bannerSupportBtn) {
      bannerSupportBtn.addEventListener('click', function () {
        trackEvent('support_open', { source: 'banner' });
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
  window.WeatherAtlasSupport = {
    trackHelpful: function (value) {
      trackEvent('helpful_vote', { value: value, page: String(window.location.pathname || '') });
    },
  };
})();
