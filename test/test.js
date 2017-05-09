'use strict';

const fs = require('fs');
const assert = require('chai').assert;
const RingLog = require('../src')

const LOG_PATH = 'test.log';

function genPath() {
    return `test.${Date.now().toString(36)}.log`;
}

describe('RingLog', () => {
    describe('#openSync()', () => {
        let logPath;
        let limit = 128;

        before(() => {
            logPath = genPath();
        });

        it('create log if it does not exist', () => {
            let log = new RingLog(limit);
            log.openSync(logPath);
            log.closeSync();
            assert.isTrue(fs.existsSync(logPath));
        });

        it('load existing log', () => {
            let log = new RingLog();
            log.openSync(logPath);
            assert.strictEqual(limit, log.limit);
            assert.strictEqual(0, log.used);
            assert.isFalse(log.isFull);
            assert.isTrue(log.isEmpty);
            log.closeSync();
        });

        after(() => {
            fs.unlinkSync(logPath);
        });
    });

    describe('#pushSync()', () => {
        let logPath;
        let log;

        before(() => {
            logPath = genPath();
            log = new RingLog(RingLog.META_SIZE + 4 + 8 + 1);
            log.openSync(logPath);
        })

        it('should push if feasible', () => {
            assert.doesNotThrow(() => {
                log.pushSync({id:0,str:'a'});
                log.pushSync({id:0,str:'b'});
            });
            assert.isTrue(log.isFull);
            assert.isFalse(log.isEmpty);
        });

        it('should throw if not feasible', () => {
            assert.throws(() => {
                log.pushSync({id:0,str:'ab'});
            });
        });

        after(() => {
            fs.unlinkSync(logPath);
        })
    });

    describe('#shiftSync()', () => {
        let logPath;
        let log;

        let n = 26;

        before(() => {
            logPath = genPath();
            log = new RingLog(RingLog.META_SIZE + (4 + 8 + 1) * n);
            log.openSync(logPath);

            assert.doesNotThrow(() => {
                for (let id = 0; id < n; ++id) {
                    let str = String.fromCharCode('a'.charCodeAt(0) + id);
                    log.pushSync({id, str});
                }
            });
            assert.isTrue(log.isFull);
            assert.isFalse(log.isEmpty);
        })

        it('should shift if available', () => {
            assert.doesNotThrow(() => {
                for (let i = 0; i < n; ++i) {
                    let ch = String.fromCharCode('a'.charCodeAt(0) + i);
                    let {id, str} = log.shiftSync();
                    assert.strictEqual(i, id);
                    assert.strictEqual(ch, str);
                }
            });
            assert.isFalse(log.isFull);
            assert.isTrue(log.isEmpty);
        });

        it('should throw if not available', () => {
            assert.throws(() => {
                let {id, str} = log.shiftSync();
            });
        });

        after(() => {
            fs.unlinkSync(logPath);
        })
    });
});
