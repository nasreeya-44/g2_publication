const bcrypt = require('bcryptjs');

bcrypt.hash('1234', 10, (err, hash) => {
  if (err) throw err;
  console.log('bcrypt hash:', hash);
});
