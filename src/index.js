'use strict';

const fs = require('fs');

const SIZEOF_HEADER = 4 /* limit */ + 4 /* head */ + 4 /* tail */;

const DEFAULT_MODE = parseInt(666, 8);

const MAX_UINT32 = 0xffffffff;

class Meta {
    constructor(maxBytes) {
        this.limit = maxBytes >= (SIZEOF_HEADER + 1) ? maxBytes : (SIZEOF_HEADER + 1);
        this.head = -1;
        this.tail = -1;
        this.size = this.limit - SIZEOF_HEADER;
        this.fd = -1;
    }

    load(fd) {
        this.fd = fd;
    }

    loadSync(fd) {
        this.fd = fd;
    }

    init(fd) {
        return new Promise((resolve, reject) => {
            this.head = 0;
            this.tail = 0;
            this.fd = fd;

            let buf = Buffer.alloc(SIZEOF_HEADER, 0xff);
            [this.limit, this.head, this.tail].reduce((offset, val) => buf.writeInt32LE(val, offset), 0);

            fs.write(this.fd, buf, 0, buf.length, 0, (err, n) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    initSync(fd) {
        this.head = 0;
        this.tail = 0;
        this.fd = fd;

        let buf = Buffer.alloc(SIZEOF_HEADER, 0xff);
        [this.limit, this.head, this.tail].reduce((offset, val) => buf.writeInt32LE(val, offset), 0);

        fs.writeSync(this.fd, buf);
    }

    updateLimit(limit) {
        return new Promise((resolve, reject) => {
            let buf = Buffer.alloc(4);
            buf.writeInt32LE(limit);
            fs.write(this.fd, buf, 0, buf.length, 0, (err, n) => {
                if (err) {
                    reject(err);
                } else {
                    this.limit = limit;
                    resolve();
                }
            });
        });
    }

    updateLimitSync(limit) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(limit);
        fs.writeSync(this.fd, buf, 0, buf.length, 0);
        this.limit = limit;
    }

    updateHead(head) {
        return new Promise((resolve, reject) => {
            let buf = Buffer.alloc(4);
            buf.writeInt32LE(head);
            fs.write(this.fd, buf, 0, buf.length, 4, (err, n) => {
                if (err) {
                    reject(err);
                } else {
                    this.head = head;
                    resolve();
                }
            });
        });
    }

    updateHeadSync(head) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(head);
        fs.writeSync(this.fd, buf, 0, buf.length, 4);
        this.head = head;
    }

    updateTail(tail) {
        return new Promise((resolve, reject) => {
            let buf = Buffer.alloc(4);
            buf.writeInt32LE(tail);
            fs.write(this.fd, buf, 0, buf.length, 8, (err, n) => {
                if (err) {
                    reject(err);
                } else {
                    this.tail = tail;
                    resolve();
                }
            });
        });
    }
    updateTailSync(tail) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(tail);
        fs.writeSync(this.fd, buf, 0, buf.length, 8);
        this.tail = tail;
    }
}

class RingLog {
    constructor(maxBytes) {
        this.meta = new Meta(maxBytes);
        this.index = [];
    }

    open(filePath) {
        let meta = this.meta;

        try {
            // load
            let stat = fs.statSync(filePath);
            return Promise.reject(new Error('TODO'));
        } catch (err) {
            // create
            let fd = fs.openSync(filePath, 'w+', DEFAULT_MODE);
            return meta.init(fd);
        }
    }

    openSync(filePath) {
        let meta = this.meta;

        try {
            // load
            let stat = fs.statSync(filePath);
        } catch (err) {
            // create
            let fd = fs.openSync(filePath, 'w+', DEFAULT_MODE);
            meta.initSync(fd);
        }
    }

