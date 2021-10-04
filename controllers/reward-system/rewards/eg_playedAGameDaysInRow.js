const _ = require('lodash');
const rewardTypes = require('../constans').rewardTypes;
const {prepareTimeRange} = require('../helpers')
const {getDayOfYear} = require('date-fns')
const {
  getUserRewards,
  createReward,
  updateUserTrackers,
  getUniversalEvents
} = require('../../../services/reward-system-service')
const {
  saveEvent,
  notificationEvents,
  publishToBroadcast
} = require('../../../services/notification-service');
const {mintUser} = require('../../../services/user-service')

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.type,
    amountAwarded: null,
    days: null //days in row
  },
  category: rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.category
}

/** Someone has played in x game x times x days in a row
 * Conditions:
 * - played at least once x days in a row
 * - max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  //get event game name
  const gameName = _.get(data, 'data.gameName');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'payload.rewardType': rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.type
  }).catch((err)=> {
    console.error(err);
  });

  //check days in row
  const findXDaysDate = new Date();
  findXDaysDate.setDate(findXDaysDate.getDate() - rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.daysInRow);
  const daysInRow = await getUniversalEvents({
    userId,
    'type': params.events,
    createdAt: { '$gte': findXDaysDate }
  }).catch((err)=> {
    console.error(err);
  });

  const groupByDateCounter = _.groupBy(daysInRow, x => {
    return getDayOfYear(x.createdAt);
  });

  //Only once is allowed
  if(isAlreadyExist.length === 0 && rewardTracker >= rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.maxReward && groupByDateCounter.length === rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.daysInRow) {
    _.set(rewardRecord, 'payload.amountAwarded', rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.games[gameName].singleActionReward);
    _.set(rewardRecord, 'payload.days', rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.daysInRow);

    await createReward(rewardRecord).catch((err)=> {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: { ['trackers.rewarded.' + rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.type] : rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW.singleActionReward}
    }).catch((err)=> {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.payload.amountAwarded).catch((err)=> {
      console.error(err);
    })

    //save event and emit on default channel, just keep the default event structure, so we could save them easily, if we want
    const eventStructure = {
      event: notificationEvents.EVENT_USER_REWARDED,
      data: {
        producerId: rewardRecord.userId,
        producer: 'system',
        data: rewardRecord
      }
    };

    //we dont need to save any helper events, because we are be able to fill the conditions without extra events checks
    // saveEvent(eventStructure.event, eventStructure.data);
    //@todo emit websocket message just for specific user channel, we need to add kind of listener in frontend
    publishToBroadcast(eventStructure);
  }
}

module.exports = handle;
