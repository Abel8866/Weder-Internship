const app = require('./app');
const { port } = require('./config/env');
const { initializeDatabase } = require('./database/migrations');

initializeDatabase();

app.listen(port, () => {
  console.log(`Offline Field Issue Tracker API listening on http://localhost:${port}`);
});
