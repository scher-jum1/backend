const _ = require('lodash');
const rewardTypes = require('../constans').rewardTypes;
const {prepareTimeRange} = require('../helpers')
const {
  getUserRewards,
  createReward,
  updateUserTrackers
} = require('../../../services/reward-system-service')
const {
  saveEvent,
  notificationEvents,
  publishToBroadcast
} = require('../../../services/notification-service');
const {mintUser} = require('../../../services/user-service')

const cfgRef = rewardTypes.ON_GAME_PLAYED;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: null,
    totalTimes: 200, //just one game for now, it could be static
    gameName: null
  },
  category: cfgRef.category
}

/** Someone has played in x game x times and reached some specific amount like 200
 * Conditions:
 * - played specific game x times
 * - max total amount defined
 * - only once per lifetime == up to max value
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  //get event game name
  const gameName = _.get(data, 'data.gameName');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}.${gameName}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'payload.rewardType': cfgRef.type,
    'payload.gameName': gameName
  }).catch((err)=> {
    console.error(err);
  });

  //increment progress and check condition
  const updatedUserRecord = await updateUserTrackers(userId, {
    $inc: { ['trackers.progress.' + cfgRef.type] : 1}
  }).catch((err)=> {
    console.error(err);
  });

  const checkGameProgress = _.get(updatedUserRecord, `trackers.progress.${rewardRecord.payload.rewardType}.${gameName}`, 0);

  //Only once is allowed
  if(isAlreadyExist.length === 0 && checkGameProgress >= 200 && rewardTracker >= cfgRef.maxReward) {
    _.set(rewardRecord, 'payload.amountAwarded', cfgRef.games[gameName].singleActionReward);
    _.set(rewardRecord, 'payload.gameName', gameName);
    _.set(rewardRecord, 'payload.totalTimes', checkGameProgress);

    await createReward(rewardRecord).catch((err)=> {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: { ['trackers.rewarded.' + cfgRef.type] : cfgRef.singleActionReward}
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
