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

const cfgRef = rewardTypes.ON_CHECKED_IN_MANY_CHATS;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: null,
    totalChats: null // total different chats count
  },
  category: cfgRef.category
}

/** User wrote message in >= 20 chats
 * Conditions:
 * - user wrote at least 1 message in 20 different chats (events)
 * - max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  //get event game name
  const totalChatsCount = _.get(data, 'data.totalChatsCount');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'payload.rewardType': rewardTypes.ON_CHECKED_IN_MANY_CHATS.type
  }).catch((err)=> {
    console.error(err);
  });

  //Only once is allowed
  if(isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward && parseInt(totalChatsCount, 10) >= cfgRef.totalChats) {
    _.set(rewardRecord, 'payload.amountAwarded', cfgRef.singleActionReward);
    _.set(rewardRecord, 'payload.totalChats', cfgRef.totalChats);

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
