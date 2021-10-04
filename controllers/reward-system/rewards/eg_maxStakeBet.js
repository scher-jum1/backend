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

const cfgRef = rewardTypes.ON_BETTED_MAX_STAKE_IN_ROW;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: null,
    timesInRow: null
  },
  category: cfgRef.category
}

/** Someone has betted max stake x times in a row
 * Conditions:
 * - bet max stake 5 times in a row, this event should be emmitted correctly from frontend, to trigger the handler
 * - max total amount defined
 * - only once per lifetime
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  const isAlreadyExist = await getUserRewards({userId, 'payload.rewardType': cfgRef.type}).catch((err)=> {
    console.error(err);
  });

  if(isAlreadyExist.length === 0) {
    _.set(rewardRecord, 'payload.amountAwarded', rewardTypes.cfgRef.singleActionReward);
    _.set(rewardRecord, 'payload.timesInRow', 5); // just 5 for now

    await createReward(rewardRecord).catch((err)=> {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: { ['trackers.rewarded.' + rewardTypes.cfgRef.type] : rewardTypes.cfgRef.singleActionReward}
    }).catch((err)=> {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.payload.amountAwarded).catch((err)=> {
      console.error(err);
    })

    //save event and emit on default channel, just keep the default event structure, so we could save them easily
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
