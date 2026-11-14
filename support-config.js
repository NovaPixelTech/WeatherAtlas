/**
 * WeatherScope support + feedback configuration
 * ==========================================================================
 * Everything a visitor can click lives here, so no UI file ever hard-codes a
 * donation or issue URL:
 *
 *   koFiUrl        Donation page on Ko-fi. Empty hides the donation button.
 *   payPalMeUrl    Donation page on PayPal.Me. Empty hides it too.
 *   githubSponsorUrl  GitHub Sponsors page. Empty hides the sponsor button.
 *   githubRepo     Public repository used for bug reports and feature requests.
 *   feedbackIssueUrl  "New issue" URL with the feature template preselected.
 *   bugIssueUrl        "New issue" URL with the bug template preselected.
 *
 * Setup (about two minutes, no code):
 *
 *   1. Create a Ko-fi (ko-fi.com) or PayPal.Me page and paste its URL here.
 *   2. Optional: create a GitHub Sponsors profile and paste its URL.
 *   3. The UI updates itself - nothing else to rebuild.
 *
 * Empty strings mean "do not show". The support button stays hidden until at
 * least one fundraising link is configured, so a fork that does not fund the
 * project sees no donation UI at all.
 */
window.WEATHERSCOPE_SUPPORT = {
  enabled: true,
  koFiUrl: '',
  payPalMeUrl: '',
  githubSponsorUrl: '',
  githubRepo: 'NovaPixelTech/WeatherScope',
  bugIssueUrl: 'https://github.com/NovaPixelTech/WeatherScope/issues/new?labels=bug',
  featureIssueUrl: 'https://github.com/NovaPixelTech/WeatherScope/issues/new?labels=enhancement',
};
