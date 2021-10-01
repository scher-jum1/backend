const _ = require('lodash');
const {getUserData} = require('../../services/reward-system-service')
const dailyLogin = require('./rewards/dailyLogin');
const friendReffered = require('./rewards/friendReffered');
const sharedLinkVisit = require('./rewards/sharedLinkVisit');
const eg_maxStakeBet = require('./rewards/eg_maxStakeBet');
const eg_playedAGame = require('./rewards/eg_playedAGame');

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
 *
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

  const userRecord = await getUserData(userId).catch((err)=> {
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
      return await eg_playedAGame(params)
    default:
      return null
  }
}

const getAllUserRewards = async (req, res) => {
  const user = await getUserData(req.user.id);
  const rewards = _.get(user, "rewards");

  res.status(200).json({
    userId: user._id,
    username: user.username,
    rewards
  });
};

module.exports = {
  getAllUserRewards,
  checkDirectEvents
}
