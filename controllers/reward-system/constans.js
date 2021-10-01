module.exports = {
  rewardTypes: {
    'ON_DAILY_LOGIN': {
      type: 'ON_DAILY_LOGIN',
      singleActionReward: 50,
      maxReward: 5000,
      category: 'general'
    },
    'ON_SIGNED_UP_BY_FRIEND': {
      type: 'ON_SIGNED_UP_BY_FRIEND',
      singleActionReward: 1000,
      maxReward: 10000,
      category: 'general'
    },
    'ON_SIGNED_UP_BY_INFLUENCER': {
      type: 'ON_SIGNED_UP_BY_INFLUENCER',
      singleActionReward: 7500,
      maxReward: 7500,
      category: 'general',
      influencers: ['publicperson1ref', 'publicperson1ref']
    },
    'ON_SHARED_LINK_FIRST_VISIT': {
      type: 'ON_SHARED_LINK_FIRST_VISIT',
      singleActionReward: 500,
      maxReward: 500,
      category: 'general'
    },
    //for later
    'ON_CAROUSEL_FEEDBACK_ANSWERED': {
      type: 'ON_CAROUSEL_FEEDBACK_ANSWERED',
      singleActionReward: 1000,
      maxReward: 1000,
      category: 'general'
    },
    //for later
    'ON_WENT_BACK_AFTER_INACTIVITY': {
      type: 'ON_WENT_BACK_AFTER_INACTIVITY',
      singleActionReward: 200,
      maxReward: 200,
      category: 'general'
    },
    //EASTER EGGS
    'ON_BETTED_MAX_STAKE_IN_ROW': {
      type: 'ON_BETTED_MAX_STAKE_IN_ROW',
      singleActionReward: 500,
      maxReward: 500,
      category: 'easter_egg'
    },
    'ON_GAME_PLAYED': {
      type: 'ON_GAME_PLAYED',
      category: 'easter_egg',
      games: {
        rosiGame: {
          singleActionReward: 500,
          maxReward: 500
        }
      }
    }
  }

}
