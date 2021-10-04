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

const cfgRef = rewardTypes.ON_FEEDBACK_PROVIDED;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: cfgRef.singleActionReward
  },
  category: cfgRef.category
}

/** User provided a feedback
 * Conditions:
 * - user send some feedback
 * - max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  //get event game name
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'payload.rewardType': cfgRef.type
  }).catch((err)=> {
    console.error(err);
  });

  //Only once is allowed
  if(isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward) {
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
