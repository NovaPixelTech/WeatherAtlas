/**
 * WeatherScope support + feedback configuration
 * ==========================================================================
 * Everything a visitor can click lives here, so no UI file ever hard-codes a
 * donation or feedback URL:
 *
 *   koFiUrl        Donation page on Ko-fi. Empty hides the donation button.
 *   payPalMeUrl    Donation page on PayPal.Me. Empty hides it too.
 *   githubSponsorUrl  GitHub Sponsors page. Empty hides the sponsor button.
 *   feedbackFormUrl    Hosted feedback form (Tally, Google Forms, ...). Empty
 *                      hides the "Open the feedback form" button.
 *
 * Setup (about two minutes, no code):
 *
 *   1. Create a Ko-fi (ko-fi.com) or PayPal.Me page and paste its URL here.
 *   2. Optional: create a GitHub Sponsors profile and paste its URL.
 *   3. Optional: create a free Tally (tally.so) or Google Form and paste its
 *      URL here, so visitors can send feedback without a GitHub account.
 *   4. The UI updates itself - nothing else to rebuild.
 *
 * Empty strings mean "do not show".
 */
window.WEATHERSCOPE_SUPPORT = {
  enabled: true,
  koFiUrl: '',
  payPalMeUrl: '',
  githubSponsorUrl: '',
  feedbackFormUrl: 'https://tally.so/r/J1pye4',
};
