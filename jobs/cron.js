const cron = require('node-cron');
const {getUsersLeaderboard} = require('../controllers/reward-system');

//wait for timeout promise fn
const wait = (ms) => {
  return new Promise((resolve, reject) => {
    //reject for testing some async error handling by scheduled jobs
    // reject('err');
    setTimeout(resolve, ms)
  });
}


const initCrons = ()=> {
  //run every 1st day of month at 23:59:59
  cron.schedule('59 59 23 1 * *', async function() {
    console.log('-----------------------------');
    console.log('[CRON] every 1st day of month at 23:59:59');
    await wait(3000);
  });

  //run every sunday at 23:59:59
  cron.schedule('59 59 23 * * 0', async function() {
    console.log('-----------------------------');
    console.log('[CRON] every sunday at 23:59:59');

    await wait(5000).catch((err)=> {
      console.log("[REWARD SYSTEM] cron error", err);
    });
  });

  //run every 10 seconds
  cron.schedule('*/5 * * * * *', async function() {
    console.log('-----------------------------');
    console.log('Cron running every 10 second');

    const leaderboard = await getUsersLeaderboard().catch((err)=> {
      console.log("[REWARD SYSTEM] cron error", err);
    });

    console.log("leaderboard", leaderboard);
  });
}

module.exports.initCrons = initCrons;
