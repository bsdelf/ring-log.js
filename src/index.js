'use strict';

const fs = require('fs');

class LogRing {
    constructor(maxBytes) {
        this.limit = maxBytes;
        this.fd = -1;
        this.logs = [];
    }

    open(filePath) {
    }

    close() {
    }

    push(log) {
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
