const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Commands API' });
});

module.exports = router;