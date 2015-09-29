
/**
 * Module dependencies.
 */

var push = require('global-queue')('_qevents', { wrap: false });
var integration = require('analytics.js-integration');
var useHttps = require('use-https');
var is = require('is');

/**
 * Expose `Quantcast` integration.
 */

var Quantcast = module.exports = integration('Quantcast')
  .assumesPageview()
  .global('_qevents')
  .global('__qc')
  .option('pCode', null)
  .option('advertise', false)
  .tag('http', '<script src="http://edge.quantserve.com/quant.js">')
  .tag('https', '<script src="https://secure.quantserve.com/quant.js">');

/**
 * Initialize.
 *
 * https://www.quantcast.com/learning-center/guides/using-the-quantcast-asynchronous-tag/
 * https://www.quantcast.com/help/cross-platform-audience-measurement-guide/
 *
 * @api public
 * @param {Page} page
 */

Quantcast.prototype.initialize = function(page) {
  window._qevents = window._qevents || [];

  var opts = this.options;
  var settings = { qacct: opts.pCode };
  var user = this.analytics.user();
  if (user.id()) settings.uid = user.id();

  if (page) {
    settings.labels = this._labels(page);
  }

  push(settings);

  var name = useHttps() ? 'https' : 'http';
  this.load(name, this.ready);
};

/**
 * Loaded?
 *
 * @api private
 * @return {boolean}
 */

Quantcast.prototype.loaded = function() {
  return !!window.__qc;
};

/**
 * Page.
 *
 * https://cloudup.com/cBRRFAfq6mf
 *
 * @api public
 * @param {Page} page
 */

Quantcast.prototype.page = function(page) {
  var settings = {
    event: 'refresh',
    labels: this._labels(page),
    qacct: this.options.pCode
  };
  var user = this.analytics.user();
  if (user.id()) settings.uid = user.id();
  push(settings);
};

/**
 * Identify.
 *
 * https://www.quantcast.com/help/cross-platform-audience-measurement-guide/
 *
 * @api public
 * @param {string} [id]
 */

Quantcast.prototype.identify = function(identify) {
  // edit the initial quantcast settings
  // TODO: could be done in a cleaner way
  var id = identify.userId();
  if (id) {
    window._qevents[0] = window._qevents[0] || {};
    window._qevents[0].uid = id;
  }
};

/**
 * Track.
 *
 * https://cloudup.com/cBRRFAfq6mf
 *
 * @api public
 * @param {Track} track
 */

Quantcast.prototype.track = function(track) {
  var settings = {
    event: 'click',
    labels: this._labels(track),
    qacct: this.options.pCode
  };

  var revenue = track.revenue();
  var orderId = track.orderId();
  var user = this.analytics.user();
  if (revenue) settings.revenue = String(revenue);
  if (orderId) settings.orderid = String(orderId);
  if (user.id()) settings.uid = user.id();

  push(settings);
};

/**
 * Completed Order.
 *
 * @api private
 * @param {Track} track
 */

Quantcast.prototype.completedOrder = function(track) {
  var labels = this._labels(track);

  var category = safe(track.category());
  if (this.options.advertise && category) {
    labels += ',_fp.pcat.' + category;
  }

  var repeat = track.proxy('properties.repeat');
  if (this.options.advertise && typeof repeat === 'boolean') {
    labels += ',_fp.customer.' + (repeat ? 'repeat' : 'new');
  }

  var settings = {
    // the example Quantcast sent has completed order send refresh not click
    event: 'refresh',
    labels: labels,
    revenue: String(track.total()),
    orderid: String(track.orderId()),
    qacct: this.options.pCode
  };

  push(settings);
};

/**
 * Generate quantcast labels.
 *
 * @api private
 * @param {Object} facade
 * @return {string}
 *
 * @example:
 *
 *    options.advertise = false;
 *    labels(track);
 *    // => "event.my event"
 *    labels(page);
 *    // => "page.Category.Name"
 *
 *    options.advertise = true;
 *    labels(track);
 *    // => "_fp.event.my event"
 *    labels(page);
 *    // => "_fp.event.Category.Name"
 *
 *  Return a string comprised of:
 *
 *  1) Prefix
 *  2) Default Labels (dot delimited)
 *     - page calls: (Category || 'All').(Name || 'Default)
 *     - track calls: (Event Name)
 *  3) Custom Labels (comma delimited)
 *     - [properties.label, ...context.Quantcast.Labels]
 */

Quantcast.prototype._labels = function(facade) {
  var prefix;
  var action = facade.action();
  if (action === 'page') prefix = 'page';
  if (action === 'track') prefix = 'event';
  if (this.options.advertise) prefix = '_fp.event';

  var autoLabels;
  if (action === 'page') {
    autoLabels = [
      safe(facade.category()) || 'All',
      safe(facade.name()) || 'Default'
    ].join('.');
  } else if (action === 'track') {
    autoLabels = safe(facade.event());
  }

  var label = safe(facade.proxy('properties.label'));
  var custom = facade.options('Quantcast').labels || [];

  if (is.string(customLabels)) customLabels = [customLabels];

  var customLabels = custom.map(function(label){
    // strip special characters to prevent invalid labels
    return safe(label);
  });

  if (is.string(label)) customLabels.unshift(label);
  customLabels = customLabels.join(',');

  var ret = prefix + '.' + autoLabels;
  if (customLabels) ret += ',' + customLabels;
  return ret;
};

/**
 * Remove special characters so that user can't accidentally mis-delimit labels or create invalid labels
 */

function safe(str) {
  if (str) return str.replace(/[^\w\s]|_/gi, '');
}
