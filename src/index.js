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
        fs.writeSync(this.fd, buf, 0);
        this.limit = limit;
    }

    updateHead(head) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(head);
        fs.writeSync(this.fd, buf, 4);
        this.head = head;
    }

    updateTail(tail) {
        let buf = Buffer.alloc(4);
        buf.writeInt32LE(tail);
        fs.writeSync(this.fd, buf, 8);
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

    push(log) {
        let meta = this.meta;

        // to buffer
        let now = Date.now();
        let big = ~~(now / MAX_UINT32);
        let low = (now % MAX_UINT32) - big;
        let buf = Buffer.alloc(4 + 8 + log.length);
        let offset = 0;
        offset = buf.writeUInt32LE(buf.length, offset);
        offset = buf.writeUInt32LE(big, offset);
        offset = buf.writeUInt32LE(low, offset);
        offset = buf.write(log, offset);

        // check feasible
        if (buf.length >= meta.limit - SIZEOF_HEADER) {
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

        // append buffer
        let pos = SIZEOF_HEADER + meta.tail;
        let sizeBeforeLimit = meta.limit - pos;
        let incpos = (pos, delta) => {
            pos += delta;
            if (pos === meta.limit) {
                pos = SIZEOF_HEADER;
            }
            return pos;
        };

        // write part 1
        let sz1 = Math.min(buf.length, sizeBeforeLimit);
        let written1 = fs.writeSync(meta.fd, buf, 0, sz1, pos);
        // assert (sz1 === written1)
        pos = incpos(pos, sz1);

        // write part 2
        let sz2 = buf.length - sz1;
        if (sz2 > 0) {
            let written2 = fs.writeSync(meta.fd, buf, sz1, sz2, pos);
            // assert (sz2 === written2)
            pos = incpos(pos, sz2);
        }

        // update meta
        meta.updateTail(pos);
    }

    shift() {
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
        return meta.tail === ((meta.head - 1 + meta.size) % meta.size);
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
