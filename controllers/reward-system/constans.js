module.exports = {
  rewardTypes: {
    'ON_DAILY_LOGIN': {
      type: 'ON_DAILY_LOGIN',
      singleActionReward: 50,
      maxReward: 5000,
      category: 'general'
    },
    'ON_FRIEND_REFERRED': {
      type: 'ON_FRIEND_REFERRED_',
      singleActionReward: 1000,
      maxReward: 10000,
      category: 'general'
    },
    'ON_SIGNED_UP_BY_INFLUENCER': {
      type: 'ON_SIGNED_UP_BY_INFLUENCER',
      singleActionReward: 7500,
      maxReward: 7500,
      category: 'general'
    },
    'ON_SHARED_LINK_FIRST_VISIT': {
      type: 'ON_SHARED_LINK_FIRST_VISIT',
      singleActionReward: 500,
      maxReward: 500,
      category: 'general'
    }
  }

}
