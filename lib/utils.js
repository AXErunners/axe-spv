/* eslint no-underscore-dangle: ["error", { "allow": ["_getHash"] }] */
/* eslint-disable no-bitwise */
const AxeUtil = require('@axerunners/axe-util');
const axecore = require('@axerunners/axecore-lib');

module.exports = {

  getCorrectedHash(reversedHashObj) {
    const clone = Buffer.alloc(32);
    reversedHashObj.copy(clone);
    return clone.reverse().toString('hex');
  },
  normalizeHeader(header) {
    if (header instanceof axecore.BlockHeader) {
      return header;
    }
    if (Buffer.isBuffer(header) && header.length === 80) {
      return new axecore.BlockHeader(header);
    }
    if (typeof header === 'string' && header.length === 160) {
      const buffer = Buffer.from(header, 'hex');
      return new axecore.BlockHeader(buffer);
    }

    const el = JSON.parse(JSON.stringify(header));

    return new axecore.BlockHeader({
      version: el.version,
      prevHash: AxeUtil.toHash(el.previousblockhash || el.prevHash),
      merkleRoot: (el.merkleroot || el.merkleRoot),
      time: el.time,
      bits: parseInt(el.bits, 16),
      nonce: el.nonce,
    });
  },
  getDgwBlock(header) {
    return {
      timestamp: header.timestamp,
      target: header.bits,
    };
  },
  validProofOfWork(header) {
    const target = AxeUtil.expandTarget(header.bits);
    const hash = header._getHash().reverse();
    return hash.compare(target) === -1;
  },
  createBlock(prev, bits) {
    let i = 0;
    let header = null;
    do {
      header = new axecore.BlockHeader({
        version: 2,
        prevHash: prev ? prev._getHash() : AxeUtil.nullHash,
        merkleRoot: AxeUtil.nullHash,
        time: prev ? (prev.time + 1) : Math.floor(Date.now() / 1000),
        bits,
        nonce: i += 1,
      });
    } while (!this.validProofOfWork(header));
    return header;
  },
};