    close() {
        return new Promise((resolve, reject) => {
            fs.close(this.fd, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    closeSync() {
        fs.closeSync(this.fd);
    }

    push(item) {
        let self = this;

        let meta = this.meta;

        // handle parameter
        if (typeof item === 'string') {
            item = {str: item};
        }
        let {id=Date.now(), str=''} = item;

        // to buffer
        let buf = Buffer.alloc(4 + 8 + str.length);
        let offset = 0;
        offset = buf.writeUInt32LE(buf.length - 4, offset);
        let big = ~~(id / MAX_UINT32);
        offset = buf.writeUInt32BE(big, offset);
        let low = (id % MAX_UINT32) - big;
        offset = buf.writeUInt32BE(low, offset);
        offset = buf.write(str, offset);

        // check feasible
        if (buf.length >= meta.size) {
            reject(new Error('Not feasible'));
        }

        return ensureSpace().then(writePart1).then(writePart2).then(updateTail);

        function ensureSpace() {
            if (self.free >= buf.length) {
                return Promise.resolve();
            } else {
                return self.shift().then(ensureSpace);
            }
        }

        function writePart1() {
            return new Promise((resolve, reject) => {
                let pos = SIZEOF_HEADER + meta.tail;
                let sizeBeforeEnd = meta.limit - pos;

                let sz1 = Math.min(buf.length, sizeBeforeEnd);
                fs.write(meta.fd, buf, 0, sz1, pos, (err, written) => {
                    if (err) {
                        reject(err);
                    }
                    if (sz1 !== written) {
                        reject(new Error('Short write'));
                    }
                    pos = incpos(pos, meta.limit, sz1);
                    resolve({pos, sz1});
                });
            })
        }

        function writePart2({pos, sz1}) {
            return new Promise((resolve, reject) => {
                let sz2 = buf.length - sz1;
                if (sz2 > 0) {
                    fs.write(meta.fd, buf, sz1, sz2, pos, (err, written) => {
                        if (err) {
                            reject(err);
                        }
                        if (sz2 !== written) {
                            reject(new Error('Short write'));
                        }
                        pos = incpos(pos, meta.limit, sz2);
                        resolve(pos);
                    });
                } else {
                    resolve(pos);
                }
            });
        }

        function updateTail(pos) {
            return meta.updateTail(pos - SIZEOF_HEADER);
        }
    }

    pushSync(item) {
        let meta = this.meta;

        // handle parameter
        if (typeof item === 'string') {
            item = {str: item};
        }
        let {id=Date.now(), str=''} = item;

        // to buffer
        let buf = Buffer.alloc(4 + 8 + str.length);
        let offset = 0;
        offset = buf.writeUInt32LE(buf.length - 4, offset);
        let big = ~~(id / MAX_UINT32);
        offset = buf.writeUInt32BE(big, offset);
        let low = (id % MAX_UINT32) - big;
        offset = buf.writeUInt32BE(low, offset);
        offset = buf.write(str, offset, str.ength, 'utf8');

        // check feasible
        if (buf.length >= meta.size) {
            throw new Error('Not feasible');
        }

        // ensure space
        while (true) {
            if (this.free >= buf.length) {
                break;
            }
            this.shiftSync();
        }

        // write tail
        let pos = SIZEOF_HEADER + meta.tail;
        let sizeBeforeEnd = meta.limit - pos;

        // write part 1
        let sz1 = Math.min(buf.length, sizeBeforeEnd);
        let written1 = fs.writeSync(meta.fd, buf, 0, sz1, pos);
        // assert (sz1 === written1)
        pos = incpos(pos, meta.limit, sz1);

        // write part 2
        let sz2 = buf.length - sz1;
        if (sz2 > 0) {
            let written2 = fs.writeSync(meta.fd, buf, sz1, sz2, pos);
            // assert (sz2 === written2)
            pos = incpos(pos, meta.limit, sz2);
        }

        // update meta
        meta.updateTailSync(pos - SIZEOF_HEADER);
    }

    shift() {
        let meta = this.meta;

        let item;

        if (this.isEmpty) {
            Promise.reject(new Error('Not available'));
        }

        return readPart1().then(readPart2).then(updateHead).then(ret);

        function readPart1() {
            let buf, pos = SIZEOF_HEADER + meta.head, sz = 4;
            return readWarp(meta.fd, pos, meta.limit, sz)
                .then(([buf, pos]) => {
                    sz = buf.readUInt32LE();
                    return {pos, sz};
                });
        }

        function readPart2({pos, sz}) {
            return readWarp(meta.fd, pos, meta.limit, sz)
                .then(([buf, pos]) => {
                    let id = parseInt(buf.toString('hex', 0, 8), 16);
                    let str = buf.toString('utf8', 8);
                    item = {id, str};
                    return pos;
                });
        }

        function updateHead(pos) {
            return meta.updateHead(pos - SIZEOF_HEADER);
        }

        function ret() {
            return item;
        }
    }

    shiftSync() {
        let meta = this.meta;

        if (this.isEmpty) {
            throw new Error('Not available');
        }

        // read head
        let buf, pos = SIZEOF_HEADER + meta.head, sz = 4;

        // read part 1
        [buf, pos] = readWarpSync(meta.fd, pos, meta.limit, sz);
        sz = buf.readUInt32LE();

        // read part 2
        [buf, pos] = readWarpSync(meta.fd, pos, meta.limit, sz)
        let id = parseInt(buf.toString('hex', 0, 8), 16);
        let str = buf.toString('utf-8', 8);

        // update meta
        meta.updateHeadSync(pos - SIZEOF_HEADER);

        return {id, str};
    }

    clear() {
    }

    rotate() {
    }

    setLimit(maxBytes) {
        this.rotate();
    }

    get free() {
        let meta = this.meta;
        return meta.size - this.used;
    }

    get used() {
        let meta = this.meta;
        if (meta.tail >= meta.head) {
            return meta.tail - meta.head;
        } else {
            return meta.tail + meta.size - meta.head;
        }
    }

    get isFull() {
        let meta = this.meta;
        return meta.tail === ((meta.head + meta.size - 1) % meta.size);
    }

    get isEmpty() {
        let meta = this.meta;
        return meta.tail === meta.head;
    }

    static get META_SIZE() {
        return SIZEOF_HEADER + 1;
    }

    // functional

    forEach() {
    }

    reduce() {
    }

    map() {
    }

    some() {
    }
}

module.exports = RingLog;

function incpos(pos, end, delta) {
    pos += delta;
    if (pos >= end) {
        pos = SIZEOF_HEADER;
    }
    return pos;
}

function readWarp(fd, pos, end, n) {
    let buf = Buffer.alloc(n);

    return readPart1().then(readPart2);

    function readPart1() {
        return new Promise((resolve, reject) => {
            let sizeBeforeEnd = end - pos;
            let sz1 = Math.min(n, sizeBeforeEnd);
            fs.read(fd, buf, 0, sz1, pos, (err, read) => {
                if (err) {
                    reject(err);
                }
                if (read != sz1) {
                    reject(new Error('Short read'));
                }
                pos = incpos(pos, end, sz1);
                resolve({pos, sz1});
            });
        });
    }

    function readPart2({pos, sz1}) {
        return new Promise((resolve, reject) => {
            let sz2 = buf.length - sz1;
            if (sz2 > 0) {
                fs.read(fd, buf, sz1, sz2, pos, (err, read) => {
                    if (err) {
                        reject(err);
                    }
                    if (read != sz2) {
                        reject(new Error('Short read'));
                    }
                    pos = incpos(pos, end, sz2);
                    resolve([buf, pos]);
                });
            } else {
                resolve([buf, pos]);
            }
        });
    }
}

function readWarpSync(fd, pos, end, n) {
    let buf = Buffer.alloc(n);

    let sizeBeforeEnd = end - pos;
    let sz1 = Math.min(n, sizeBeforeEnd);
    let read1 = fs.readSync(fd, buf, 0, sz1, pos);
    // assert(sz1 === read1)
    pos = incpos(pos, end, sz1);

    let sz2 = buf.length - sz1;
    if (sz2 > 0) {
        let read2 = fs.readSync(fd, buf, sz1, sz2, pos);
        // assert(sz2 === read2)
        pos = incpos(pos, end, sz2);
    }

    return [buf, pos];
}
