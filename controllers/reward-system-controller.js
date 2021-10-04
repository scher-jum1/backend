const _ = require('lodash');
const {getDayOfYear} = require("date-fns");
const {rewardTypes} = require('../constants/rewards');
const {prepareTimeRange} = require('../util/rewardsUtils');
const {
  getUserRewards,
  createReward,
  updateUserTrackers
} = require('../services/reward-system-service')
const {
  saveEvent,
  notificationEvents,
  publishToBroadcast
} = require('../services/notification-service');
const {mintUser} = require('../services/user-service')
const {getUserData, getUniversalEvents} = require('../services/reward-system-service')

/** Daily log in reward
 * Conditions:
 * -only once per day,
 * -max total amount defined
 * */
const dailyLogin = async (params) => {
  const cfgRef = rewardTypes.ON_DAILY_LOGIN;
  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;
  const todayRange = prepareTimeRange('today');
  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  _.set(rewardRecord, 'userId', userId);

  const isDailyExist = await getUserRewards({
    type: notificationEvents.EVENT_USER_REWARDED,
    'data.rewardType': rewardRecord.rewardType,
    userId,
    createdAt: {$gte: todayRange.start, $lt: todayRange.end}
  }).catch((err) => {
    console.error(err);
  });

  if (isDailyExist.length === 0 && rewardTracker < cfgRef.maxReward) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
}

/** Someone has been registered and confirmed through ref link
 * Conditions:
 * - special award when influencer ref link
 * - max total amount defined
 * */
const friendReffered = async (params) => {
  const cfgRefInlfuencer = rewardTypes.ON_SIGNED_UP_BY_INFLUENCER;
  const cfgRefFriend = rewardTypes.ON_SIGNED_UP_BY_FRIEND;

  const rewardRecordInfluencer = {
    userId: null,
    rewardType: cfgRefInlfuencer.type,
    amountAwarded: null,
    byRef: null,
    category: cfgRefInlfuencer.category
  }

  const rewardRecordFriend = {
    userId: null,
    rewardType: cfgRefFriend.type,
    amountAwarded: null,
    byRef: null,
    category: cfgRefFriend.category
  }

  const {data, event, userId, userRecord} = params;
  // const todayRange = prepareTimeRange('today');
  const refId = _.get(data, 'data.referred');

  const isInfluencer = cfgRefInlfuencer.influencers.indexOf(refId) > -1 ? true : false;

  _.set(rewardRecordInfluencer, 'userId', userId);
  _.set(rewardRecordFriend, 'userId', userId);

  if (isInfluencer) {
    const rewardTrackerInfluencer = _.get(userRecord, `trackers.rewarded.${rewardTrackerInfluencer.rewardType}`, 0);
    if (rewardTrackerInfluencer < cfgRefInlfuencer.maxReward) {
      _.set(rewardRecordInfluencer, 'amountAwarded', cfgRefInlfuencer.singleActionReward);

      await createReward(rewardRecordInfluencer).catch((err) => {
        console.error(err);
      });

      await updateUserTrackers(userId, {
        $inc: {['trackers.amounts' + cfgRefInlfuencer.type]: cfgRefInlfuencer.singleActionReward}
      }).catch((err) => {
        console.error(err);
      });

      //add proper amount of tokens to the user
      await mintUser(userId, rewardRecordInfluencer.amountAwarded).catch((err) => {
        console.error(err);
      })
    }
  } else {
    const rewardTrackerFriend = _.get(userRecord, `trackers.rewarded.${rewardRecordFriend.rewardType}`, 0);

    if (rewardTrackerFriend < cfgRefFriend.maxReward) {
      _.set(rewardTrackerFriend, 'amountAwarded', cfgRefFriend.singleActionReward);

      await createReward(rewardTrackerFriend).catch((err) => {
        console.error(err);
      });

      await updateUserTrackers(userId, {
        $inc: {['trackers.rewarded.' + rewardTypes.ON_SIGNED_UP_BY_FRIEND.type]: rewardTypes.ON_SIGNED_UP_BY_FRIEND.singleActionReward}
      }).catch((err) => {
        console.error(err);
      });

      //add proper amount of tokens to the user
      await mintUser(userId, rewardTrackerFriend.amountAwarded).catch((err) => {
        console.error(err);
      })
    }
  }
}

