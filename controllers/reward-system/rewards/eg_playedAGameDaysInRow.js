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

const cfgRef = rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: null,
    days: null //days in row
  },
  category: cfgRef.category
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
    'payload.rewardType': cfgRef.type
  }).catch((err)=> {
    console.error(err);
  });

  //check days in row
  const findXDaysDate = new Date();
  findXDaysDate.setDate(findXDaysDate.getDate() - cfgRef.daysInRow);
  const daysInRow = await getUniversalEvents({
    userId,
    'type': params.event,
    createdAt: { '$gte': findXDaysDate }
  }).catch((err)=> {
    console.error(err);
  });

  const groupByDateCounter = _.groupBy(daysInRow, x => {
    return getDayOfYear(x.createdAt);
  });

  //Only once is allowed
  if(isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward && groupByDateCounter.length === cfgRef.daysInRow) {
    _.set(rewardRecord, 'payload.amountAwarded', cfgRef.games[gameName].singleActionReward);
    _.set(rewardRecord, 'payload.days', cfgRef.daysInRow);

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
