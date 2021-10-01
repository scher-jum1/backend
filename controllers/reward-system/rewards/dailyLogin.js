const _ = require('lodash');
const rewardTypes = require('../constans').rewardTypes;
const {prepareTimeRange} = require('../helpers')
const {getUserRewards, createReward, updateUserTrackers} = require('../../../services/reward-system-service')
const {saveEvent, notificationEvents, publishToBroadcast} = require('../../../services/notification-service');
const {mintUser} = require('../../../services/user-service')

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: rewardTypes.ON_DAILY_LOGIN.type,
    amountAwarded: null
  },
  category: rewardTypes.ON_DAILY_LOGIN.category
}

/** Daily log in reward
 * Conditions:
 * -only once per day,
 * -max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;
  const todayRange = prepareTimeRange('today');
  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}`, 0);

  _.set(rewardRecord, 'userId', userId);

  const isDailyExist = await getUserRewards({userId, createdAt: {$gte: todayRange.start, $lt: todayRange.end}}).catch((err)=> {
    console.error(err);
  });

  if(isDailyExist.length === 0 && rewardTracker < rewardTypes.ON_DAILY_LOGIN.maxReward) {
    _.set(rewardRecord, 'payload.amountAwarded', rewardTypes.ON_DAILY_LOGIN.singleActionReward);

    await createReward(rewardRecord).catch((err)=> {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: { ['trackers.rewarded.' + rewardTypes.ON_DAILY_LOGIN.type] : rewardTypes.ON_DAILY_LOGIN.singleActionReward}
    }).catch((err)=> {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.payload.amountAwarded).catch((err)=> {
      console.error(err);
    })

    //save event and emit on default channel
    const eventStructure = {
      event: notificationEvents.EVENT_USER_REWARDED,
      data: {
        producerId: rewardRecord.userId,
        producer: 'system',
        data: rewardRecord
      }
    };

    saveEvent(eventStructure.event, eventStructure.data);
    publishToBroadcast(eventStructure);
  }
}

module.exports = handle;