/** Someone has been visited a shared link,
 * Ideally EVENT_USER_SHARED_LINK_FIRST_VISIT, should be triggered just once, after first visit of the shared link)
 * Conditions:
 * - shared a link will be full filled, when anyone visit the link with someone ref id
 * - max total amount defined
 * */
const sharedLinkVisit = async (params) => {
  const cfgRef = rewardTypes.ON_SHARED_LINK_FIRST_VISIT;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    byRef: null,
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  if (isAlreadyExist.length === 0) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** Someone has betted max stake x times in a row
 * Conditions:
 * - bet max stake 5 times in a row, this event should be emmitted correctly from frontend, to trigger the handler
 * - max total amount defined
 * - only once per lifetime
 * */
const eg_maxStakeBet = async (params) => {
  const cfgRef = rewardTypes.ON_BETTED_MAX_STAKE_IN_ROW;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    timesInRow: null,
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  if (isAlreadyExist.length === 0) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);
    _.set(rewardRecord, 'timesInRow', 5); // just 5 for now

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** Someone has played in x game x times and reached some specific amount like 200
 * Conditions:
 * - played specific game x times
 * - max total amount defined
 * - only once per lifetime == up to max value
 * */
const eg_playedAGame = async (params) => {
  const cfgRef = rewardTypes.ON_GAME_PLAYED;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    totalTimes: 200, //just one game for now, it could be static
    gameName: null,
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  //get event game name
  const gameName = _.get(data, 'data.gameName');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}.${gameName}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type,
    'data.gameName': gameName
  }).catch((err) => {
    console.error(err);
  });

  //increment progress and check condition
  const updatedUserRecord = await updateUserTrackers(userId, {
    $inc: {['trackers.progress.' + cfgRef.type]: 1}
  }).catch((err) => {
    console.error(err);
  });

  const checkGameProgress = _.get(updatedUserRecord, `trackers.progress.${rewardRecord.rewardType}.${gameName}`, 0);

  //Only once is allowed
  if (isAlreadyExist.length === 0 && checkGameProgress >= 200 && rewardTracker >= cfgRef.maxReward) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.games[gameName].singleActionReward);
    _.set(rewardRecord, 'gameName', gameName);
    _.set(rewardRecord, 'totalTimes', checkGameProgress);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** Someone has played in x game x times x days in a row
 * Conditions:
 * - played at least once x days in a row
 * - max total amount defined
 * */
const eg_playedAGameDaysInRow = async (params) => {
  const cfgRef = rewardTypes.ON_GAME_PLAYED_X_DAYS_IN_ROW;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    days: null, //days in row
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  //get event game name
  const gameName = _.get(data, 'data.gameName');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  //check days in row
  const findXDaysDate = new Date();
  findXDaysDate.setDate(findXDaysDate.getDate() - cfgRef.daysInRow);
  const daysInRow = await getUniversalEvents({
    userId,
    'type': params.event,
    createdAt: {'$gte': findXDaysDate}
  }).catch((err) => {
    console.error(err);
  });

  const groupByDateCounter = _.groupBy(daysInRow, x => {
    return getDayOfYear(x.createdAt);
  });

  //Only once is allowed
  if (isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward && groupByDateCounter.length === cfgRef.daysInRow) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.games[gameName].singleActionReward);
    _.set(rewardRecord, 'days', cfgRef.daysInRow);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** Someone was being active for 4 hours, we need to define what means - 'being active', we need to emit event from frontend about how long user is active (EVENT_USER_WAS_ACTIVE_LONG_TIME)
 * Conditions:
 * - user is being active at least 4 hours
 * - max total amount defined
 * */
