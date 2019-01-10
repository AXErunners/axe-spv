const axecore = require('@axerunners/axecore-lib');
const Blockchain = require('../lib/spvchain');
const utils = require('../lib/utils');
const merkleProofs = require('../lib/merkleproofs');

const headers = require('./data/headers');
const merkleData = require('./data/merkleproofs');
// disable for now until axecore-lib can parse it
// const mnListDiff = require('./data/mnlistdiff');

let chain = null;
require('should');

describe('SPV-AXE (forks & re-orgs)', () => {
  before(() => {
    chain = new Blockchain('testnet');
  });

  it('should get 26 testnet headers', () => {
    headers.length.should.equal(26);
  });

  it('should contain 1 branch when chain is initialised with genesis block', () => {
    chain.getAllBranches().length.should.equal(1);
  });

  it('should contain genesis hash', () => {
    chain.getTipHash().should.equal('00000bafbc94add76cb75e2ec92894837288a481e5c005f6563d91623bf8bc2c');
    chain.getLongestChain().length.should.equal(1);
  });

  it('should still contain a branch of 1 when first header is added', () => {
    chain.addHeader(headers[0]);
    chain.getAllBranches().length.should.equal(1);
    chain.getLongestChain().length.should.equal(2);
  });

  it('should discard addding of duplicate block', () => {
    chain.addHeader(headers[0]);
    chain.getOrphans().length.should.equal(0);
    chain.getLongestChain().length.should.equal(2);
  });

  it('create 1 orphan', () => {
    chain.addHeader(headers[2]);
    chain.getOrphans().length.should.equal(1);
    chain.getLongestChain().length.should.equal(2);
  });

  it('connect the orphan by adding its parent', () => {
    chain.addHeader(headers[1]);
    chain.getOrphans().length.should.equal(0);
    chain.getAllBranches().length.should.equal(1);
    chain.getLongestChain().length.should.equal(4);
  });

  it('add remaining test headers', () => {
    chain.addHeaders(headers.slice(3));
    chain.getOrphans().length.should.equal(0);
    chain.getAllBranches().length.should.equal(1);
    chain.getLongestChain().length.should.equal(26);
  });

  it('not add an invalid header', () => {
    chain.addHeader(headers[25]);
    chain.getLongestChain().length.should.equal(26);
  });
});

let genesisHash = null;
describe('Blockstore', () => {
  before(() => {
    chain = new Blockchain('testnet', 10);
    genesisHash = chain.getTipHash();
  });

  it('should add 9 headers', (done) => {
    chain.addHeaders(headers.slice(0, 9));
    chain.getLongestChain().length.should.equal(10);
    chain.getHeader(genesisHash)
      .then((header) => {
        header.hash.should.equal(genesisHash);
        header.should.have.property('children');
        done();
      });
  });

  it('should move 1 block to  the blockstore', (done) => {
    chain.addHeaders(headers.slice(9, 10));
    chain.getLongestChain().length.should.equal(10);
    chain.getHeader(genesisHash)
      .then((header) => {
        header.hash.should.equal(genesisHash);
        header.should.not.have.property('children');
        done();
      });
  });
});

// TODO:
// Create scenarios where chain splits occur to form competing brances
// Difficult with current chain provided by chainmanager as this is actual hardcoded
// Axe testnet headers which requires significant CPU power to create forked chains from

describe('Difficulty Calculation', () => {
  it('should have difficulty of 1 when target is max', () => {
    const testnetMaxTarget = 0x1e0ffff0;
    utils.getDifficulty(testnetMaxTarget).should.equal(1);
  });

  it('should have difficulty higher than 1 when target is lower than max', () => {
    const testnetMaxTarget = 0x1e0fffef;
    utils.getDifficulty(testnetMaxTarget).should.be.greaterThan(1);
  });
});

describe('MerkleProofs', () => {
  it('should validate tx inclusion in merkleblock', () => {
    const merkleBlock = new axecore.MerkleBlock(merkleData.merkleBlock);
    const validTx = '45afbfe270014d5593cb065562f1fed726f767fe334d8b3f4379025cfa5be8c5';
    const invalidTx = `${validTx.substring(0, validTx.length - 1)}0`;

    merkleProofs.validateTxProofs(merkleBlock, [validTx]).should.equal(true);
    merkleProofs.validateTxProofs(merkleBlock, [invalidTx]).should.equal(false);
  });

  it('validate tx by constucting new merkleblock (mnlistdiffs)', () => {
    const { mnProof } = merkleData;
    const validTx = '45afbfe270014d5593cb065562f1fed726f767fe334d8b3f4379025cfa5be8c5';
    const invalidTx = `${validTx.substring(0, validTx.length - 1)}0`;

    merkleProofs.validateMnProofs(
      mnProof.header,
      mnProof.flags,
      mnProof.hashes,
      mnProof.numTransactions,
      validTx,
    ).should.equal(true);

    merkleProofs.validateMnProofs(
      mnProof.header,
      mnProof.flags,
      mnProof.hashes,
      mnProof.numTransactions,
      invalidTx,
    ).should.equal(false);
  });
});
/*
describe('MnList Merkleroot validation', () => {
  it('should validate correct mnlistmerkleroot', () => {
    // not working yet
    merkleProofs.validateMnListMerkleRoot(mnListDiff.merkleRootMNList, mnListDiff.mnList)
      .should.equal(true);
  });
  it('should invalidate incorrect mnlistmerkleroot', () => {
    const randommerkleroot = '1dbb061b19bdcd582b50fae5a29c857e34058d23db79e6defdc8a3498cc29691';
    merkleProofs.validateMnListMerkleRoot(randommerkleroot, mnListDiff.mnList)
      .should.equal(false);
  });
});
*/
