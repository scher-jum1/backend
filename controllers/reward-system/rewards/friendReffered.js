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

const cfgRefInlfuencer = rewardTypes.ON_SIGNED_UP_BY_INFLUENCER;
const cfgRefFriend = rewardTypes.ON_SIGNED_UP_BY_FRIEND;

const rewardRecordInfluencer = {
  userId: null,
  payload: {
    rewardType: cfgRefInlfuencer.type,
    amountAwarded: null,
    byRef: null
  },
  category: cfgRefInlfuencer.category
}

const rewardRecordFriend = {
  userId: null,
  payload: {
    rewardType: cfgRefFriend.type,
    amountAwarded: null,
    byRef: null
  },
  category: cfgRefFriend.category
}

/** Someone has been registered and confirmed through ref link
 * Conditions:
 * - special award when influencer ref link
 * - max total amount defined
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;
  // const todayRange = prepareTimeRange('today');
  const refId = _.get(data, 'data.referred');

  const isInfluencer = cfgRefInlfuencer.influencers.indexOf(refId) > -1 ? true : false;

  _.set(rewardRecordInfluencer, 'userId', userId);
  _.set(rewardRecordFriend, 'userId', userId);

  if (isInfluencer) {
    const rewardTrackerInfluencer = _.get(userRecord, `trackers.rewarded.${rewardTrackerInfluencer.payload.rewardType}`, 0);
    if (rewardTrackerInfluencer < cfgRefInlfuencer.maxReward) {
      _.set(rewardRecordInfluencer, 'payload.amountAwarded', cfgRefInlfuencer.singleActionReward);

      await createReward(rewardRecordInfluencer).catch((err) => {
        console.error(err);
      });

      await updateUserTrackers(userId, {
        $inc: {['trackers.amounts' + cfgRefInlfuencer.type]: cfgRefInlfuencer.singleActionReward}
      }).catch((err) => {
        console.error(err);
      });

      //add proper amount of tokens to the user
      await mintUser(userId, rewardRecordInfluencer.payload.amountAwarded).catch((err) => {
        console.error(err);
      })

      // //save event and emit on default channel
      const eventStructure = {
        event: notificationEvents.EVENT_USER_REWARDED,
        data: {
          producerId: rewardRecordInfluencer.userId,
          producer: 'system',
          data: rewardRecordInfluencer
        }
      };
      //should we save all kind of events in universalEvents when we have all necessary data?
      // saveEvent(eventStructure.event, eventStructure.data);
      publishToBroadcast(eventStructure);
    }
  } else {
    const rewardTrackerFriend = _.get(userRecord, `trackers.rewarded.${rewardRecordFriend.payload.rewardType}`, 0);

    if (rewardTrackerFriend < cfgRefFriend.maxReward) {
      _.set(rewardTrackerFriend, 'payload.amountAwarded', cfgRefFriend.singleActionReward);

      await createReward(rewardTrackerFriend).catch((err) => {
        console.error(err);
      });

      await updateUserTrackers(userId, {
        $inc: {['trackers.rewarded.' + rewardTypes.ON_SIGNED_UP_BY_FRIEND.type]: rewardTypes.ON_SIGNED_UP_BY_FRIEND.singleActionReward}
      }).catch((err) => {
        console.error(err);
      });

      //add proper amount of tokens to the user
      await mintUser(userId, rewardTrackerFriend.payload.amountAwarded).catch((err) => {
        console.error(err);
      })

      // save event and emit on default channel
      const eventStructure = {
        event: notificationEvents.EVENT_USER_REWARDED,
        data: {
          producerId: rewardTrackerFriend.userId,
          producer: 'system',
          data: rewardTrackerFriend
        }
      };
      //should we save all kind of events in universalEvents when we have all necessary data?
      // saveEvent(eventStructure.event, eventStructure.data);
      publishToBroadcast(eventStructure);
    }
  }
}

module.exports = handle;
