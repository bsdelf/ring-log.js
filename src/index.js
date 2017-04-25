'use strict';

const fs = require('fs');

class LogRing {
    constructor(filePath, maxBytes, mode) {
        const flags = fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_APPEND;
        this.fd = fs.openSync(filePath, flags, mode);
    }

    close() {
        fs.close(this.fd);
    }

    append(log) {
    }

    fetch(options) {
    }

    clear() {
    }

    resize() {
    }

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
