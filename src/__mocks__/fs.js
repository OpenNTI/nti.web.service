/*eslint-env jest*/
'use strict';

// const path = require('path');

const fs = jest.genMockFromModule('fs');


// fs.__setMockFiles = () => {};
// fs.readFile = read;
// fs.stat = stat;

module.exports = fs;
