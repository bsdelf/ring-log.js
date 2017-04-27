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

    init(fd) {
        this.head = 0;
        this.tail = 0;
        this.fd = fd;

        let buf = Buffer.alloc(SIZEOF_HEADER, 0xff);
        [this.limit, this.head, this.tail].reduce((offset, val) => buf.writeInt32LE(val, offset), 0);

        fs.writeSync(this.fd, buf);
    }

    updateLimit(limit) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(limit);
        fs.writeSync(this.fd, buf, 0, buf.length, 0);
        this.limit = limit;
    }

    updateHead(head) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(head);
        fs.writeSync(this.fd, buf, 0, buf.length, 4);
        this.head = head;
    }

    updateTail(tail) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(tail);
        fs.writeSync(this.fd, buf, 0, buf.length, 8);
        this.tail = tail;
    }
}

class LogRing {
    constructor(maxBytes) {
        this.meta = new Meta(maxBytes);
        this.index = [];
    }

    open(filePath) {
        let meta = this.meta;

        try {
            // load
            let stat = fs.statSync(filePath);
        } catch (err) {
            // create
            let fd = fs.openSync(filePath, 'w+', DEFAULT_MODE);
            meta.init(fd);
        }
    }

    close() {
        fs.closeSync(this.fd);
    }

    push(str) {
        let meta = this.meta;

        // to buffer
        let now = Date.now();
        let buf = Buffer.alloc(4 + 8 + str.length);
        let offset = 0;
        offset = buf.writeUInt32LE(buf.length - 4, offset);
        let big = ~~(now / MAX_UINT32);
        offset = buf.writeUInt32BE(big, offset);
        let low = (now % MAX_UINT32) - big;
        offset = buf.writeUInt32BE(low, offset);
        offset = buf.write(str, offset);

        // check feasible
        if (buf.length >= meta.size) {
            throw new Error('Not feasible');
        }

        // ensure space
        while (true) {
            let free = this.free();
            if (free >= buf.length) {
                break;
            }
            this.shift();
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
        meta.updateTail(pos - SIZEOF_HEADER);
    }

    shift() {
        let meta = this.meta;

        // read head
        let buf, pos = SIZEOF_HEADER + meta.head, sz = 4;

        // read part 1
        [buf, pos] = readWarp(meta.fd, pos, meta.limit, sz);
        sz = buf.readUInt32LE();

        // read part 2
        [buf, pos] = readWarp(meta.fd, pos, meta.limit, sz)
        let id = parseInt(buf.toString('hex', 0, 8), 16);
        let str = buf.toString('utf-8', 8);

        // update meta
        meta.updateHead(pos - SIZEOF_HEADER);

        return {id, str};
    }

    clear() {
    }

    rotate() {
    }

    setLimit(maxBytes) {
        this.rotate();
    }

    free() {
        let meta = this.meta;
        return meta.size - this.used();
    }

    used() {
        let meta = this.meta;
        if (meta.tail >= meta.head) {
            return meta.tail - meta.head;
        } else {
            return meta.tail + meta.size - meta.head;
        }
    }

    full() {
        let meta = this.meta;
        return meta.tail === ((meta.head + meta.size - 1) % meta.size);
    }

    empty() {
        let meta = this.meta;
        return meta.tail === meta.head;
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

module.exports = LogRing;

function incpos(pos, end, delta) {
    pos += delta;
    if (pos >= end) {
        pos = SIZEOF_HEADER;
    }
    return pos;
}

function readWarp(fd, pos, end, n) {
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
