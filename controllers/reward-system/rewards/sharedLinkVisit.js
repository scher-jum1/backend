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

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: rewardTypes.ON_SHARED_LINK_FIRST_VISIT.type,
    amountAwarded: null,
    byRef: null
  },
  category: rewardTypes.ON_SHARED_LINK_FIRST_VISIT.category
}

/** Someone has been visited a shared link,
 * Ideally EVENT_USER_SHARED_LINK_FIRST_VISIT, should be triggered just once, after first visit of the shared link)
 * Conditions:
 * - shared a link will be full filled, when anyone visit the link with someone ref id
 * - max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  const isAlreadyExist = await getUserRewards({userId, 'payload.rewardType': rewardTypes.ON_SHARED_LINK_FIRST_VISIT.type}).catch((err)=> {
    console.error(err);
  });

  if(isAlreadyExist.length === 0) {
    _.set(rewardRecord, 'payload.amountAwarded', rewardTypes.ON_SHARED_LINK_FIRST_VISIT.singleActionReward);

    await createReward(rewardRecord).catch((err)=> {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: { ['trackers.' + rewardTypes.ON_SHARED_LINK_FIRST_VISIT.type] : rewardTypes.ON_SHARED_LINK_FIRST_VISIT.singleActionReward}
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