const eg_userLongTimeActive = async (params) => {
  const cfgRef = rewardTypes.ON_USER_WAS_ACTIVE_LONG_TIME;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    activityHours: null, //activity hours per user
    category: cfgRef.category
  }
  const {data, event, userId, userRecord} = params;

  //get event game name
  const activityHours = _.get(data, 'data.activityHours');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  //Only once is allowed
  if (isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward && parseInt(activityHours, 10) >= cfgRef.timeInHours) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);
    _.set(rewardRecord, 'activityHours', cfgRef.timeInHours);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** User gave bithdate during registration or profile update (@todo we dont have birthdate yet in user collection, profile update missing?)
 * Conditions:
 * - birthdate cant be empty
 * - max total amount defined
 * */
const eg_userBirthdateGiven = async (params) => {
  const cfgRef = rewardTypes.ON_BIRTHDATE_GIVEN;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    category: cfgRef.category
  }
  const {data, event, userId, userRecord} = params;

  //get event game name
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  //Only once is allowed
  if (isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** User wrote message in >= 20 chats
 * Conditions:
 * - user wrote at least 1 message in 20 different chats (events)
 * - max total amount defined
 * */
const eg_checkedInManyChats = async (params) => {
  const cfgRef = rewardTypes.ON_CHECKED_IN_MANY_CHATS;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: null,
    totalChats: null, // total different chats count
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  //get event game name
  const totalChatsCount = _.get(data, 'data.totalChatsCount');
  _.set(rewardRecord, 'userId', userId);

  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': rewardTypes.ON_CHECKED_IN_MANY_CHATS.type
  }).catch((err) => {
    console.error(err);
  });

  //Only once is allowed
  if (isAlreadyExist.length === 0 && rewardTracker >= cfgRef.maxReward && parseInt(totalChatsCount, 10) >= cfgRef.totalChats) {
    _.set(rewardRecord, 'amountAwarded', cfgRef.singleActionReward);
    _.set(rewardRecord, 'totalChats', cfgRef.totalChats);

    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/** User betted 10 times in specific category (Sick society)
 * Conditions:
 * - total bets for user for specific category == cfgRef.totalBets
 * - max total amount defined
 * - only once per lifetime
 * */
const eg_bettedInSickSocietyCat = async (params) => {
  const cfgRef = rewardTypes.ON_BETTED_IN_SICK_SOCIETY_CAT;

  const rewardRecord = {
    userId: null,
    rewardType: cfgRef.type,
    amountAwarded: cfgRef.singleActionReward,
    betCategory: cfgRef.betCategory,
    totalBets: cfgRef.totalBets,
    category: cfgRef.category
  }

  const {data, event, userId, userRecord} = params;

  _.set(rewardRecord, 'userId', userId);

  //get new event category, check only when category match our sick category
  const currentBetCat = _.get(data, 'data.event.category');
  const rewardTracker = _.get(userRecord, `trackers.rewarded.${rewardRecord.rewardType}`, 0);

  const isAlreadyExist = await getUserRewards({
    userId,
    'data.rewardType': cfgRef.type
  }).catch((err) => {
    console.error(err);
  });

  if (currentBetCat !== cfgRef.betCategory) {
    return;
  }

  const totalBetsInCategory = await getUniversalEvents({
    userId,
    'type': "Notification/EVENT_BET_PLACED",
    'data.event.category': cfgRef.betCategory
  }, ['_id']).catch((err) => {
    console.error(err);
  });

  if (isAlreadyExist.length === 0 && totalBetsInCategory.length >= cfgRef.totalBets && rewardTracker < rewardTypes.ON_DAILY_LOGIN.maxReward) {
    await createReward(rewardRecord).catch((err) => {
      console.error(err);
    });

    await updateUserTrackers(userId, {
      $inc: {['trackers.rewarded.' + cfgRef.type]: cfgRef.singleActionReward}
    }).catch((err) => {
      console.error(err);
    });

    //add proper amount of tokens to the user
    await mintUser(userId, rewardRecord.amountAwarded).catch((err) => {
      console.error(err);
    })
  }
};

/**
 * GENERAL NOTES
 * User.trackers
 * ---
 * `trackers.rewarded`
 * We store current rewarded values in User collection per specific reward,
 * we are using `trackers.rewarded`, to check the max, before assign new reward
 * ---
 * `trackers.progress` - here will be stored, some events which need to reach some value until the user will be rewarded,
 *  like play 200 times in rosi game, we will increase the counter for specific game x times and check if user fullfill the reward conditions
 * ---
 * `reward` collection is for only storing achieved rewards + for check if user got a specific reward already or not,
 * like daily login reward only if, reward for specific day not exist and max is not reached
 * ---
 * REMARKS
 * - token amount is given by fn user-service -> mintUser() fn, just after reward record has been created
 * - for missing events, which we dont have yet, websocket channel will be exposed: 'emitAction',
 * it will be dedicated for pushing some events from frontend to backend to avoid http api overhead and save them as specific event,
 * we could later reuse it to build some activity window.
 * For example: someone played the game, we should emit an event with name of the game (EVENT_USER_PLAYED_A_GAME), and
 * then increase User.trackers.progress and check if user is obligate to receive some reward (only for type of rewards we need such 'progress_state'
 * - for every event (if possible), we dont need to call universal_events collection and use just the data provided,
 * next to fn trigger place (publish event)
 * - some rewards will be triggered and processed by cron / jobs at specific time , example: monthly / weekly leaderboards
 */

/**
 * Handle all kind of rewards, based on events names
 * @param event
 * @param data
 * @returns {Promise|null}
 */

const checkDirectEvents = async ({event, data}) => {
  const params = {
    event,
    data
  }

  const userId = _.get(data, 'producerId').toString();

  const userRecord = await getUserData(userId).catch((err) => {
    console.error(err);
  });

  _.set(params, 'userId', userId);
  _.set(params, 'userRecord', userRecord);

  switch (event) {
    case 'Notification/EVENT_USER_SIGNED_IN':
      return await dailyLogin(params)
    case 'Notification/EVENT_USER_CONFIRMED_WITH_REF':
      return await friendReffered(params)
    case 'Notification/EVENT_USER_SHARED_LINK_FIRST_VISIT':
      return await sharedLinkVisit(params)
    case 'Notification/EVENT_USER_BETTED_MAX_STAKE_5_TIMES_IN_ROW':
      return await eg_maxStakeBet(params)
    case 'Notification/EVENT_USER_PLAYED_A_GAME':
      //here will make sense to check as well: user played 6 days in a row
      return await Promise.all([eg_playedAGame(params), eg_playedAGameDaysInRow(params)]);
    case 'Notification/EVENT_USER_IS_ACTIVE_FOR_X':
      //here we will send event through websocket from frontend, for value we needed (in this case, we will track user activity time in frontend and
      // if this reach specific amount we will send this event type
      return await eg_userLongTimeActive(params);
    case 'Notification/EVENT_USER_BIRTH_DATE_GIVEN':
      return await eg_userBirthdateGiven(params);
    case 'Notification/EVENT_USER_CHECKED_IN_MANY_CHATS':
      //the most performant way, will be - to collect chats-check-in in frontend, and send specific event, when we react some value,
      // checking every chat-message event, wont be performance-cost-effective
      return await eg_checkedInManyChats(params);
    case 'Notification/EVENT_BET_PLACED':
      //check for total bets in specific categories for user, when new matched bet in defined category comes
      return await eg_bettedInSickSocietyCat(params);
    case 'Notification/EVENT_USER_FEEDBACK_PROVIDED':
      //user provided a feedback, we dont need to call universal events table for this,
      // this handler should be placed directly in user feedback route
      return await eg_bettedInSickSocietyCat(params);
    default:
      return null
  }
}

/**
 * Handle api call, get all rewards by User
 */
const getAllUserRewardsApi = async (req, res) => {
  // const user = await getUserData(req.user.id);
  const rewards = await getUniversalEvents({
    userId: req.user.id,
    'type': notificationEvents.EVENT_USER_REWARDED
  }).catch((err) => {
    console.error(err);
  });

  res.status(200).json({
    userId: req.user.id,
    username: req.user.id,
    rewards
  });
};

module.exports = {
  getAllUserRewardsApi,
  checkDirectEvents
}
