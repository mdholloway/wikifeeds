/**
 * To retrieve TFA -- Today's featured article -- for a given date.
 */

'use strict';

const crypto = require('crypto');
const domino = require('domino');
const preq = require('preq');
const BBPromise = require('bluebird');

const si = require('./siteinfo');
const api = require('./api-util');
const dateUtil = require('./date-util');
const util = require('./util');

const HTTPError = util.HTTPError;

const supportedDomains = [ 'bg', 'bn', 'bs', 'cs', 'de', 'el', 'en', 'fa', 'fr', 'he', 'hu', 'ja',
    'la', 'no', 'sco', 'sd', 'ur', 'vi' ].map((lang) => `${lang}.wikipedia.org`);

// eslint-disable-next-line no-restricted-syntax
const isSupported = (domain) => supportedDomains.includes(domain);

/**
 * Builds the request to get the Special:FeedItem provided by the FeaturedFeed extension.
 * @param {!string} domain the request domain
 * @param {!string} lang wiki lang from siteinfo
 * @param {!Date} date for which day the featured article is requested
 * @return {!Promise} a promise resolving as an JSON object containing the response
 */
const requestFeaturedFeedSpecialItem = (domain, lang, date) => {
    const formattedDateString = `${dateUtil.formatYYYYMMDD(date)}000000`;
    const path = 'wiki/Special:FeedItem/featured';
    return preq.get({
        // useskin=apioutput is a way to get just the content without the header and footer
        uri: `https://${domain}/${path}/${formattedDateString}/${lang}?useskin=apioutput`,
        headers: { accept: 'text/html; charset=UTF-8' }
    });
};

// -- functions dealing with responses:

const findPageTitle = (html) => {
    const document = domino.createDocument(html);
    const scope = document.querySelector('div#mw-content-text');
    if (!scope) {
        return;
    }

    const found = scope.querySelector('b > a, a > b');
    if (found) {
        if (found.tagName === 'A') { // b > a
            return found.getAttribute('title');
        } else { // a > b
            // the anchor is the parent node
            return found.parentNode.getAttribute('title');
        }
    }
};

const createSha1 = (input) => {
    const shasum = crypto.createHash('sha1');
    shasum.update(input);
    return shasum.digest('hex');
};

// -- main

const promise = (app, req) => {
    let pageTitle;
    const domain = req.params.domain;
    const aggregated = !!req.query.aggregated;

    if (!dateUtil.validate(dateUtil.hyphenDelimitedDateString(req))) {
        if (aggregated) {
            return BBPromise.resolve({});
        }
        dateUtil.throwDateError();
    }

    if (!isSupported(domain)) {
        if (aggregated) {
            return BBPromise.resolve({});
        } else {
            throw new HTTPError({
                status: 501,
                type: 'unsupported_language',
                title: 'Language not supported',
                detail: 'The language you have requested is not yet supported.'
            });
        }
    }

    const requestedDate = dateUtil.getRequestedDate(req);
    if (domain === 'de.wikipedia.org' && !(dateUtil.isWithinLast3Days(requestedDate))) {
        return BBPromise.resolve({});
    }

    return si.getSiteInfo(app, req)
    .then((si) => requestFeaturedFeedSpecialItem(domain, si.general.lang, requestedDate)
    .then((featured) => {
        api.checkResponseStatus(req);
        pageTitle = findPageTitle(featured.body);
        if (!pageTitle) {
            return BBPromise.resolve({});
        }
        const dbTitle = util.getDbTitle(pageTitle, si);
        return {
            payload: {
                $merge: [ util.getRbPageSummaryUrl(app.restbase_tpl, domain, dbTitle) ]
            },
            meta: { etag: createSha1(dbTitle) }
        };
    }).catch((err) => {
        if (aggregated) {
            return BBPromise.resolve({});
        }
        throw err;
    }));
};

module.exports = {
    promise,
    supportedDomains,
    testing: {
        findPageTitle,
        isSupported
    }
};
