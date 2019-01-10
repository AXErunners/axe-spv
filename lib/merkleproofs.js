const axecore = require('@axerunners/axecore-lib');
const calculateMnListMerkleRoot = require('./mnlistmerkleroot');

const merkleproofs = {

  validateTxProofs: (merkleBlock, transactions) => merkleBlock.validMerkleTree()
    && transactions.filter(t => merkleBlock.hasTransaction(t)).length === transactions.length,

  validateMnProofs(header, flags, hashes, numTransactions, cbTxHash) {
    const merkleBlock = new axecore.MerkleBlock({
      header,
      numTransactions,
      hashes,
      flags,
    });

    return merkleBlock.validMerkleTree() && merkleBlock.hasTransaction(cbTxHash);
  },

  validateMnListMerkleRoot(mnListMerkleRoot, mnList) {
    return calculateMnListMerkleRoot(mnList) === mnListMerkleRoot;
  },

};

module.exports = merkleproofs;
