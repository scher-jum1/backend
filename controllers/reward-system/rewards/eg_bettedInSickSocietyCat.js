const _ = require('lodash');
const rewardTypes = require('../constans').rewardTypes;
const {prepareTimeRange} = require('../helpers')
const {
  getUserRewards,
  createReward,
  updateUserTrackers, getUniversalEvents
} = require('../../../services/reward-system-service')
const {
  saveEvent,
  notificationEvents,
  publishToBroadcast
} = require('../../../services/notification-service');
const {mintUser} = require('../../../services/user-service')

const cfgRef = rewardTypes.ON_BETTED_IN_SICK_SOCIETY_CAT;

const rewardRecord = {
  userId: null,
  payload: {
    rewardType: cfgRef.type,
    amountAwarded: cfgRef.singleActionReward,
    betCategory: cfgRef.betCategory,
    totalBets: cfgRef.totalBets
  },
  category: cfgRef.category
}

/** User betted 10 times in specific category (Sick society)
 * Conditions:
 * - total bets for user for specific category == cfgRef.totalBets
 * - max total amount defined
 * - only once per lifetime
 * */

const handle = async (params) => {
  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  //get new event category, check only when category match our sick category
  const currentBetCat = _.get(data, 'data.event.category');
  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.payload.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({userId, 'payload.rewardType': cfgRef.type}).catch((err)=> {
    console.error(err);
  });

  if(currentBetCat !== cfgRef.betCategory) {
    return;
  }

  const totalBetsInCategory = await getUniversalEvents({
    userId,
    'type': "Notification/EVENT_BET_PLACED",
    'data.event.category': cfgRef.betCategory
  }, ['_id']).catch((err)=> {
    console.error(err);
  });

  if(isAlreadyExist.length === 0 && totalBetsInCategory.length >= cfgRef.totalBets && rewardTracker < rewardTypes.ON_DAILY_LOGIN.maxReward) {
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
