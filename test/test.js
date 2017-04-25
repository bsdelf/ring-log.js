'use strict';

const assert = require('assert');
const LogRing = require('../src')

describe('LogRing', () => {
    describe('constructor()', () => {
        it('should throw when filePath or maxBytes is missing', () => {
            assert.throws(() => {
                throw new Error('');
            })
        });

        it('should throw when filePath is not writable', () => {
            assert.throws(() => {
                throw new Error('');
            })
        });

        it('should throw when maxBytes < 8', () => {
            assert.throws(() => {
                throw new Error('');
            })
        });
    });

    describe('append()', () => {
        it('should append', () => {
            let log = new LogRing('a.dat', 1024);
            log.close();
        });
    });

    describe('fetch()', () => {
        it('should fetch', () => {
        });
    });

    describe('clear()', () => {
        it('should clear', () => {
        })
    });

    describe('resize()', () => {
        it('should resize', () => {
        });
    });

    describe('forEach()', () => {
        it('should for-each', () => {
        });
    });

    describe('map()', () => {
        it('should map', () => {
        });
    });

    describe('reduce()', () => {
        it('should reduce', () => {
        });
    });
});