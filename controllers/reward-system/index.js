const _ = require('lodash');
const {getUserData} = require('../../services/reward-system-service')
const dailyLogin = require('./rewards/dailyLogin');

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
