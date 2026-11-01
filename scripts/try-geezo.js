const fs = require('node:fs');
const path = require('node:path');
function prepareTestDrive(dataDir) {
  const directory = path.resolve(dataDir);
  fs.mkdirSync(directory, {recursive:true, mode:0o700});
  try {
    fs.copyFileSync(path.join(__dirname, '../config/tester-settings.json'), path.join(directory, 'settings.json'), fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  return directory;
}
function startTestDrive() {
  const port = Number(process.env.PORT || 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
  const dataDir = prepareTestDrive(process.env.GSD_WEB_HOME_OVERRIDE || path.join(__dirname, '../.geezo-data'));
  process.env.GSD_WEB_HOME_OVERRIDE = dataDir;
  const app = require('../server/app').createApp();
  const server = app.listen(port, 'localhost', () => {
    console.log(`Geezo test drive: http://localhost:${port}`);
    console.log(`Tester data: ${dataDir}`);
    console.log('New profiles start empty with scheduled AI reports off. Add folders in Settings.');
  });
  server.on('error', error => { app.locals.close(); console.error(error.message); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { app.locals.close(); server.close(); });
  return server;
}
if (require.main === module) {
  try { startTestDrive(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {prepareTestDrive, startTestDrive};
