const BlockStore = require('./blockstore');
const config = require('../config/config');
const Consensus = require('./consensus');
const utils = require('../lib/utils');

const SpvChain = class {
  constructor(chainType, confirms = 100, startBlock) {
    this.root = null;
    this.allBranches = [];
    this.orphanBlocks = [];
    this.confirmsBeforeFinal = confirms;
    this.init(chainType, startBlock);
    this.store = new BlockStore();
  }

  init(chainType, startBlock) {
    switch (chainType) {
      case 'testnet':
        this.root = config.getTestnetGenesis();
        break;
      case 'livenet':
        this.root = config.getLivenetGenesis();
        break;
      case 'lowdiff':
        this.root = config.getLowDiffGenesis();
        break;
      default:
        if (startBlock) {
          this.root = startBlock;
        } else {
          throw new Error('Unhandled chaintype or startBlock not provided');
        }
        break;
    }
    this.root.children = [];
    this.setAllBranches();
  }

  getLongestChain() {
    return this.allBranches.sort((b1, b2) => b1 < b2)[0];
  }

  checkPruneBlocks() {
    const longestChain = this.getLongestChain();

    if (longestChain.length > this.confirmsBeforeFinal) {
      const pruneBlock = longestChain.splice(0, 1)[0];
      // Children discarded as stale branches
      delete pruneBlock.orphan;
      this.store.put(pruneBlock);
    }
  }

  getTipHash() {
    return this.getLongestChain().slice(-1)[0].hash;
  }

  getHeader(hash) {
    return this.store.get(hash)
      .then((blockInDB) => {
        if (blockInDB) {
          return blockInDB;
        }

        return this.getLongestChain().filter(h => h.hash === hash)[0];
      });
  }

  findConnection(newHeader) {
    const stack = [this.root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node.hash === utils.getCorrectedHash(newHeader.prevHash)) {
        return node;
      }
      node.children.forEach((c) => { stack.push(c); });
    }
    return null;
  }

  setAllBranches(node = this.root, branch = []) {
    this.allBranches = [];
    branch.push(node);

    node.children.forEach((c) => {
      this.setAllBranches(c, Array.from(branch));
    });

    if (node.children.length === 0) {
      this.allBranches.push(branch);
    }
  }

  getAllBranches() {
    return this.allBranches;
  }

  isDuplicate(compareHash) {
    return this.getAllBranches().map(branch => branch.map(node => node.hash))
      .concat(this.orphanBlocks.map(orphan => orphan.hash))
      .filter(hash => hash === compareHash).length > 0;
  }

  orphanReconnect() {
    for (let i = 0; i < this.orphanBlocks.length; i += 1) {
      const connectionTip = this.findConnection(this.orphanBlocks[i]);
      if (connectionTip) {
        connectionTip.children.push(this.orphanBlocks[i]);
        this.orphanBlocks.splice(i, 1);
      }
    }
  }

  getOrphans() {
    return this.orphanBlocks;
  }

  processValidHeader(header) {
    const connection = this.findConnection(header);
    if (connection) {
      connection.children.push(header);
      this.orphanReconnect();
    } else {
      this.orphanBlocks.push(header);
    }
  }

  addHeader(header) {
    const headerNormalised = utils.normalizeHeader(header);

    if (Consensus.isValidBlockHeader(this.getLongestChain(), headerNormalised)
      && !this.isDuplicate(headerNormalised.hash)) {
      headerNormalised.pow = utils.getDifficulty(headerNormalised.bits);
      headerNormalised.children = [];
      this.processValidHeader(headerNormalised);
      this.setAllBranches();
      this.checkPruneBlocks();
      return true;
    }
    return false;
  }

  addHeaders(headers) {
    const self = this;
    headers.forEach((header) => {
      self.addHeader(header);
    });
  }
};

module.exports = SpvChain;
