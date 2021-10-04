const cron = require('node-cron');

//wait for timeout promise fn
const wait = (ms) => {
  return new Promise((resolve, reject) => {
    //reject for testing some async error handling by scheduled jobs
    // reject('err');
    setTimeout(resolve, ms)
  });
}

//fr leaderboards, [UPDATE] we dont need this for now, we will manually create the leaderboards, instead based on events
const initCrons = ()=> {
  //run every 1st day of month at 23:59:59
  cron.schedule('59 59 23 1 * *', async function() {
    console.log('-----------------------------');
    console.log('[CRON] every 1st day of month at 23:59:59');
  });

  //run every sunday at 23:59:59
  cron.schedule('59 59 23 * * 0', async function() {
    console.log('-----------------------------');
    console.log('[CRON] every sunday at 23:59:59');
  });
}

module.exports.initCrons = initCrons;
