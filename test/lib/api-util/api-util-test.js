'use strict';

const preq   = require('preq');
const assert = require('../../utils/assert');
const mwapi = require('../../../lib/mwapi');
const HTTPError = require('../../../lib/util').HTTPError;

const logger = require('bunyan').createLogger({
    name: 'test-logger',
    level: 'warn'
});

logger.log = function(a, b) {};

describe('lib:apiUtil', function() {
    this.timeout(20000);

    it('checkForQueryPagesInResponse should return 504 when expected query.pages are absent', function() {
        return preq.post({
            uri: 'https://commons.wikimedia.org/w/api.php',
            body: {
                action: 'query',
                format: 'json',
                formatversion: 2,
                generator: 'images',
                prop: 'imageinfo|revisions',
                iiextmetadatafilter: 'ImageDescription',
                iiextmetadatamultilang: true,
                iiprop: 'url|extmetadata|dimensions',
                iiurlwidth: 1024,
                rawcontinue: '',
                titles: `Template:Potd/1980-07-06`
            }
        }).then(function (response) {
            assert.throws(function() { mwapi.checkForQueryPagesInResponse({ logger: logger }, response); }, /api_error/);
        });
    });
});